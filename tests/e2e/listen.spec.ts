import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** A silent stand-in for the browser's speech: records what it was asked to say. */
function fakeSpeech() {
  const spoken: { text: string; lang: string; rate: number }[] = [];
  (window as unknown as { __spoken: typeof spoken }).__spoken = spoken;
  let current: { onend: (() => void) | null } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  class FakeUtterance {
    lang = "";
    rate = 1;
    voice = null;
    onend: (() => void) | null = null;
    constructor(public text: string) {}
  }
  const synth = {
    speak(utterance: FakeUtterance) {
      spoken.push({ text: utterance.text, lang: utterance.lang, rate: utterance.rate });
      current = utterance;
      timer = setTimeout(() => {
        if (current === utterance) {
          current = null;
          utterance.onend?.();
        }
      }, 300);
    },
    cancel() {
      clearTimeout(timer);
      current = null;
    },
    getVoices: () => [],
    pause() {},
    resume() {},
  };
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  Object.defineProperty(window, "SpeechSynthesisUtterance", { value: FakeUtterance, configurable: true });
}

test("listen mode reads the story aloud, paragraph by paragraph, and can pause, speed up and stop", async ({ page }) => {
  await page.addInitScript(fakeSpeech);
  await page.goto("/@danawrites/the-heron-knows-something-i-dont");
  await page.getByTestId("listen-button").click();
  const player = page.getByTestId("listen-player");
  await expect(player).toBeVisible();
  await expect(page.getByTestId("listen-status")).toHaveText(/^Paragraph 1 of \d+$/);
  await expect(page.locator("#story-body [data-listening]")).toContainText("There is a great blue heron");
  await expect(page.getByTestId("listen-status")).toHaveText(/^Paragraph 2 of \d+$/, { timeout: 5_000 });
  const spoken = await page.evaluate(() => (window as unknown as { __spoken: { text: string; lang: string }[] }).__spoken);
  expect(spoken[0]).toMatchObject({ lang: "en" });
  expect(spoken[0]!.text).toContain("There is a great blue heron");
  expect(await new AxeBuilder({ page }).include("[data-testid=listen-player]").analyze().then((r) => r.violations.map((v) => v.id))).toEqual([]);

  await page.getByTestId("listen-toggle").click();
  await expect(page.getByTestId("listen-status")).toHaveText("Paused");
  await page.getByTestId("listen-speed").selectOption("1.5");
  await page.getByTestId("listen-toggle").click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: { rate: number }[] }).__spoken.at(-1)?.rate)).toBe(1.5);

  await page.getByTestId("listen-stop").click();
  await expect(player).toHaveCount(0);
  await expect(page.locator("#story-body [data-listening]")).toHaveCount(0);
});
