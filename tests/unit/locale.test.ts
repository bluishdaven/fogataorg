import { describe, expect, it } from "vitest";
import { isLocale, parseAcceptLanguage, pathForLocale, resolveLocale } from "@/lib/domain/locale";

describe("isLocale", () => {
  it("accepts only supported locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("es")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("ES")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("parseAcceptLanguage", () => {
  it("orders by q value, keeping header order for ties", () => {
    expect(parseAcceptLanguage("en-US;q=0.7, es-MX, fr;q=0.9")).toEqual(["es-mx", "fr", "en-us"]);
  });

  it("drops q=0, wildcards and junk", () => {
    expect(parseAcceptLanguage("es;q=0, *, ;q=1, en")).toEqual(["en"]);
    expect(parseAcceptLanguage(null)).toEqual([]);
  });
});

describe("resolveLocale", () => {
  it("prefers a valid cookie over the browser language", () => {
    expect(resolveLocale({ cookie: "es", acceptLanguage: "en-US" })).toBe("es");
  });

  it("ignores an invalid cookie", () => {
    expect(resolveLocale({ cookie: "de", acceptLanguage: "es-AR,es;q=0.9" })).toBe("es");
  });

  it("matches regional variants to the base language", () => {
    expect(resolveLocale({ acceptLanguage: "es-MX" })).toBe("es");
    expect(resolveLocale({ acceptLanguage: "en-GB" })).toBe("en");
  });

  it("skips unsupported languages to find a supported one", () => {
    expect(resolveLocale({ acceptLanguage: "pt-BR, es;q=0.8, en;q=0.5" })).toBe("es");
  });

  it("falls back to English", () => {
    expect(resolveLocale({ acceptLanguage: "ja" })).toBe("en");
    expect(resolveLocale({})).toBe("en");
  });
});

describe("pathForLocale", () => {
  it("swaps the locale prefix on UI paths", () => {
    expect(pathForLocale("/en", "es")).toBe("/es");
    expect(pathForLocale("/en/design", "es")).toBe("/es/design");
    expect(pathForLocale("/es/login", "en")).toBe("/en/login");
  });

  it("does not touch paths that merely start with a locale-like word", () => {
    expect(pathForLocale("/english", "es")).toBe("/es/english");
  });

  it("leaves share URLs alone", () => {
    expect(pathForLocale("/@lucia_ortega/el-mole", "en")).toBe("/@lucia_ortega/el-mole");
  });
});
