"use client";

import { AudioLines, Headphones, Pause, Play, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { pickVoice, speechChunks, VOICE_STORAGE_PREFIX, voiceLabel, voiceProvider, voicesFor } from "@/lib/domain/listen";
import { scrollBehavior } from "@/lib/utils";

const SPEEDS = [0.8, 1, 1.25, 1.5] as const;
const STORY_BODY_ID = "story-body";

const subscribe = () => () => {};
const supported = () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

type Item = { block: HTMLElement; chunks: string[] };

// Voices arrive asynchronously ("voiceschanged"); getVoices() returns a new array every call, so
// keep the last one until the list really changes.
const NO_VOICES: SpeechSynthesisVoice[] = [];
let lastVoices = NO_VOICES;
let lastVoicesKey = "";
function voicesSnapshot(): SpeechSynthesisVoice[] {
  if (!supported()) return NO_VOICES;
  const list = window.speechSynthesis.getVoices();
  const key = list.map((voice) => voice.voiceURI).join("|");
  if (key !== lastVoicesKey) {
    lastVoicesKey = key;
    lastVoices = list;
  }
  return lastVoices;
}
function subscribeVoices(onChange: () => void) {
  if (!supported()) return () => {};
  const synth = window.speechSynthesis;
  synth.addEventListener?.("voiceschanged", onChange);
  return () => synth.removeEventListener?.("voiceschanged", onChange);
}

function readSavedVoice(lang: string): string | null {
  try {
    return window.localStorage.getItem(VOICE_STORAGE_PREFIX + lang);
  } catch {
    return null;
  }
}

function saveVoice(lang: string, uri: string | null) {
  try {
    if (uri) window.localStorage.setItem(VOICE_STORAGE_PREFIX + lang, uri);
    else window.localStorage.removeItem(VOICE_STORAGE_PREFIX + lang);
  } catch {
    // Private windows can refuse storage; the choice just lasts for this visit.
  }
}

/**
 * Listen mode: the browser's own speech (free) reads the story paragraph by paragraph, marking the
 * one being read and keeping it in view. It uses the most natural voice on the device; readers can
 * pick another, including the browser's online voices (labelled: the browser sends the text to its
 * maker to speak it), and the choice is remembered per language. Pausing cuts the current sentence;
 * resuming starts it again (more reliable across browsers than speechSynthesis.pause()).
 */
export function ListenMode({ lang }: { lang: string }) {
  const t = useTranslations("Listen");
  const available = useSyncExternalStore(subscribe, supported, () => false);
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [position, setPosition] = useState({ current: 0, total: 0 });
  const queue = useRef<Item[]>([]);
  const at = useRef({ block: 0, chunk: 0 });
  const run = useRef(0);
  const speedRef = useRef(speed);
  const allVoices = useSyncExternalStore(subscribeVoices, voicesSnapshot, () => NO_VOICES);
  const voices = useMemo(() => voicesFor(allVoices, lang), [allVoices, lang]);
  // Only shown once the player opens (client-side), so reading storage here can't break hydration.
  const [saved, setSaved] = useState<string | null>(() => (typeof window === "undefined" ? null : readSavedVoice(lang)));
  const [voicePanel, setVoicePanel] = useState(false);
  const panelId = useId();
  const voiceButton = useRef<HTMLButtonElement>(null);
  const voice = pickVoice(voices, saved);
  const voiceRef = useRef(voice);
  useEffect(() => {
    voiceRef.current = voice;
  });


  const mark = (block: HTMLElement | null) => {
    document.querySelectorAll("[data-listening]").forEach((element) => element.removeAttribute("data-listening"));
    if (!block) return;
    block.setAttribute("data-listening", "");
    const rect = block.getBoundingClientRect();
    if (rect.top < 120 || rect.bottom > window.innerHeight - 140) block.scrollIntoView({ block: "center", behavior: scrollBehavior() });
  };

  const stop = () => {
    run.current += 1;
    window.speechSynthesis.cancel();
    mark(null);
    setState("idle");
    setVoicePanel(false);
  };

  const speak = () => {
    const item = queue.current[at.current.block];
    if (!item) {
      stop();
      return;
    }
    const token = run.current;
    mark(item.block);
    setPosition({ current: at.current.block + 1, total: queue.current.length });
    const utterance = new SpeechSynthesisUtterance(item.chunks[at.current.chunk] ?? "");
    utterance.lang = lang;
    utterance.rate = speedRef.current;
    if (voiceRef.current) utterance.voice = voiceRef.current;
    utterance.onend = () => {
      if (token !== run.current) return;
      at.current.chunk += 1;
      if (at.current.chunk >= item.chunks.length) at.current = { block: at.current.block + 1, chunk: 0 };
      speak();
    };
    window.speechSynthesis.speak(utterance);
  };

  const start = () => {
    const root = document.getElementById(STORY_BODY_ID);
    if (!root) return;
    queue.current = Array.from(root.querySelectorAll<HTMLElement>(":scope > div > [data-block], :scope > [data-block]"))
      .filter((block) => block.tagName !== "FIGURE")
      .map((block) => ({ block, chunks: speechChunks(block.innerText) }))
      .filter((item) => item.chunks.length);
    // Start at the first paragraph on screen, so readers can jump in where they are.
    const first = queue.current.findIndex((item) => item.block.getBoundingClientRect().bottom > 140);
    at.current = { block: first > 0 ? first : 0, chunk: 0 };
    run.current += 1;
    window.speechSynthesis.cancel();
    setState("playing");
    speak();
  };

  const pause = () => {
    run.current += 1;
    window.speechSynthesis.cancel();
    setState("paused");
  };

  const resume = () => {
    run.current += 1;
    setState("playing");
    speak();
  };

  const changeSpeed = (next: (typeof SPEEDS)[number]) => {
    setSpeed(next);
    speedRef.current = next;
    if (state === "playing") resume();
  };

  // "" means the best voice on the device. A new voice takes over from the current sentence.
  const changeVoice = (uri: string) => {
    setSaved(uri || null);
    saveVoice(lang, uri || null);
    voiceRef.current = pickVoice(voices, uri || null);
    if (state === "playing") resume();
  };

  // Leaving the page stops the voice.
  useEffect(() => () => {
    if (supported()) window.speechSynthesis.cancel();
  }, []);

  if (!available) return null;
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => (state === "idle" ? start() : stop())}
        aria-pressed={state !== "idle"}
        aria-label={t("label")}
        data-testid="listen-button"
      >
        <Headphones />
        <span className="hidden sm:inline">{t("listen")}</span>
      </Button>
      {state !== "idle" ? (
        <div
          role="region"
          aria-label={t("player")}
          className="fixed bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4.5rem)] left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-background/95 px-2 py-1 font-sans text-sm shadow-xl backdrop-blur"
          data-testid="listen-player"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={state === "playing" ? pause : resume}
            aria-label={state === "playing" ? t("pause") : t("resume")}
            data-testid="listen-toggle"
          >
            {state === "playing" ? <Pause /> : <Play />}
          </Button>
          <span className="px-1 whitespace-nowrap text-muted-foreground tabular-nums" aria-live="polite" data-testid="listen-status">
            {state === "paused" ? t("paused") : t("progress", position)}
          </span>
          <label className="flex items-center">
            <span className="sr-only">{t("speed")}</span>
            <select
              value={speed}
              onChange={(event) => changeSpeed(Number(event.target.value) as (typeof SPEEDS)[number])}
              className="min-h-10 rounded-full bg-transparent px-2 sm:min-h-8"
              data-testid="listen-speed"
            >
              {SPEEDS.map((value) => (
                <option key={value} value={value}>
                  {value}×
                </option>
              ))}
            </select>
          </label>
          {voices.length ? (
            <Button
              ref={voiceButton}
              variant="ghost"
              size="icon-sm"
              onClick={() => setVoicePanel((open) => !open)}
              aria-label={t("voice")}
              aria-expanded={voicePanel}
              aria-controls={panelId}
              data-testid="listen-voice-button"
            >
              <AudioLines />
            </Button>
          ) : null}
          <Button variant="ghost" size="icon-sm" onClick={stop} aria-label={t("stop")} data-testid="listen-stop">
            <Square />
          </Button>
          {voicePanel && voices.length ? (
            <div
              id={panelId}
              className="absolute bottom-full left-1/2 mb-2 flex w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 rounded-2xl border border-border bg-popover p-3 text-popover-foreground shadow-xl"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setVoicePanel(false);
                  voiceButton.current?.focus();
                }
              }}
              data-testid="listen-voice-panel"
            >
              <label htmlFor={`${panelId}-select`} className="text-sm font-semibold">
                {t("voice")}
              </label>
              <select
                id={`${panelId}-select`}
                value={saved && voice?.voiceURI === saved ? saved : ""}
                onChange={(event) => changeVoice(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-base sm:min-h-9 sm:text-sm"
                data-testid="listen-voice"
              >
                <option value="">{t("bestVoice")}</option>
                {voices.some((v) => v.localService) ? (
                  <optgroup label={t("onDevice")}>
                    {voices
                      .filter((v) => v.localService)
                      .map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {voiceLabel(v)}
                        </option>
                      ))}
                  </optgroup>
                ) : null}
                {voices.some((v) => !v.localService) ? (
                  <optgroup label={t("online")}>
                    {voices
                      .filter((v) => !v.localService)
                      .map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {voiceLabel(v)}
                        </option>
                      ))}
                  </optgroup>
                ) : null}
              </select>
              <p className="text-xs text-muted-foreground" aria-live="polite" data-testid="listen-voice-note">
                {voice && !voice.localService
                  ? t("onlineNote", { provider: voiceProvider(voice) })
                  : voices.some((v) => !v.localService)
                    ? t("onlineHint")
                    : t("deviceNote")}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
