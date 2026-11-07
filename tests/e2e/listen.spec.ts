import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** A silent stand-in for the browser's speech: records what it was asked to say, and with which voice. */
function fakeSpeech() {
  const spoken: { text: string; lang: string; rate: number; voice: string | null }[] = [];
  (window as unknown as { __spoken: typeof spoken }).__spoken = spoken;
  let current: { onend: (() => void) | null } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const voice = (name: string, lang: string, localService: boolean, isDefault = false) => ({
    name,
    lang,
    localService,
    default: isDefault,
    voiceURI: `fake:${name}`,
  });
  const voices = [
    voice("Fred", "en-US", true),
    voice("Bubbles", "en-US", true),
    voice("Samantha", "en-US", true, true),
    voice("Google US English", "en-US", false),
    voice("Mónica", "es-ES", true),
  ];
  class FakeUtterance {
    lang = "";
    rate = 1;
    voice: { name: string } | null = null;
    onend: (() => void) | null = null;
    constructor(public text: string) {}
  }
  const synth = {
    speak(utterance: FakeUtterance) {
      spoken.push({ text: utterance.text, lang: utterance.lang, rate: utterance.rate, voice: utterance.voice?.name ?? null });
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
    getVoices: () => voices,
    addEventListener() {},
    removeEventListener() {},
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
  const spoken = await page.evaluate(() => (window as unknown as { __spoken: { text: string; lang: string; rate: number }[] }).__spoken);
  // A little slower than the voice's own pace by default.
  expect(spoken[0]).toMatchObject({ lang: "en", rate: 0.8 });
  await expect(page.getByTestId("listen-speed")).toHaveValue("0.8");
  // A small fire burns while it reads.
  await expect(player).toHaveAttribute("data-playing", "true");
  await expect(page.getByTestId("listen-fire")).toBeVisible();
  expect(spoken[0]!.text).toContain("There is a great blue heron");
  expect(await new AxeBuilder({ page }).include("[data-testid=listen-player]").analyze().then((r) => r.violations.map((v) => v.id))).toEqual([]);

  await page.getByTestId("listen-toggle").click();
  await expect(page.getByTestId("listen-status")).toHaveText("Paused");
  await expect(player).toHaveAttribute("data-playing", "false");
  await page.getByTestId("listen-speed").selectOption("1.5");
  await page.getByTestId("listen-toggle").click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: { rate: number }[] }).__spoken.at(-1)?.rate)).toBe(1.5);

  await page.getByTestId("listen-stop").click();
  await expect(player).toHaveCount(0);
  await expect(page.locator("#story-body [data-listening]")).toHaveCount(0);
});

test("readers pick a voice: device voices first, online ones labelled, the choice remembered", async ({ page }) => {
  await page.addInitScript(fakeSpeech);
  await page.goto("/@danawrites/the-heron-knows-something-i-dont");
  await page.getByTestId("listen-button").click();
  const lastVoice = () => page.evaluate(() => (window as unknown as { __spoken: { voice: string | null }[] }).__spoken.at(-1)?.voice);
  const toggle = page.getByTestId("listen-toggle");
  // The most natural voice on the device reads by default (not the robotic one, never an online one).
  await expect.poll(lastVoice).toBe("Samantha");
  // Paused, so the short story doesn't finish (and close the player) while we look around.
  await toggle.click();

  await page.getByTestId("listen-voice-button").click();
  const select = page.getByTestId("listen-voice");
  await expect(select.locator("optgroup")).toHaveCount(2);
  await expect(select.locator("optgroup[label='On this device'] option")).toHaveText(["Samantha · US", "Fred · US"]);
  await expect(select.locator("optgroup[label='Online'] option")).toHaveText(["Google US English"]);
  await expect(select.locator("option", { hasText: "Bubbles" })).toHaveCount(0);
  await expect(page.getByTestId("listen-voice-note")).toHaveText(/Online voices often sound more natural/);
  expect(await new AxeBuilder({ page }).include("[data-testid=listen-player]").analyze().then((r) => r.violations.map((v) => v.id))).toEqual([]);

  await select.selectOption({ label: "Google US English" });
  await expect(page.getByTestId("listen-voice-note")).toHaveText(
    "Online voice: your browser sends what's being read to Google to speak it. Fogata sends nothing.",
  );
  await toggle.click();
  await expect.poll(lastVoice).toBe("Google US English");

  // Remembered on the next visit; "Best on this device" goes back to the automatic choice.
  await page.reload();
  await page.getByTestId("listen-button").click();
  await expect.poll(lastVoice).toBe("Google US English");
  await toggle.click();
  await page.getByTestId("listen-voice-button").click();
  await page.getByTestId("listen-voice").selectOption({ label: "Best on this device" });
  await toggle.click();
  await expect.poll(lastVoice).toBe("Samantha");
  await toggle.click();

  // Escape closes the menu and puts focus back on its button.
  await page.getByTestId("listen-voice").focus();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("listen-voice-panel")).toHaveCount(0);
  await expect(page.getByTestId("listen-voice-button")).toBeFocused();
});
