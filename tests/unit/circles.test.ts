import { describe, expect, it } from "vitest";
import {
  ACCENT_PRESETS,
  addMemberSchema,
  contrastRatio,
  createCircleSchema,
  readableTextOn,
  relativeLuminance,
} from "@/lib/domain/circles";

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

describe("addMemberSchema", () => {
  it("accepts usernames with or without @", () => {
    const id = "0b9f6a52-8f0e-4c55-9d7a-2f4b1c3d5e6f";
    expect(addMemberSchema.parse({ circleId: id, username: "@lucia_ortega", role: "editor" }).username).toBe("lucia_ortega");
    expect(addMemberSchema.safeParse({ circleId: id, username: "x", role: "editor" }).success).toBe(false);
    expect(addMemberSchema.safeParse({ circleId: id, username: "lucia", role: "owner" }).success).toBe(false);
  });
});
