import { afterEach, describe, expect, it, vi } from "vitest";

describe("isPublicSite", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each([
    ["production", true],
    ["preview", false],
    ["development", false],
    ["", false],
  ])("VERCEL_ENV=%j → %s", async (value, expected) => {
    vi.stubEnv("VERCEL_ENV", value);
    vi.resetModules();
    const { isPublicSite } = await import("@/lib/deployment");
    expect(isPublicSite).toBe(expected);
  });
});
