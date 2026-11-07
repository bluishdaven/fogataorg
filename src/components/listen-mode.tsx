"use client";

import { Headphones, Pause, Play, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { speechChunks } from "@/lib/domain/listen";
import { scrollBehavior } from "@/lib/utils";

const SPEEDS = [0.8, 1, 1.25, 1.5] as const;
const STORY_BODY_ID = "story-body";

const subscribe = () => () => {};
const supported = () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

type Item = { block: HTMLElement; chunks: string[] };

/** The best installed voice for the story's language: the default one if it matches, else a local one. */
function voiceFor(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith(lang));
  return voices.find((voice) => voice.default) ?? voices.find((voice) => voice.localService) ?? voices[0] ?? null;
}

/**
 * Listen mode: the browser's own speech (free, on the device, nothing sent anywhere) reads the
 * story paragraph by paragraph, marking the one being read and keeping it in view. Pausing stops
 * after the current sentence is cut; resuming starts that sentence again (more reliable across
 * browsers than speechSynthesis.pause()).
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
    const voice = voiceFor(lang);
    if (voice) utterance.voice = voice;
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
          <Button variant="ghost" size="icon-sm" onClick={stop} aria-label={t("stop")} data-testid="listen-stop">
            <Square />
          </Button>
        </div>
      ) : null}
    </>
  );
}
