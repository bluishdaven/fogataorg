// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { NsfwGate } from "@/components/moderation/nsfw-gate";
import { StoryCard, type StoryCardData } from "@/components/story-card";
import { moderateStorySchema } from "@/lib/domain/moderation";
import en from "../../messages/en.json";
import es from "../../messages/es.json";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

describe("moderateStorySchema", () => {
  it("requires a reason to mark or remove, but not to lift", () => {
    expect(moderateStorySchema.safeParse({ storyId: ID, status: "nsfw", reason: "Explicit" }).success).toBe(true);
    expect(moderateStorySchema.safeParse({ storyId: ID, status: null }).success).toBe(true);
    const missing = moderateStorySchema.safeParse({ storyId: ID, status: "removed", reason: "   " });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.message).toBe("reasonRequired");
    expect(moderateStorySchema.safeParse({ storyId: ID, status: "removed", reason: "x".repeat(301) }).success).toBe(false);
    expect(moderateStorySchema.safeParse({ storyId: ID, status: "banned", reason: "x" }).success).toBe(false);
  });
});

const story: StoryCardData = {
  title: "A heavy night",
  subtitle: "",
  slug: "a-heavy-night",
  language: "en",
  readingTime: 3,
  publishedAt: new Date("2026-11-03T15:00:00Z"),
  excerpt: "…",
  thumbnail: null,
  nsfw: true,
  author: { username: "dana", displayName: "Dana" },
};

function wrap(ui: React.ReactNode, locale: "en" | "es" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : es} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("NSFW stories", () => {
  it("are labelled in lists", () => {
    wrap(<StoryCard story={story} />);
    expect(screen.getByTestId("nsfw-label")).toHaveTextContent("NSFW");
  });

  it("open behind a warning that gives the moderator's reason", () => {
    wrap(
      <NsfwGate reason="Graphic violence">
        <p>The story text</p>
      </NsfwGate>,
      "es",
    );
    expect(screen.getByText("Marcada como NSFW. Motivo: Graphic violence")).toBeInTheDocument();
    expect(screen.getByTestId("nsfw-content")).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar la historia" }));
    expect(screen.queryByTestId("nsfw-gate")).not.toBeInTheDocument();
    expect(screen.getByText("The story text")).toBeVisible();
  });
});
