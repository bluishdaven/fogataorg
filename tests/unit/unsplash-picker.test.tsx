// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnsplashCredit } from "@/components/unsplash/unsplash-credit";
import { UnsplashPicker } from "@/components/unsplash/unsplash-picker";
import { normalizeUnsplashPhoto, unsplashApiPhotoSchema, type UnsplashPhoto } from "@/lib/domain/unsplash";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import { apiPhoto } from "./fixtures/unsplash";

const trackUnsplashSelection = vi.fn<(id: string) => Promise<{ ok: boolean }>>(async () => ({ ok: true }));
vi.mock("@/app/actions/unsplash", () => ({
  trackUnsplashSelection: (id: string) => trackUnsplashSelection(id),
}));

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  fetchMock.mockReset();
  trackUnsplashSelection.mockClear();
  vi.unstubAllGlobals();
});

const photo = (id: string, name = "Ana Ruiz") =>
  normalizeUnsplashPhoto(unsplashApiPhotoSchema.parse(apiPhoto({ id, user: { ...apiPhoto().user, name } })));

function renderPicker(onSelect: (p: UnsplashPhoto) => void, locale: "en" | "es" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : es} timeZone="UTC">
      <UnsplashPicker onSelect={onSelect} />
    </NextIntlClientProvider>,
  );
}

describe("UnsplashPicker", () => {
  it("searches, lets the writer pick a photo, and reports the pick to Unsplash", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    fetchMock.mockResolvedValue(Response.json({ photos: [photo("photo00001"), photo("photo00002", "Luis Mar")], totalPages: 1 }));
    renderPicker(onSelect);

    await user.click(screen.getByRole("button", { name: "Search Unsplash" }));
    await user.click(screen.getByRole("button", { name: "campfire" }));

    const url = new URL(String(fetchMock.mock.calls[0]![0]), "http://localhost");
    expect(url.pathname).toBe("/api/unsplash/search");
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "campfire", page: "1", locale: "en" });

    const tile = await screen.findByRole("button", {
      name: "Use photo by Luis Mar: people sitting around a campfire on the beach",
    });
    await user.click(tile);

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "photo00002" }));
    expect(trackUnsplashSelection).toHaveBeenCalledWith("photo00002");
    await waitFor(() => expect(screen.queryByTestId("unsplash-picker")).not.toBeInTheDocument());
  });

  it("debounces typing into a single search", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(Response.json({ photos: [], totalPages: 0 }));
    renderPicker(vi.fn(), "es");

    await user.click(screen.getByRole("button", { name: "Buscar en Unsplash" }));
    await user.type(screen.getByRole("searchbox", { name: "Buscar fotos" }), "montañas");

    expect(await screen.findByText("No hay fotos para «montañas». Prueba con otra palabra.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("loads more results without duplicates", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(Response.json({ photos: [photo("photo00001"), photo("photo00002")], totalPages: 2 }))
      .mockResolvedValueOnce(Response.json({ photos: [photo("photo00002"), photo("photo00003")], totalPages: 2 }));
    renderPicker(vi.fn());

    await user.click(screen.getByRole("button", { name: "Search Unsplash" }));
    await user.click(screen.getByRole("button", { name: "forest" }));
    await user.click(await screen.findByRole("button", { name: "More photos" }));

    await waitFor(() => expect(screen.getByTestId("unsplash-results").querySelectorAll("li")).toHaveLength(3));
    expect(screen.queryByRole("button", { name: "More photos" })).not.toBeInTheDocument();
  });

  it.each([
    ["unauthorized", 401, "Sign in to search photos."],
    ["not_configured", 503, "Photo search isn't set up yet."],
    ["rate_limited", 429, "We've reached Unsplash's hourly limit. Try again a little later."],
  ])("explains the %s error", async (error, status, message) => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(Response.json({ error }, { status }));
    renderPicker(vi.fn());

    await user.click(screen.getByRole("button", { name: "Search Unsplash" }));
    await user.click(screen.getByRole("button", { name: "ocean" }));
    expect(await screen.findByTestId("unsplash-message")).toHaveTextContent(message);
  });
});

describe("UnsplashCredit", () => {
  it("credits the photographer and Unsplash with referral links", () => {
    render(
      <NextIntlClientProvider locale="es" messages={es} timeZone="UTC">
        <UnsplashCredit
          credit={{
            source: "unsplash",
            photoId: "photo00001",
            authorName: "Ana Ruiz",
            authorUrl: "https://unsplash.com/@anaruiz_photo",
            photoUrl: "https://unsplash.com/photos/x-photo00001",
          }}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/Foto de/)).toHaveTextContent("Foto de Ana Ruiz en Unsplash");
    expect(screen.getByRole("link", { name: "Ana Ruiz" })).toHaveAttribute(
      "href",
      "https://unsplash.com/@anaruiz_photo?utm_source=fogata&utm_medium=referral",
    );
    expect(screen.getByRole("link", { name: "Unsplash" })).toHaveAttribute(
      "href",
      "https://unsplash.com/?utm_source=fogata&utm_medium=referral",
    );
  });
});
