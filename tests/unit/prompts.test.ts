import { describe, expect, it } from "vitest";
import { isMonday, mondayOf, promptInputSchema, promptText } from "@/lib/domain/prompts";

describe("weekly sparks", () => {
  it("start on Mondays (UTC)", () => {
    expect(isMonday("2026-11-09")).toBe(true);
    expect(isMonday("2026-11-10")).toBe(false);
    expect(isMonday("2026-02-30")).toBe(false);
    expect(isMonday("nope")).toBe(false);
    expect(mondayOf(new Date("2026-11-07T23:59:00Z"))).toBe("2026-11-02");
    expect(mondayOf(new Date("2026-11-09T00:00:00Z"))).toBe("2026-11-09");
    expect(mondayOf(new Date("2026-11-15T12:00:00Z"))).toBe("2026-11-09");
  });

  it("need the prompt in both languages", () => {
    expect(promptInputSchema.safeParse({ weekOf: "2026-11-09", textEn: "A door", textEs: "Una puerta" }).success).toBe(true);
    expect(promptInputSchema.safeParse({ weekOf: "2026-11-09", textEn: "A door", textEs: " " }).success).toBe(false);
    expect(promptInputSchema.safeParse({ weekOf: "2026-11-10", textEn: "A door", textEs: "Una puerta" }).error?.issues[0]?.message).toBe("weekOf");
    expect(promptText({ textEn: "A door", textEs: "Una puerta" }, "es")).toBe("Una puerta");
  });
});
