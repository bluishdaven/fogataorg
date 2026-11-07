import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import {
  ACCENT_PRESETS,
  addMemberSchema,
  confirmsCircleName,
  contrastRatio,
  createCircleSchema,
  decisionSchema,
  joinDecisionSchema,
  joinRequestSchema,
  readableTextOn,
  relativeLuminance,
  updateCircleSchema,
} from "@/lib/domain/circles";
import { notificationMessage, notificationPath, type NotificationItem, type SocialTranslator } from "@/lib/domain/notification-text";

describe("accent contrast", () => {
  it("computes WCAG luminance and contrast", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBe(0);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("always picks text with at least 4.5:1 contrast on any accent", () => {
    const samples = [...ACCENT_PRESETS, "#ffff00", "#00ffff", "#808080", "#ff7a2f", "#111111", "#fafafa"];
    for (const accent of samples) {
      expect(contrastRatio(accent, readableTextOn(accent)), accent).toBeGreaterThanOrEqual(4.5);
    }
    expect(readableTextOn("#1e293b")).toBe("#ffffff");
    expect(readableTextOn("#ffff00")).toBe("#000000");
    // Worst case for both options: the mid-tone where white and black tie.
    for (let v = 0; v <= 255; v += 1) {
      const hex = `#${v.toString(16).padStart(2, "0").repeat(3)}`;
      expect(contrastRatio(hex, readableTextOn(hex)), hex).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("createCircleSchema", () => {
  const base = { name: "Lake Notes", description: "", accentColor: "#0F766E", header: null };

  it("derives a slug from the name and lowercases the accent", () => {
    expect(createCircleSchema.parse(base)).toMatchObject({ slug: "lake-notes", accentColor: "#0f766e" });
    expect(createCircleSchema.parse({ ...base, slug: "  Notas del Lago " }).slug).toBe("notas-del-lago");
    expect(createCircleSchema.parse({ ...base, name: "Fogata de Cuentos Ñandú" }).slug).toBe("fogata-de-cuentos-nandu");
  });

  it("rejects short names and slugs, bad colors and headers without alt text", () => {
    const messages = (input: object) => createCircleSchema.safeParse({ ...base, ...input }).error?.issues.map((i) => i.message) ?? [];
    expect(messages({ name: "A" })).toContain("name");
    expect(messages({ name: "¡!", slug: "" })).toContain("slug");
    expect(messages({ slug: "ab" })).toContain("slug");
    expect(messages({ accentColor: "teal" })).toContain("accent");
    expect(messages({ header: { url: "https://images.unsplash.com/x", alt: " ", credit: null } })).toContain("headerAlt");
  });
});

describe("decisionSchema", () => {
  const submissionId = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
  it("takes an optional trimmed note only when declining", () => {
    expect(decisionSchema.parse({ submissionId, status: "declined", note: "  Not quite a fit.  " }).note).toBe("Not quite a fit.");
    expect(decisionSchema.parse({ submissionId, status: "declined", note: "   " }).note).toBeNull();
    expect(decisionSchema.parse({ submissionId, status: "accepted" }).note).toBeNull();
    expect(decisionSchema.safeParse({ submissionId, status: "accepted", note: "Welcome!" }).success).toBe(false);
    expect(decisionSchema.safeParse({ submissionId, status: "declined", note: "x".repeat(501) }).success).toBe(false);
  });
});

describe("confirmsCircleName", () => {
  it("matches the circle's name ignoring case and outer spaces, never an empty answer", () => {
    expect(confirmsCircleName("  agua dulce ", "Agua Dulce")).toBe(true);
    expect(confirmsCircleName("Agua", "Agua Dulce")).toBe(false);
    expect(confirmsCircleName("   ", "   ")).toBe(false);
  });
});

describe("addMemberSchema", () => {
  it("accepts usernames with or without @", () => {
    const id = "0b9f6a52-8f0e-4c55-9d7a-2f4b1c3d5e6f";
    expect(addMemberSchema.parse({ circleId: id, username: "@lucia_ortega", role: "editor" }).username).toBe("lucia_ortega");
    expect(addMemberSchema.safeParse({ circleId: id, username: "x", role: "editor" }).success).toBe(false);
    expect(addMemberSchema.safeParse({ circleId: id, username: "lucia", role: "owner" }).success).toBe(false);
  });
});

describe("private circles", () => {
  const base = { name: "Lake Notes", description: "", accentColor: "#0F766E", header: null };
  const id = "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";

  it("are public unless the owner picks private", () => {
    expect(createCircleSchema.parse(base).isPrivate).toBe(false);
    expect(createCircleSchema.parse({ ...base, isPrivate: true }).isPrivate).toBe(true);
    expect(updateCircleSchema.parse({ ...base, circleId: id, isPrivate: true }).isPrivate).toBe(true);
    expect(createCircleSchema.safeParse({ ...base, isPrivate: "yes" }).success).toBe(false);
  });

  it("validate join requests and decisions", () => {
    expect(joinRequestSchema.safeParse({ circleId: id }).success).toBe(true);
    expect(joinRequestSchema.safeParse({ circleId: "lake-notes" }).success).toBe(false);
    expect(joinDecisionSchema.safeParse({ requestId: id, accept: true }).success).toBe(true);
    expect(joinDecisionSchema.safeParse({ requestId: id, accept: "yes" }).success).toBe(false);
  });
});

describe("join notifications", () => {
  function translator(messages: typeof en | typeof es, locale: "en" | "es"): SocialTranslator {
    const t = createTranslator({ locale, messages, namespace: "Social" });
    return (key, values) => (t as unknown as SocialTranslator)(key, values);
  }
  const item = (type: "join_request" | "join_accepted" | "circle_owner", others = 0): NotificationItem => ({
    type,
    actor: { username: "ana", name: "Ana" },
    others,
    story: null,
    responseExcerpt: null,
    circle: { slug: "lake-notes", name: "Lake Notes" },
  });

  it("say who asked or who let you in, in both languages", () => {
    expect(notificationMessage(translator(en, "en"), item("join_request"))).toBe("Ana asked to join Lake Notes");
    expect(notificationMessage(translator(en, "en"), item("join_request", 2))).toBe("Ana and 2 others asked to join Lake Notes");
    expect(notificationMessage(translator(es, "es"), item("join_request", 1))).toBe("Ana y 1 persona más pidieron unirse a Lake Notes");
    expect(notificationMessage(translator(en, "en"), item("join_accepted"))).toBe(
      "Ana accepted you into Lake Notes. Your stories go straight in now.",
    );
    expect(notificationMessage(translator(es, "es"), item("join_accepted"))).toBe("Ana te aceptó en Lake Notes. Ahora tus historias entran directo.");
  });

  it("open the requests for editors and the circle for new members", () => {
    expect(notificationPath(item("join_request"), "en")).toBe("/en/circles/lake-notes/manage");
    expect(notificationPath(item("join_accepted"), "es")).toBe("/es/circles/lake-notes");
  });

  it("tell a new owner who handed the circle over and take them to its manage page", () => {
    expect(notificationMessage(translator(en, "en"), item("circle_owner"))).toBe("Ana handed Lake Notes over to you. You're its owner now.");
    expect(notificationMessage(translator(es, "es"), item("circle_owner"))).toBe("Ana te entregó Lake Notes. Ahora lo administras tú.");
    expect(notificationPath(item("circle_owner"), "es")).toBe("/es/circles/lake-notes/manage");
  });
});
