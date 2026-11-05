// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { BadgeChips } from "@/components/badges/badge-guide";
import { UserBadges } from "@/components/badges/user-badges";
import {
  badgeData,
  donorGrantSchema,
  donorRemoveSchema,
  isAdminClaims,
  nextWritingTier,
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

  it("say how far the next tier is", () => {
    expect(nextWritingTier(0)).toEqual({ tier: WRITING_TIERS[0], remaining: 1 });
    expect(nextWritingTier(3)).toEqual({ tier: WRITING_TIERS[1], remaining: 2 });
    expect(nextWritingTier(5)).toEqual({ tier: WRITING_TIERS[2], remaining: 7 });
    expect(nextWritingTier(999)?.remaining).toBe(1);
    expect(nextWritingTier(1000)).toBeNull();
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

function renderBadges(badges: BadgeData, locale: "en" | "es" = "en", chips = false) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : es} timeZone="UTC">
      {chips ? <BadgeChips badges={badges} name="Dana" /> : <UserBadges badges={badges} />}
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
    renderBadges({ stories: 1000, donor: false }, "es", true);
    expect(screen.getByText("Fénix")).toBeInTheDocument();
    expect(screen.queryByText("Mecenas")).not.toBeInTheDocument();
  });
});

describe("BadgeChips", () => {
  it("explain a writing badge and list every badge, marking the ones earned", () => {
    renderBadges({ stories: 7, donor: false }, "en", true);
    fireEvent.click(screen.getByRole("button", { name: /^Candle/ }));
    const dialog = screen.getByRole("dialog", { name: "Candle" });
    expect(within(dialog).getByText("Earned by publishing 5 public stories on Fogata.")).toBeInTheDocument();
    expect(within(dialog).getByText("Dana has published 7 stories. 5 more stories to Flame.")).toBeInTheDocument();
    const ladder = within(dialog).getByTestId("badge-ladder");
    expect(within(ladder).getAllByRole("listitem")).toHaveLength(10);
    expect(ladder.querySelectorAll('[data-earned="true"]')).toHaveLength(2);
    expect(ladder.querySelector('[aria-current="true"]')).toHaveAttribute("data-tier", "candle");
    expect(dialog.querySelector('[data-tier="donor"]')).toHaveAttribute("data-earned", "false");
    expect(within(dialog).getByRole("link", { name: "Support Fogata" })).toHaveAttribute("target", "_blank");
  });

  it("explain the donor badge, in Spanish", () => {
    renderBadges({ stories: 1, donor: true }, "es", true);
    fireEvent.click(screen.getByRole("button", { name: /^Mecenas/ }));
    const dialog = screen.getByRole("dialog", { name: "Mecenas" });
    expect(within(dialog).getByText(/Cada donación enciende esta insignia durante dos meses/)).toBeInTheDocument();
    expect(within(dialog).getByText("Dana ha publicado 1 historia. Faltan 4 historias para Vela.")).toBeInTheDocument();
    expect(dialog.querySelector('[data-tier="donor"]')).toHaveAttribute("data-earned", "true");
  });
});
