// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { UserBadges } from "@/components/badges/user-badges";
import {
  badgeData,
  donorGrantSchema,
  donorRemoveSchema,
  isAdminClaims,
  WRITING_TIERS,
  writingTier,
  type BadgeData,
} from "@/lib/domain/badges";
import en from "../../messages/en.json";
import es from "../../messages/es.json";

describe("writing tiers", () => {
  it("climb from 1 to 1,000 published stories, each step harder than the last", () => {
    expect(WRITING_TIERS.map((tier) => tier.min)).toEqual([1, 5, 12, 25, 50, 100, 200, 350, 600, 1000]);
    for (let i = 2; i < WRITING_TIERS.length; i += 1) {
      const gap = WRITING_TIERS[i]!.min - WRITING_TIERS[i - 1]!.min;
      const previousGap = WRITING_TIERS[i - 1]!.min - WRITING_TIERS[i - 2]!.min;
      expect(gap).toBeGreaterThan(previousGap);
    }
  });

  it("give the highest tier reached, and nothing before the first story", () => {
    expect(writingTier(0)).toBeNull();
    expect(writingTier(1)?.key).toBe("kindling");
    expect(writingTier(4)?.key).toBe("kindling");
    expect(writingTier(5)?.key).toBe("candle");
    expect(writingTier(11)?.key).toBe("candle");
    expect(writingTier(12)?.key).toBe("flame");
    expect(writingTier(99)?.key).toBe("hearth");
    expect(writingTier(100)?.key).toBe("bonfire");
    expect(writingTier(999)?.key).toBe("sun");
    expect(writingTier(1000)?.key).toBe("phoenix");
    expect(writingTier(12_345)?.key).toBe("phoenix");
  });

  it("are read from query rows", () => {
    expect(badgeData({ publishedCount: 7, donorActive: false })).toEqual({ stories: 7, donor: false });
    expect(badgeData({ publishedCount: null, donorActive: true })).toEqual({ stories: 0, donor: true });
    expect(badgeData({ publishedCount: 3, donorActive: null })).toEqual({ stories: 3, donor: false });
  });
});

describe("donor admin rules", () => {
  it("recognize admins only from app_metadata", () => {
    expect(isAdminClaims({ sub: "x", app_metadata: { role: "admin" } })).toBe(true);
    expect(isAdminClaims({ sub: "x", user_metadata: { role: "admin" } })).toBe(false);
    expect(isAdminClaims({ sub: "x", app_metadata: { role: "user" } })).toBe(false);
    expect(isAdminClaims(null)).toBe(false);
  });

  it("validate grant and removal input", () => {
    expect(donorGrantSchema.parse({ target: "  @dana  " })).toEqual({ target: "@dana", note: "" });
    expect(donorGrantSchema.safeParse({ target: "", note: "" }).success).toBe(false);
    expect(donorGrantSchema.safeParse({ target: "dana", note: "x".repeat(501) }).success).toBe(false);
    expect(donorRemoveSchema.safeParse({ userId: "not-a-uuid" }).success).toBe(false);
  });
});

function renderBadges(badges: BadgeData, locale: "en" | "es" = "en", variant?: "chips") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : es} timeZone="UTC">
      <UserBadges badges={badges} variant={variant} />
    </NextIntlClientProvider>,
  );
}

describe("UserBadges", () => {
  it("shows nothing before the first story", () => {
    const { container } = renderBadges({ stories: 0, donor: false });
    expect(container).toBeEmptyDOMElement();
  });

  it("labels each badge for screen readers, in the reader's language", () => {
    renderBadges({ stories: 120, donor: true });
    expect(screen.getByRole("img", { name: "Bonfire: 100+ published stories" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Firekeeper: supports Fogata with a donation" })).toBeInTheDocument();
  });

  it("speaks Spanish", () => {
    renderBadges({ stories: 1, donor: true }, "es");
    expect(screen.getByRole("img", { name: "Yesca: primera historia publicada" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Mecenas: apoya a Fogata con una donación" })).toBeInTheDocument();
  });

  it("shows labeled chips on profiles", () => {
    renderBadges({ stories: 1000, donor: false }, "es", "chips");
    expect(screen.getByText("Fénix")).toBeInTheDocument();
    expect(screen.queryByText("Mecenas")).not.toBeInTheDocument();
  });
});
