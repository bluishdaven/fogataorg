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

/**
 * A run time on the given UTC weekday, at least `afterMs` from now. Notifications are stamped with
 * the transaction's start time, so runs are always 15+ minutes "later" for them to have settled.
 */
function onWeekday(weekday: number, afterMs = 15 * MINUTE): Date {
  const at = new Date(Date.now() + afterMs);
  while (at.getUTCDay() !== weekday) at.setTime(at.getTime() + DAY);
  return at;
}

async function setWeekday(h: Harness, userId: string, weekday: number) {
  await h.tx.update(profiles).set({ emailWeekday: weekday }).where(eq(profiles.id, userId));
}

function inbox() {
  const sent: OutgoingEmail[] = [];
  const send: SendEmail = async (email) => {
    sent.push(email);
    return { id: `fake-${sent.length}` };
  };
  return { sent, send };
}

function run(h: Harness, send: SendEmail, now: Date, users: string[], limit?: number) {
  return sendNotificationEmails({
    db: h.tx,
    send,
    now,
    limit,
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

describe("weekly activity summaries", () => {
  it("sends on the reader's weekday only, marks what it covered, and waits a week", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser({ email: "writer-summary@fogata.test" });
      const a = await h.createUser();
      const b = await h.createUser();
      expect((await profileOf(h, writer)).emailFrequency).toBe("weekly");
      await setWeekday(h, writer, 3);
      await follow(h, a, writer);

      const { sent, send } = inbox();
      expect((await run(h, send, onWeekday(2), [writer])).sent).toBe(0);

      const first = onWeekday(3);
      expect(await run(h, send, first, [writer])).toEqual({ sent: 1, failed: 0, skipped: 0, limited: false });
      expect(sent[0]!.to).toBe("writer-summary@fogata.test");
      expect(sent[0]!.subject).toBe("1 new notification on Fogata");
      expect(sent[0]!.text).toContain("started following you");
      expect(sent[0]!.text).toContain("once a week at most");
      expect(sent[0]!.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
      expect((await profileOf(h, writer)).emailLastSentAt?.getTime()).toBe(first.getTime());
      const [emailed] = await notificationsOf(h, writer);
      expect(emailed!.emailedAt?.getTime()).toBe(first.getTime());

      // A rerun the same day sends nothing.
      expect((await run(h, send, new Date(first.getTime() + HOUR), [writer])).sent).toBe(0);

      // A new follower joins the same unread group, which becomes pending again...
      await follow(h, b, writer);
      const [group] = await notificationsOf(h, writer);
      expect(group!.emailedAt).toBeNull();
      expect(group!.actorCount).toBe(2);
      expect(group!.updatedAt.getTime()).toBeGreaterThanOrEqual(emailed!.updatedAt.getTime());

      // ...and goes out on the reader's day next week, not before.
      expect((await run(h, send, new Date(first.getTime() + DAY), [writer])).sent).toBe(0);
      expect((await run(h, send, new Date(first.getTime() + 7 * DAY), [writer])).sent).toBe(1);
      expect(sent[1]!.text).toContain("and 1 other started following you");
    });
  });

  it("spreads readers over the week: each run emails only that day's readers", async () => {
    await scenario(async (h) => {
      const fan = await h.createUser();
      const readers: string[] = [];
      for (let weekday = 0; weekday < 7; weekday += 1) {
        const reader = await h.createUser({ email: `weekday-${weekday}@fogata.test` });
        await setWeekday(h, reader, weekday);
        await follow(h, fan, reader);
        readers.push(reader);
      }
      const { sent, send } = inbox();
      for (let weekday = 0; weekday < 7; weekday += 1) {
        const result = await run(h, send, onWeekday(weekday), readers);
        expect(result.sent).toBe(1);
        expect(sent.at(-1)!.to).toBe(`weekday-${weekday}@fogata.test`);
      }
    });
  });

  it("new readers get a random weekday", async () => {
    await scenario(async (h) => {
      const days = new Set<number>();
      for (let i = 0; i < 40; i += 1) days.add((await profileOf(h, await h.createUser())).emailWeekday);
      expect([...days].every((day) => day >= 0 && day <= 6)).toBe(true);
      expect(days.size).toBeGreaterThan(3);
    });
  });

  it("stops at the daily cap and serves the readers it skipped first next week", async () => {
    await scenario(async (h) => {
      const fan = await h.createUser();
      const first = await h.createUser();
      const second = await h.createUser();
      for (const reader of [first, second]) {
        await setWeekday(h, reader, 5);
        await follow(h, fan, reader);
      }
      // `first` was emailed long ago, `second` never: whoever waited longest goes first.
      await h.tx.update(profiles).set({ emailLastSentAt: new Date(Date.now() - 30 * DAY) }).where(eq(profiles.id, first));

      const { sent, send } = inbox();
      const friday = onWeekday(5);
      const result = await run(h, send, friday, [first, second], 1);
      expect(result).toEqual({ sent: 1, failed: 0, skipped: 0, limited: true });
      const servedFirst = sent[0]!.to;

      const nextWeek = await run(h, send, new Date(friday.getTime() + 7 * DAY), [first, second], 1);
      expect(nextWeek.sent).toBe(1);
      expect(sent[1]!.to).not.toBe(servedFirst);
    });
  });

  it("respects Off and the reader's language", async () => {
    await scenario(async (h) => {
      const off = await h.createUser();
      const spanish = await h.createUser({ email: "es-summary@fogata.test" });
      const fan = await h.createUser();
      await h.tx.update(profiles).set({ emailFrequency: "off", emailWeekday: 1 }).where(eq(profiles.id, off));
      await h.tx.update(profiles).set({ locale: "es", emailWeekday: 1 }).where(eq(profiles.id, spanish));
      await follow(h, fan, off);
      await follow(h, fan, spanish);

      const { sent, send } = inbox();
      expect((await run(h, send, onWeekday(1), [off, spanish])).sent).toBe(1);
      expect(sent[0]!.to).toBe("es-summary@fogata.test");
      expect(sent[0]!.subject).toBe("1 notificación nueva en Fogata");
      expect(sent[0]!.html).toContain("una vez a la semana");
      expect(sent[0]!.html).toContain("https://fogata.example/es/settings/notifications");
    });
  });

  it("leaves everything pending when sending fails", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const fan = await h.createUser();
      await setWeekday(h, writer, 4);
      await follow(h, fan, writer);

      const failing: SendEmail = async () => {
        throw new Error("provider down");
      };
      const thursday = onWeekday(4);
      expect(await run(h, failing, thursday, [writer])).toEqual({ sent: 0, failed: 1, skipped: 0, limited: false });
      expect((await profileOf(h, writer)).emailLastSentAt).toBeNull();
      expect((await notificationsOf(h, writer))[0]!.emailedAt).toBeNull();

      const { send } = inbox();
      // The next run, still on Thursday (an hour later would be Friday late in the UTC day).
      const retry = new Date(thursday.getTime() + HOUR);
      if (retry.getUTCDay() !== 4) retry.setTime(thursday.getTime() + MINUTE);
      expect((await run(h, send, retry, [writer])).sent).toBe(1);
    });
  });

  it("skips notifications already read in the app, too fresh, or too old", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const fan = await h.createUser();
      await setWeekday(h, writer, 0);
      await follow(h, fan, writer);
      const { send } = inbox();

      // Too fresh: within the settle window.
      const [notification] = await notificationsOf(h, writer);
      const fresh = new Date(notification!.updatedAt.getTime() + 2 * MINUTE);
      await h.tx.update(profiles).set({ emailWeekday: fresh.getUTCDay() }).where(eq(profiles.id, writer));
      expect((await run(h, send, fresh, [writer])).sent).toBe(0);
      await setWeekday(h, writer, 0);

      // Too old.
      await h.tx.execute(sql`update public.notifications set updated_at = now() - interval '16 days' where user_id = ${writer}`);
      expect((await run(h, send, onWeekday(0), [writer])).sent).toBe(0);

      // Read in the app.
      await h.tx.execute(sql`update public.notifications set updated_at = now(), read_at = now() where user_id = ${writer}`);
      expect((await run(h, send, onWeekday(0), [writer])).sent).toBe(0);
    });
  });

  it("never emails addresses that aren't confirmed", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const fan = await h.createUser();
      await setWeekday(h, writer, 6);
      await h.tx.execute(sql`update auth.users set email_confirmed_at = null where id = ${writer}`);
      await follow(h, fan, writer);
      const { sent, send } = inbox();
      await run(h, send, onWeekday(6), [writer]);
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

      await h.as(h.claimsFor(me), (tx) => tx.update(profiles).set({ emailFrequency: "off" }).where(eq(profiles.id, me)));
      expect((await profileOf(h, me)).emailFrequency).toBe("off");

      // Someone else's setting: RLS filters the row out.
      await h.as(h.claimsFor(other), (tx) => tx.update(profiles).set({ emailFrequency: "weekly" }).where(eq(profiles.id, me)));
      expect((await profileOf(h, me)).emailFrequency).toBe("off");

      // The weekday is assigned, not chosen (yet).
      await expectPgError(
        h.as(h.claimsFor(me), (tx) => tx.update(profiles).set({ emailWeekday: 2 }).where(eq(profiles.id, me))),
        PG.insufficientPrivilege,
      );

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
