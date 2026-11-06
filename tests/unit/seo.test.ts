import { describe, expect, it } from "vitest";
import { ogPaths } from "@/lib/domain/og";
import { AI_TRAINING_CRAWLERS, jsonLd, localeAlternates, RIGHTS_RESERVED_HEADERS, robotsPolicy } from "@/lib/domain/seo";

describe("SEO rules", () => {
  it("give localized pages a self canonical and every language version", () => {
    expect(localeAlternates("es", "/topics")).toEqual({
      canonical: "/es/topics",
      languages: { en: "/en/topics", es: "/es/topics", "x-default": "/en/topics" },
    });
    expect(localeAlternates("en", "/")).toEqual({
      canonical: "/en",
      languages: { en: "/en", es: "/es", "x-default": "/en" },
    });
  });

  it("let crawlers into the public site but keep private areas and previews out", () => {
    const pub = robotsPolicy(true, "https://fogata.org/");
    expect(pub.sitemap).toBe("https://fogata.org/sitemap.xml");
    expect(pub.rules[0]).toMatchObject({ userAgent: "*", allow: expect.arrayContaining(["/", "/api/og/"]) });
    expect(pub.rules[0]?.disallow).toEqual(expect.arrayContaining(["/api/", "/*/settings/", "/*/write"]));
    expect(robotsPolicy(false, "https://preview.example")).toEqual({ rules: [{ userAgent: "*", disallow: ["/"] }] });
  });

  it("turn AI training crawlers away but keep search engines, previews and AI search", () => {
    const training = robotsPolicy(true, "https://fogata.org").rules[1];
    expect(training?.disallow).toEqual(["/"]);
    expect(training?.userAgent).toEqual(expect.arrayContaining(["GPTBot", "ClaudeBot", "Google-Extended", "CCBot", "Applebot-Extended"]));
    for (const keep of ["Googlebot", "Bingbot", "facebookexternalhit", "Twitterbot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot"]) {
      expect(AI_TRAINING_CRAWLERS as readonly string[]).not.toContain(keep);
    }
  });

  it("reserve text and data mining rights on every response", () => {
    expect(RIGHTS_RESERVED_HEADERS).toEqual(expect.arrayContaining([{ key: "tdm-reservation", value: "1" }]));
  });

  it("serialize structured data so user text can't end the script", () => {
    const out = jsonLd({ headline: "</script><script>alert(1)</script> & \u2028 more" });
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain("\u2028");
    expect(JSON.parse(out)).toEqual({ headline: "</script><script>alert(1)</script> & \u2028 more" });
  });

  it("build circle preview URLs", () => {
    expect(ogPaths.circle("lake-notes", "v1")).toBe("/api/og/circle/lake-notes?v=v1");
  });
});
