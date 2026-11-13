import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { follows, notifications, pushSubscriptions } from "@/lib/db/schema";
import { sendPendingPushes, type PushSender } from "@/lib/push/send";
import { closeDb, expectPgError, PG, scenario, type Harness } from "./harness";

afterAll(closeDb);

const KEYS = { p256dh: "B".repeat(87), auth: "a".repeat(22) };
const endpoint = (name: string) => `https://fcm.googleapis.com/fcm/send/${name}`;

async function save(h: Harness, userId: string, url: string, locale = "en") {
  await h.as(h.claimsFor(userId), (tx) =>
    tx.execute(sql`select public.save_push_subscription(${url}, ${KEYS.p256dh}, ${KEYS.auth}, ${locale}::public.locale_code)`),
  );
}

async function follow(h: Harness, follower: string, writer: string) {
  await h.as(h.claimsFor(follower), (tx) => tx.insert(follows).values({ followerId: follower, followedUserId: writer }));
}

function outbox(status = 201) {
  const sent: { endpoint: string; payload: { title: string; body: string; url: string; tag: string; lang: string } }[] = [];
  const send: PushSender = async (target, payload) => {
    sent.push({ endpoint: target.endpoint, payload: JSON.parse(payload) });
    return status;
  };
  return { sent, send };
}

describe("push subscriptions", () => {
  it("are private, saved only through the function, and move to whoever has the address", async () => {
    await scenario(async (h) => {
      const ana = await h.createUser();
      const bo = await h.createUser();
      await save(h, ana, endpoint("shared-phone"));
      expect(await h.as(h.claimsFor(ana), (tx) => tx.select().from(pushSubscriptions))).toHaveLength(1);
      expect(await h.as(h.claimsFor(bo), (tx) => tx.select().from(pushSubscriptions))).toHaveLength(0);

      // No direct inserts or updates.
      await expectPgError(
        h.as(h.claimsFor(bo), (tx) => tx.insert(pushSubscriptions).values({ userId: bo, endpoint: endpoint("x"), ...KEYS })),
        PG.insufficientPrivilege,
      );
      await expectPgError(
        h.as(h.claimsFor(ana), (tx) => tx.update(pushSubscriptions).set({ locale: "es" }).where(eq(pushSubscriptions.userId, ana))),
        PG.insufficientPrivilege,
      );
      // Others can't remove it.
      const removed = await h.as(h.claimsFor(bo), (tx) => tx.delete(pushSubscriptions).returning({ id: pushSubscriptions.id }));
      expect(removed).toHaveLength(0);

      // The device changes hands: the address now belongs to Bo, in his language.
      await save(h, bo, endpoint("shared-phone"), "es");
      const rows = await h.tx.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint("shared-phone")));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ userId: bo, locale: "es" });

      // Anonymous visitors can't save one.
      await expectPgError(
        h.as(null, (tx) => tx.execute(sql`select public.save_push_subscription(${endpoint("anon")}, ${KEYS.p256dh}, ${KEYS.auth}, 'en')`)),
        PG.insufficientPrivilege,
      );
    });
  });

  it("keep ten devices per person at most and require https", async () => {
    await scenario(async (h) => {
      const ana = await h.createUser();
      for (let index = 0; index < 12; index += 1) await save(h, ana, endpoint(`device-${index}`));
      const rows = await h.tx.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, ana));
      expect(rows).toHaveLength(10);
      await h.savepoint(async () => {
        await expectPgError(save(h, ana, "http://fcm.googleapis.com/fcm/send/plain"), PG.checkViolation);
      });
    });
  });
});

describe("sending pushes", () => {
  it("pushes new notification groups once, to every device, in each device's language", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const reader = await h.createUser();
      const quiet = await h.createUser();
      await save(h, writer, endpoint("writer-phone"), "en");
      await save(h, writer, endpoint("writer-laptop"), "es");
      await follow(h, reader, writer);
      // Someone without devices: their notification isn't claimed.
      await follow(h, writer, quiet);

      const { sent, send } = outbox();
      const first = await sendPendingPushes({ db: h.tx, send, onlyUserIds: [writer, quiet] });
      expect(first).toMatchObject({ groups: 1, sent: 2, failed: 0, removed: 0 });
      expect(sent.map((push) => push.endpoint).sort()).toEqual([endpoint("writer-laptop"), endpoint("writer-phone")]);
      const english = sent.find((push) => push.payload.lang === "en")!;
      const spanish = sent.find((push) => push.payload.lang === "es")!;
      expect(english.payload.url).toMatch(/^\/@/);
      expect(english.payload.tag).toMatch(/^n-/);
      expect(english.payload.body).not.toBe(spanish.payload.body);

      // Nothing new: nothing sent.
      expect((await sendPendingPushes({ db: h.tx, send, onlyUserIds: [writer] })).groups).toBe(0);

      // The group gets news after it was pushed: pushed again (same tag, so it replaces the first).
      await h.tx
        .update(notifications)
        .set({ pushedAt: sql`now() - interval '1 minute'` })
        .where(eq(notifications.userId, writer));
      const again = await sendPendingPushes({ db: h.tx, send, onlyUserIds: [writer] });
      expect(again.groups).toBe(1);
      expect(sent.at(-1)!.payload.tag).toBe(english.payload.tag);

      // Read, or older than the window: never pushed.
      await h.tx.update(notifications).set({ pushedAt: null, readAt: sql`now()` }).where(eq(notifications.userId, writer));
      expect((await sendPendingPushes({ db: h.tx, send, onlyUserIds: [writer] })).groups).toBe(0);
      const [quietRow] = await h.tx.select().from(notifications).where(eq(notifications.userId, quiet));
      expect(quietRow!.pushedAt).toBeNull();
    });
  });

  it("forgets devices the push service says are gone", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const reader = await h.createUser();
      await save(h, writer, endpoint("old-phone"));
      await follow(h, reader, writer);
      const { send } = outbox(410);
      const result = await sendPendingPushes({ db: h.tx, send, onlyUserIds: [writer] });
      expect(result).toMatchObject({ groups: 1, sent: 0, removed: 1 });
      expect(await h.tx.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, writer))).toHaveLength(0);
    });
  });

  it("skips groups older than an hour", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const reader = await h.createUser();
      await save(h, writer, endpoint("phone"));
      await follow(h, reader, writer);
      await h.tx.execute(sql`alter table public.notifications disable trigger user`);
      await h.tx.update(notifications).set({ updatedAt: sql`now() - interval '2 hours'` }).where(eq(notifications.userId, writer));
      await h.tx.execute(sql`alter table public.notifications enable trigger user`);
      const { send } = outbox();
      expect((await sendPendingPushes({ db: h.tx, send, onlyUserIds: [writer] })).groups).toBe(0);
    });
  });
});
