// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { StoryCard, type StoryCardData } from "@/components/story-card";
import en from "../../messages/en.json";
import es from "../../messages/es.json";

const story: StoryCardData = {
  title: "The heron knows something I don't",
  subtitle: "On standing still as a practice.",
  slug: "the-heron-knows-something-i-dont",
  language: "en",
  readingTime: 4,
  publishedAt: new Date("2026-11-03T15:00:00Z"),
  excerpt: "There is a great blue heron…",
  author: { username: "danawrites", displayName: "Dana Whitfield" },
};

function renderIn(locale: "en" | "es") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : es} timeZone="UTC">
      <StoryCard story={story} />
    </NextIntlClientProvider>,
  );
}

describe("StoryCard", () => {
  it("links to the unprefixed share URL", () => {
    renderIn("en");
    expect(screen.getByRole("link", { name: story.title })).toHaveAttribute(
      "href",
      "/@danawrites/the-heron-knows-something-i-dont",
    );
  });

  it("shows metadata in the reader's UI language", () => {
    renderIn("es");
    expect(screen.getByText("4 min de lectura")).toBeInTheDocument();
    expect(screen.getByText("EN")).toHaveAttribute("title", "Escrita en inglés");
    expect(screen.getByText("3 nov 2026")).toBeInTheDocument();
  });

  it("marks the title with the story's own language", () => {
    renderIn("es");
    expect(screen.getByRole("heading", { level: 3 })).toHaveAttribute("lang", "en");
  });
});
