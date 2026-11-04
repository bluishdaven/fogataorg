import { describe, expect, it } from "vitest";
import { emailSchema, magicLinkSchema, usernameSchema } from "@/lib/domain/schemas";

describe("emailSchema", () => {
  it("trims and lowercases", () => {
    expect(emailSchema.parse("  Lucia@Fogata.TEST ")).toBe("lucia@fogata.test");
  });

  it("rejects malformed addresses with the 'email' message key", () => {
    const result = emailSchema.safeParse("not-an-email");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("email");
  });
});

describe("usernameSchema", () => {
  it("allows letters, numbers and underscores, 3–30 long", () => {
    expect(usernameSchema.safeParse("lucia_ortega").success).toBe(true);
    expect(usernameSchema.safeParse("ab").success).toBe(false);
    expect(usernameSchema.safeParse("has-dash").success).toBe(false);
    expect(usernameSchema.safeParse("ñandú").success).toBe(false);
    expect(usernameSchema.safeParse("a".repeat(31)).success).toBe(false);
  });
});

describe("magicLinkSchema", () => {
  it("requires a supported locale", () => {
    expect(magicLinkSchema.safeParse({ email: "a@b.co", locale: "es" }).success).toBe(true);
    expect(magicLinkSchema.safeParse({ email: "a@b.co", locale: "fr" }).success).toBe(false);
  });
});
