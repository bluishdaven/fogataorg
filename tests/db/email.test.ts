import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { follows, notifications, profiles } from "@/lib/db/schema";
import { sendNotificationEmails } from "@/lib/email/notification-emails";
import type { OutgoingEmail, SendEmail } from "@/lib/email/transport";
import { closeDb, expectPgError, PG, scenario, type Harness } from "./harness";

afterAll(closeDb);

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const SECRET = "db-test-signing-secret";

/** Notifications are stamped with the transaction's start time; run the job "later" so they've settled. */
const later = (ms = 15 * MINUTE) => new Date(Date.now() + ms);

function inbox() {
  const sent: OutgoingEmail[] = [];
  const send: SendEmail = async (email) => {
    sent.push(email);
    return { id: `fake-${sent.length}` };
  };
  return { sent, send };
}

function run(h: Harness, send: SendEmail, now: Date, users: string[]) {
  return sendNotificationEmails({
    db: h.tx,
    send,
    now,
    siteUrl: "https://fogata.example",
    signingSecret: SECRET,
    onlyUserIds: users,
  });
}

async function follow(h: Harness, follower: string, writer: string) {
  await h.as(h.claimsFor(follower), (tx) => tx.insert(follows).values({ followerId: follower, followedUserId: writer }));
}

async function profileOf(h: Harness, id: string) {
  const [row] = await h.tx.select().from(profiles).where(eq(profiles.id, id));
  return row!;
}

async function notificationsOf(h: Harness, id: string) {
  return h.tx.select().from(notifications).where(eq(notifications.userId, id));
}

describe("activity summary emails", () => {
  it("sends one summary, marks what it covered, and waits a day before the next", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser({ email: "writer-summary@fogata.test" });
      const a = await h.createUser();
      const b = await h.createUser();
      await follow(h, a, writer);

      const { sent, send } = inbox();
      const first = later();
      expect(await run(h, send, first, [writer])).toEqual({ sent: 1, failed: 0, skipped: 0 });
      expect(sent).toHaveLength(1);
      expect(sent[0]!.to).toBe("writer-summary@fogata.test");
      expect(sent[0]!.subject).toBe("1 new notification on Fogata");
      expect(sent[0]!.text).toContain("started following you");
      expect(sent[0]!.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
      expect((await profileOf(h, writer)).emailLastSentAt?.getTime()).toBe(first.getTime());
      const [emailed] = await notificationsOf(h, writer);
      expect(emailed!.emailedAt?.getTime()).toBe(first.getTime());

      // Nothing new: nothing sent.
      expect((await run(h, send, later(2 * HOUR), [writer])).sent).toBe(0);

      // A new follower joins the same unread group, which becomes pending again...
      await follow(h, b, writer);
      const [group] = await notificationsOf(h, writer);
      expect(group!.emailedAt).toBeNull();
      expect(group!.actorCount).toBe(2);
      expect(group!.updatedAt.getTime()).toBeGreaterThanOrEqual(emailed!.updatedAt.getTime());

      // ...but daily readers hear about it only after a day.
      expect((await run(h, send, later(3 * HOUR), [writer])).sent).toBe(0);
      expect((await run(h, send, later(DAY), [writer])).sent).toBe(1);
      expect(sent[1]!.text).toContain("and 1 other started following you");
    });
  });

  it("respects Off, Weekly and the reader's language", async () => {
    await scenario(async (h) => {
      const off = await h.createUser();
      const weekly = await h.createUser({ email: "weekly-summary@fogata.test" });
      const fan = await h.createUser();
      await h.tx.update(profiles).set({ emailFrequency: "off" }).where(eq(profiles.id, off));
      await h.tx
        .update(profiles)
        .set({ emailFrequency: "weekly", locale: "es", emailLastSentAt: new Date(Date.now() - 3 * DAY) })
        .where(eq(profiles.id, weekly));
      await follow(h, fan, off);
      await follow(h, fan, weekly);

      const { sent, send } = inbox();
      expect((await run(h, send, later(), [off, weekly])).sent).toBe(0);

      await h.tx.update(profiles).set({ emailLastSentAt: new Date(Date.now() - 7 * DAY) }).where(eq(profiles.id, weekly));
      expect((await run(h, send, later(), [off, weekly])).sent).toBe(1);
      expect(sent[0]!.to).toBe("weekly-summary@fogata.test");
      expect(sent[0]!.subject).toBe("1 notificación nueva en Fogata");
      expect(sent[0]!.html).toContain("una vez a la semana");
      expect(sent[0]!.html).toContain("https://fogata.example/es/settings/notifications");
    });
  });

  it("leaves everything pending when sending fails", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const fan = await h.createUser();
      await follow(h, fan, writer);

      const failing: SendEmail = async () => {
        throw new Error("provider down");
      };
      const result = await run(h, failing, later(), [writer]);
      expect(result).toEqual({ sent: 0, failed: 1, skipped: 0 });
      expect((await profileOf(h, writer)).emailLastSentAt).toBeNull();
      expect((await notificationsOf(h, writer))[0]!.emailedAt).toBeNull();

      const { send } = inbox();
      expect((await run(h, send, later(), [writer])).sent).toBe(1);
    });
  });

  it("skips notifications already read in the app, too fresh, or too old", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const fan = await h.createUser();
      await follow(h, fan, writer);
      const { send } = inbox();

      // Too fresh: within the settle window.
      expect((await run(h, send, later(2 * MINUTE), [writer])).sent).toBe(0);

      // Too old.
      await h.tx.execute(sql`update public.notifications set updated_at = now() - interval '10 days' where user_id = ${writer}`);
      expect((await run(h, send, later(), [writer])).sent).toBe(0);

      // Read in the app.
      await h.tx.execute(sql`update public.notifications set updated_at = now(), read_at = now() where user_id = ${writer}`);
      expect((await run(h, send, later(), [writer])).sent).toBe(0);
    });
  });

  it("never emails addresses that aren't confirmed", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const fan = await h.createUser();
      await h.tx.execute(sql`update auth.users set email_confirmed_at = null where id = ${writer}`);
      await follow(h, fan, writer);
      const { sent, send } = inbox();
      await run(h, send, later(), [writer]);
      expect(sent).toHaveLength(0);
    });
  });
});

describe("notification times", () => {
  it("keep their last-activity time when marked read or emailed", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const fan = await h.createUser();
      await follow(h, fan, writer);
      const past = new Date(Date.now() - 2 * HOUR);
      await h.tx.update(notifications).set({ updatedAt: past }).where(eq(notifications.userId, writer));

      await h.tx.update(notifications).set({ emailedAt: new Date() }).where(eq(notifications.userId, writer));
      await h.as(h.claimsFor(writer), (tx) =>
        tx.update(notifications).set({ readAt: new Date() }).where(eq(notifications.userId, writer)),
      );
      const [row] = await notificationsOf(h, writer);
      expect(row!.readAt).not.toBeNull();
      expect(row!.updatedAt.getTime()).toBe(past.getTime());
    });
  });
});

describe("email settings permissions", () => {
  it("lets readers change their own frequency but not the job's bookkeeping", async () => {
    await scenario(async (h) => {
      const me = await h.createUser();
      const other = await h.createUser();
      const fan = await h.createUser();
      await follow(h, fan, me);

      await h.as(h.claimsFor(me), (tx) => tx.update(profiles).set({ emailFrequency: "weekly" }).where(eq(profiles.id, me)));
      expect((await profileOf(h, me)).emailFrequency).toBe("weekly");

      // Someone else's setting: RLS filters the row out.
      await h.as(h.claimsFor(other), (tx) => tx.update(profiles).set({ emailFrequency: "off" }).where(eq(profiles.id, me)));
      expect((await profileOf(h, me)).emailFrequency).toBe("weekly");

      await expectPgError(
        h.as(h.claimsFor(me), (tx) => tx.update(profiles).set({ emailLastSentAt: new Date() }).where(eq(profiles.id, me))),
        PG.insufficientPrivilege,
      );
      await expectPgError(
        h.as(h.claimsFor(me), (tx) => tx.update(notifications).set({ emailedAt: new Date() }).where(eq(notifications.userId, me))),
        PG.insufficientPrivilege,
      );
    });
  });
});
