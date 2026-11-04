import { describe, expect, it } from "vitest";
import {
  matchInternalHandlePath,
  matchPublicHandlePath,
  profilePath,
  publicHandlePath,
  storyPath,
  toInternalHandlePath,
} from "@/lib/domain/handle-routes";

describe("matchPublicHandlePath", () => {
  it("matches profiles and stories", () => {
    expect(matchPublicHandlePath("/@lucia_ortega")).toEqual({ handle: "lucia_ortega" });
    expect(matchPublicHandlePath("/@lucia_ortega/el-mole-de-mi-abuela")).toEqual({
      handle: "lucia_ortega",
      slug: "el-mole-de-mi-abuela",
    });
  });

  it("accepts an encoded @ and a trailing slash", () => {
    expect(matchPublicHandlePath("/%40Dana/")).toEqual({ handle: "Dana" });
  });

  it("rejects invalid handles, slugs and deeper paths", () => {
    expect(matchPublicHandlePath("/@ab")).toBeNull();
    expect(matchPublicHandlePath("/@has-dash")).toBeNull();
    expect(matchPublicHandlePath("/@user/Upper-Case")).toBeNull();
    expect(matchPublicHandlePath("/@user/slug/extra")).toBeNull();
    expect(matchPublicHandlePath("/en/@user")).toBeNull();
    expect(matchPublicHandlePath("/user")).toBeNull();
  });
});

describe("internal paths", () => {
  it("maps share URLs into the locale tree", () => {
    expect(toInternalHandlePath("es", { handle: "dana" })).toBe("/es/u/dana");
    expect(toInternalHandlePath("en", { handle: "dana", slug: "heron" })).toBe("/en/u/dana/heron");
  });

  it("recognises internal paths so they can be redirected", () => {
    expect(matchInternalHandlePath("/en/u/dana/heron")).toEqual({
      locale: "en",
      route: { handle: "dana", slug: "heron" },
    });
    expect(matchInternalHandlePath("/fr/u/dana")).toBeNull();
    expect(matchInternalHandlePath("/en/users/dana")).toBeNull();
  });

  it("round-trips back to the public URL", () => {
    const match = matchInternalHandlePath("/es/u/dana/heron");
    expect(match && publicHandlePath(match.route)).toBe("/@dana/heron");
  });
});

describe("path builders", () => {
  it("builds share URLs", () => {
    expect(profilePath("dana")).toBe("/@dana");
    expect(storyPath("dana", "heron")).toBe("/@dana/heron");
  });
});
