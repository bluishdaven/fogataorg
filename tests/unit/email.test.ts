import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import { createUnsubscribeToken, safeEqual, verifyUnsubscribeToken } from "@/lib/domain/email-tokens";
import { emailFrequencyInputSchema, unsubscribeInputSchema } from "@/lib/domain/email-settings";
import {
  notificationMessage,
  notificationPath,
  type NotificationItem,
  type SocialTranslator,
} from "@/lib/domain/notification-text";
import { buildSummaryEmail, SUMMARY_ITEM_LIMIT } from "@/lib/email/summary";

const USER = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const SECRET = "test-secret-with-enough-entropy";

function translator(messages: typeof en | typeof es, locale: "en" | "es"): SocialTranslator {
  const t = createTranslator({ locale, messages, namespace: "Social" });
  return (key, values) => (t as unknown as SocialTranslator)(key, values);
}

const follow: NotificationItem = {
  type: "follow",
  actor: { username: "lucia_r", name: "Lucía Ramírez" },
  others: 2,
  story: null,
  responseExcerpt: null,
  circle: null,
};
const spark: NotificationItem = {
  type: "spark",
  actor: { username: "tomas", name: "Tomás" },
  others: 0,
  story: { title: "El río <de noche>", slug: "el-rio", author: "ana" },
  responseExcerpt: null,
  circle: null,
};
const submission: NotificationItem = {
  type: "submission",
  actor: { username: "tomas", name: "Tomás" },
  others: 0,
  story: { title: "Orillas", slug: "orillas", author: "tomas" },
  responseExcerpt: null,
  circle: { slug: "agua", name: "Agua" },
};

describe("unsubscribe tokens", () => {
  it("round-trips the user id", () => {
    const token = createUnsubscribeToken(USER, SECRET);
    expect(verifyUnsubscribeToken(token, SECRET)).toBe(USER);
    expect(token).not.toContain(USER);
  });

  it("rejects forged, tampered and malformed tokens", () => {
    const token = createUnsubscribeToken(USER, SECRET);
    const [idPart, signature] = token.split(".");
    const otherUser = Buffer.from("00000000-0000-4000-8000-000000000000").toString("base64url");
    expect(verifyUnsubscribeToken(token, "another-secret")).toBeNull();
    expect(verifyUnsubscribeToken(`${otherUser}.${signature}`, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(`${idPart}.${signature}x`, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(`${idPart}`, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(`${token}.extra`, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(Buffer.from("not-a-uuid").toString("base64url") + ".abc", SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(undefined, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(token, "")).toBeNull();
    expect(() => createUnsubscribeToken(USER, "")).toThrow();
  });

  it("compares secrets without leaking length differences", () => {
    expect(safeEqual("Bearer abc", "Bearer abc")).toBe(true);
    expect(safeEqual("Bearer abc", "Bearer abd")).toBe(false);
    expect(safeEqual("Bearer abc", "Bearer abcd")).toBe(false);
  });
});

describe("email settings input", () => {
  it("accepts only known frequencies and bounded tokens", () => {
    expect(emailFrequencyInputSchema.safeParse({ frequency: "weekly" }).success).toBe(true);
    expect(emailFrequencyInputSchema.safeParse({ frequency: "off" }).success).toBe(true);
    expect(emailFrequencyInputSchema.safeParse({ frequency: "daily" }).success).toBe(false);
    expect(emailFrequencyInputSchema.safeParse({ frequency: "hourly" }).success).toBe(false);
    expect(unsubscribeInputSchema.safeParse({ token: "a.b", locale: "es" }).success).toBe(true);
    expect(unsubscribeInputSchema.safeParse({ token: "x".repeat(201), locale: "es" }).success).toBe(false);
    expect(unsubscribeInputSchema.safeParse({ token: "a.b", locale: "fr" }).success).toBe(false);
  });
});

describe("notification text", () => {
  it("reads the same in both languages", () => {
    expect(notificationMessage(translator(en, "en"), follow)).toBe("Lucía Ramírez and 2 others started following you");
    expect(notificationMessage(translator(es, "es"), spark)).toContain("Tomás");
    expect(notificationMessage(translator(en, "en"), submission)).toBe("Tomás submitted “Orillas” to Agua");
  });

  it("links to the right place", () => {
    expect(notificationPath(follow, "en")).toBe("/@lucia_r");
    expect(notificationPath(spark, "es")).toBe("/@ana/el-rio");
    expect(notificationPath({ ...spark, type: "response" }, "es")).toBe("/@ana/el-rio#responses");
    expect(notificationPath(submission, "es")).toBe("/es/circles/agua/manage");
    expect(notificationPath({ ...follow, actor: null }, "en")).toBe("/en/me/notifications");
  });
});

describe("summary email", () => {
  const base = {
    userId: USER,
    to: "ana@fogata.test",
    siteUrl: "https://fogata.example",
    signingSecret: SECRET,
  };

  it("lists notifications with absolute links, escapes titles, and carries one-click unsubscribe headers", async () => {
    const email = await buildSummaryEmail({ ...base, locale: "en", items: [follow, spark], total: 2 });
    expect(email.subject).toBe("2 new notifications on Fogata");
    expect(email.html).toContain('href="https://fogata.example/@lucia_r"');
    expect(email.html).toContain("El río &lt;de noche&gt;");
    expect(email.html).not.toContain("<de noche>");
    expect(email.html).toContain('lang="en"');
    expect(email.html).toContain("once a week at most");
    expect(email.text).toContain("Lucía Ramírez and 2 others started following you");

    const token = createUnsubscribeToken(USER, SECRET);
    expect(email.headers?.["List-Unsubscribe"]).toBe(`<https://fogata.example/api/email/unsubscribe?token=${token}>`);
    expect(email.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(email.html).toContain(`https://fogata.example/en/email/unsubscribe?token=${token}`);
    expect(email.html).toContain("https://fogata.example/en/settings/notifications");
  });

  it("shows the editors' note under a declined submission", async () => {
    const declined: NotificationItem = { ...submission, type: "declined", note: "Precioso, pero <no> encaja aquí." };
    const email = await buildSummaryEmail({ ...base, locale: "es", items: [declined], total: 1 });
    expect(email.html).toContain("Nota de los editores: «Precioso, pero &lt;no&gt; encaja aquí.»");
    expect(email.text).toContain("Nota de los editores: «Precioso, pero <no> encaja aquí.»");
  });

  it("speaks Spanish, caps the list and says how many more there are", async () => {
    const items = Array.from({ length: SUMMARY_ITEM_LIMIT + 3 }, () => follow);
    const email = await buildSummaryEmail({ ...base, locale: "es", items, total: 20 });
    expect(email.subject).toBe("20 notificaciones nuevas en Fogata");
    expect(email.html).toContain('lang="es"');
    expect(email.html).toContain(`Y ${20 - SUMMARY_ITEM_LIMIT} más.`);
    expect(email.html).toContain("una vez a la semana");
    expect(email.html).toContain("https://fogata.example/es/email/unsubscribe?token=");
    // Linked items only (the inbox preview line repeats the first one).
    expect(email.html.match(/empezaron a seguirte<\/a>/g)?.length).toBe(SUMMARY_ITEM_LIMIT);
  });
});
