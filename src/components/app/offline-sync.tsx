"use client";

import { CloudDownload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { getOfflineStories } from "@/app/actions/social";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { OFFLINE_SAVED_LIMIT } from "@/lib/domain/app";
import { serviceWorkerWanted, syncStories } from "@/lib/offline";

const noop = () => () => {};

/** "Keep saved stories offline" on the Saved page: downloads the newest saved stories to this device. */
export function OfflineSync() {
  const t = useTranslations("Offline");
  const supported = useSyncExternalStore(noop, serviceWorkerWanted, () => false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<number | null>(null);

  if (!supported) return null;

  const sync = async () => {
    setResult(null);
    const list = await getOfflineStories();
    if (!list.ok) {
      setResult(0);
      return;
    }
    setProgress({ done: 0, total: list.stories.length });
    const kept = await syncStories(list.stories, (done) => setProgress({ done, total: list.stories.length }));
    setProgress(null);
    setResult(kept);
  };

  return (
    <div className="mb-8 flex flex-col gap-2 rounded-xl border border-border p-4" data-testid="offline-sync">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => void sync()} disabled={progress !== null} data-testid="offline-sync-button">
          <CloudDownload aria-hidden />
          {t("sync")}
        </Button>
        <Link href="/offline" className="text-sm font-medium text-ember-text underline underline-offset-4 hover:text-foreground">
          {t("seeOffline")}
        </Link>
      </div>
      <p className="text-sm text-muted-foreground" role="status" data-testid="offline-sync-status">
        {progress ? t("syncing", progress) : result !== null ? t("synced", { count: result }) : t("syncHint", { limit: OFFLINE_SAVED_LIMIT })}
      </p>
    </div>
  );
}
