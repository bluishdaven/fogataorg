"use client";

import { WifiOff, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { parseOfflineList } from "@/lib/domain/app";
import { OFFLINE_EVENT, offlineListRaw, removeStory, serviceWorkerWanted } from "@/lib/offline";

function subscribeList(listener: () => void) {
  window.addEventListener(OFFLINE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(OFFLINE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

/** The device's downloaded stories, linked with plain `<a>` so the service worker can answer offline. */
export function OfflineList() {
  const t = useTranslations("Offline");
  const locale = useLocale();
  // undefined while server rendering: the list only exists on the device.
  const raw = useSyncExternalStore(subscribeList, offlineListRaw, () => undefined);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const supported = useSyncExternalStore(subscribeList, serviceWorkerWanted, () => true);
  const stories = useMemo(() => (raw === undefined ? null : parseOfflineList(raw)), [raw]);
  const format = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }), [locale]);

  if (stories === null) return <div className="h-40 animate-pulse rounded-xl bg-muted" aria-hidden />;

  return (
    <div className="flex flex-col gap-6">
      {!online ? (
        <p className="flex items-center gap-2 rounded-xl border border-border bg-muted px-4 py-3 text-sm font-medium" role="status" data-testid="offline-banner">
          <WifiOff aria-hidden className="size-4 shrink-0" />
          {t("offlineNow")}
        </p>
      ) : null}
      {!supported ? <p className="text-muted-foreground">{t("unsupported")}</p> : null}
      {stories.length ? (
        <ul className="divide-y divide-border border-y border-border" data-testid="offline-stories">
          {stories.map((story) => (
            <li key={story.url} className="flex items-center gap-3 py-4">
              <a href={story.url} className="min-w-0 flex-1 rounded-md">
                <span className="block font-serif text-lg leading-snug font-semibold text-pretty">{story.title}</span>
                <span className="block text-sm text-muted-foreground">
                  {story.author} · {t("savedAt", { date: format.format(new Date(story.savedAt)) })}
                </span>
              </a>
              <Button variant="ghost" size="icon" aria-label={t("remove", { title: story.title })} onClick={() => void removeStory(story.url)}>
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : supported ? (
        <p className="text-muted-foreground" data-testid="offline-empty">
          {t("empty")}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">{t("note")}</p>
      {online ? (
        <Link href="/me/saved" className="self-start text-sm font-medium text-ember-text underline underline-offset-4 hover:text-foreground">
          {t("savedLink")}
        </Link>
      ) : null}
    </div>
  );
}
