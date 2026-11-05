import { describe, expect, it } from "vitest";
import {
  avatarPath,
  avatarPrefix,
  avatarUpdateSchema,
  centerSquare,
  initials,
  isAvatarUrl,
  isOwnAvatarUrl,
} from "@/lib/domain/avatars";

const SUPABASE = "https://abc.supabase.co";
const USER = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const OTHER = "00000000-0000-4000-8000-000000000000";
const FILE = "1f2e3d4c-5b6a-4789-8a7b-6c5d4e3f2a1b.webp";
const url = (owner: string, file = FILE) => `${avatarPrefix(SUPABASE)}${owner}/${file}`;

describe("avatar URLs", () => {
  it("accept only files in our avatars bucket, shaped <user id>/<uuid>.webp", () => {
    expect(avatarPrefix(`${SUPABASE}/`)).toBe(`${SUPABASE}/storage/v1/object/public/avatars/`);
    expect(avatarPath(url(USER), SUPABASE)).toBe(`${USER}/${FILE}`);
    expect(isAvatarUrl(url(OTHER), SUPABASE)).toBe(true);

    expect(isAvatarUrl(null, SUPABASE)).toBe(false);
    expect(isAvatarUrl("https://evil.example/pixel.gif", SUPABASE)).toBe(false);
    expect(isAvatarUrl(url(USER).replace("avatars", "story-images"), SUPABASE)).toBe(false);
    expect(isAvatarUrl(url(USER, "photo.png"), SUPABASE)).toBe(false);
    expect(isAvatarUrl(`${url(USER)}?x=1`, SUPABASE)).toBe(false);
    expect(isAvatarUrl(`${avatarPrefix(SUPABASE)}${USER}/../${OTHER}/${FILE}`, SUPABASE)).toBe(false);
    expect(isAvatarUrl(`${avatarPrefix(SUPABASE)}${FILE}`, SUPABASE)).toBe(false);
  });

  it("let people save only photos from their own folder", () => {
    expect(isOwnAvatarUrl(url(USER), SUPABASE, USER)).toBe(true);
    expect(isOwnAvatarUrl(url(OTHER), SUPABASE, USER)).toBe(false);
    expect(isOwnAvatarUrl(url(USER), "https://other.supabase.co", USER)).toBe(false);
  });

  it("validate the action input", () => {
    expect(avatarUpdateSchema.safeParse({ avatarUrl: null }).success).toBe(true);
    expect(avatarUpdateSchema.safeParse({ avatarUrl: url(USER) }).success).toBe(true);
    expect(avatarUpdateSchema.safeParse({ avatarUrl: "x".repeat(501) }).success).toBe(false);
    expect(avatarUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("centerSquare", () => {
  it("cuts the middle of landscape and portrait photos", () => {
    expect(centerSquare(4000, 3000)).toEqual({ x: 500, y: 0, side: 3000 });
    expect(centerSquare(1080, 1920)).toEqual({ x: 0, y: 420, side: 1080 });
    expect(centerSquare(512, 512)).toEqual({ x: 0, y: 0, side: 512 });
  });
});

describe("initials", () => {
  it("uses first and last names, or the first two letters", () => {
    expect(initials("Dana Whitfield")).toBe("DW");
    expect(initials("María José de la Cruz")).toBe("MC");
    expect(initials("lucia_ortega")).toBe("LU");
    expect(initials("Ángel")).toBe("ÁN");
    expect(initials("  ")).toBe("?");
  });
});
