"use client";

import { History } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { getStoryVersion, listStoryVersions, restoreStoryVersion, type VersionSummary } from "@/app/actions/versions";
import { StoryBody } from "@/components/story-body";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TiptapDoc } from "@/lib/domain/content";
import { allowedImagePrefixes } from "@/lib/story-images";
import { cn } from "@/lib/utils";

/** The editor's History button: earlier versions of this story, a preview, and Restore. */
export function VersionHistory({ storyId, language, live }: { storyId: string; language: string; live: boolean }) {
  const t = useTranslations("History");
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; subtitle: string; content: TiptapDoc } | null>(null);
  const [pending, startTransition] = useTransition();

  const show = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    setVersions(null);
    setSelected(null);
    setPreview(null);
    startTransition(async () => setVersions(await listStoryVersions(storyId)));
  };

  const pick = (id: string) => {
    setSelected(id);
    setPreview(null);
    startTransition(async () => setPreview(await getStoryVersion(id)));
  };

  const restore = () => {
    if (!selected || !window.confirm(live ? t("confirmLive") : t("confirm"))) return;
    startTransition(async () => {
      const result = await restoreStoryVersion({ storyId, versionId: selected });
      if (!result.ok) {
        toast.error(t("failed"));
        return;
      }
      window.localStorage.removeItem(`fogata:draft:${storyId}`);
      window.location.reload();
    });
  };

  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={t("open")} title={t("open")} onClick={() => show(true)} data-testid="open-history">
        <History className="size-5 sm:size-4" aria-hidden />
      </Button>
      <Dialog open={open} onOpenChange={show}>
        <DialogContent closeLabel={t("close")} className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-4xl" data-testid="history-dialog">
          <DialogHeader className="border-b border-border p-5">
            <DialogTitle className="font-serif text-xl">{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 flex-1 gap-0 sm:grid-cols-[16rem_1fr]">
            <ul className="max-h-60 overflow-y-auto border-b border-border p-2 sm:max-h-none sm:border-r sm:border-b-0" aria-label={t("list")} data-testid="history-list">
              {versions === null ? (
                <li className="h-24 animate-pulse rounded-lg bg-muted" aria-hidden />
              ) : versions.length === 0 ? (
                <li className="p-3 text-sm text-muted-foreground">{t("empty")}</li>
              ) : (
                versions.map((version) => (
                  <li key={version.id}>
                    <button
                      type="button"
                      onClick={() => pick(version.id)}
                      aria-pressed={selected === version.id}
                      className={cn(
                        "flex min-h-11 w-full flex-col items-start rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                        selected === version.id && "bg-ember-soft hover:bg-ember-soft",
                      )}
                      data-testid="history-version"
                    >
                      <span className="font-medium">
                        {format.dateTime(new Date(version.updatedAt), { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                      <span className="text-muted-foreground">
                        {version.kind === "published" ? `${t("published")} · ` : ""}
                        {t("words", { count: version.wordCount })}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            <div className="min-h-48 overflow-y-auto p-5" aria-live="polite">
              {preview ? (
                <article lang={language} data-testid="history-preview">
                  <h2 className="font-serif text-2xl font-semibold text-balance">{preview.title || t("untitled")}</h2>
                  {preview.subtitle ? <p className="mt-1 font-serif text-lg text-muted-foreground">{preview.subtitle}</p> : null}
                  <div className="mt-4 text-[0.95rem]">
                    <StoryBody doc={preview.content} lang={language} imagePrefixes={allowedImagePrefixes()} />
                  </div>
                </article>
              ) : selected ? (
                <div className="h-40 animate-pulse rounded-lg bg-muted" aria-hidden />
              ) : (
                <p className="text-sm text-muted-foreground">{t("pick")}</p>
              )}
            </div>
          </div>
          <DialogFooter className="border-t border-border p-4">
            <Button variant="ghost" onClick={() => show(false)}>
              {t("close")}
            </Button>
            <Button onClick={restore} disabled={!preview || pending} data-testid="restore-version">
              {t("restore")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
