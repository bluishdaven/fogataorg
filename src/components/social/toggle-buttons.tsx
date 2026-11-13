"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Popover } from "radix-ui";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { createReadingList, getSaveLists, setBookmark, setFollow } from "@/app/actions/social";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { READING_LIST_NAME_MAX } from "@/lib/domain/social";
import { downloadStory, offlineReady, offlineStories, removeStory } from "@/lib/offline";
import { cn } from "@/lib/utils";

type ListChoice = { id: string | null; name: string };

/**
 * Save for later ("Leña guardada"). One tap saves to the default Saved list and opens a small menu
 * to tick other reading lists, start a new one, or untick everything. Optimistic; rolls back on
 * failure.
 */
export function SaveButton({
  storyId,
  initialSaved,
  signedIn,
  loginHref,
  offline,
}: {
  storyId: string;
  initialSaved: boolean;
  signedIn: boolean;
  loginHref: string;
  /** Saved stories are also kept on the device for reading offline (when the app's worker runs). */
  offline?: { url: string; title: string; author: string };
}) {
  const t = useTranslations("Social");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<ListChoice[] | null>(null);
  const [inLists, setInLists] = useState<Set<string | null>>(() => new Set(initialSaved ? [null] : []));
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const saved = inLists.size > 0;
  useKeepOffline(saved, offline);

  const toggleList = async (listId: string | null, next: boolean) => {
    setInLists((current) => {
      const copy = new Set(current);
      if (next) copy.add(listId);
      else copy.delete(listId);
      return copy;
    });
    const result = await setBookmark({ storyId, saved: next, listId });
    if (!result.ok) {
      setInLists((current) => {
        const copy = new Set(current);
        if (next) copy.delete(listId);
        else copy.add(listId);
        return copy;
      });
      toast.error(t("saveFailed"));
    }
  };

  const onOpenChange = async (next: boolean) => {
    if (next && !signedIn) {
      router.push(loginHref);
      return;
    }
    setOpen(next);
    if (!next) {
      setError(null);
      setName("");
      return;
    }
    // One tap saves: the menu opens with the story already in Saved.
    const firstSave = inLists.size === 0 && !initialSaved;
    if (firstSave) void toggleList(null, true);
    const result = await getSaveLists(storyId);
    if (!result.ok) return;
    setLists([{ id: null, name: t("savedTitle") }, ...result.lists]);
    setInLists(new Set(firstSave ? [...result.inLists, null] : result.inLists));
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setError(null);
    const result = await createReadingList({ name, storyId });
    setCreating(false);
    if (!result.ok) {
      setError(t(`errors.${result.error}`));
      return;
    }
    setLists((current) => [...(current ?? []), result.list]);
    setInLists((current) => new Set([...current, result.list.id]));
    setName("");
    toast(t("listCreatedToast", { name: result.list.name }));
  };

  const Icon = saved ? BookmarkCheck : Bookmark;
  return (
    <Popover.Root open={open} onOpenChange={(next) => void onOpenChange(next)}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={saved ? t("savedChangeLists") : t("save")}
          title={saved ? t("saved") : t("save")}
          data-saved={saved}
          className={cn(
            "flex size-11 items-center justify-center rounded-full transition-colors hover:bg-accent",
            saved ? "text-ember-text" : "text-muted-foreground",
          )}
          data-testid="save-button"
        >
          <Icon className={cn("size-5", saved && "fill-ember-soft")} aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="center"
          sideOffset={10}
          collisionPadding={12}
          aria-label={t("saveTo")}
          className="z-50 w-72 rounded-2xl border border-border bg-popover p-3 font-sans text-sm text-popover-foreground shadow-xl"
          data-testid="save-menu"
        >
          <p className="px-1 pb-2 font-semibold">{t("saveTo")}</p>
          {lists === null ? (
            <div className="flex flex-col gap-2 px-1 py-1" aria-hidden>
              <span className="h-5 w-32 animate-pulse rounded bg-muted" />
              <span className="h-5 w-24 animate-pulse rounded bg-muted" />
            </div>
          ) : (
            <ul className="flex max-h-64 flex-col overflow-y-auto">
              {lists.map((list) => (
                <li key={list.id ?? "saved"}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-1 hover:bg-accent sm:min-h-9">
                    <input
                      type="checkbox"
                      checked={inLists.has(list.id)}
                      onChange={(event) => void toggleList(list.id, event.target.checked)}
                      className="size-4 accent-ember"
                    />
                    <span className="min-w-0 truncate">{list.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={create} className="mt-2 flex flex-col gap-1.5 border-t border-border pt-3">
            <label htmlFor={`new-list-${storyId}`} className="px-1 text-xs text-muted-foreground">
              {t("newList")}
            </label>
            <div className="flex gap-2">
              <Input
                id={`new-list-${storyId}`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={READING_LIST_NAME_MAX}
                aria-label={t("newListName")}
                aria-invalid={Boolean(error) || undefined}
                aria-describedby={error ? `new-list-error-${storyId}` : undefined}
              />
              <Button type="submit" size="sm" variant="secondary" disabled={creating || !name.trim()}>
                {t("createList")}
              </Button>
            </div>
            {error ? (
              <p id={`new-list-error-${storyId}`} role="alert" className="px-1 text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </form>
          <div className="mt-2 flex justify-end">
            <Popover.Close asChild>
              <Button size="sm" variant="ghost">
                {t("done")}
              </Button>
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Follow a writer or a topic. */
export function FollowButton({
  target,
  id,
  initialFollowing,
  signedIn,
  loginHref,
  size = "sm",
}: {
  target: "user" | "topic" | "circle";
  id: string;
  initialFollowing: boolean;
  signedIn: boolean;
  loginHref: string;
  size?: "sm" | "default";
}) {
  const t = useTranslations("Social");
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    if (!signedIn) {
      router.push(loginHref);
      return;
    }
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      const result = await setFollow({ target, id, follow: next });
      if (!result.ok) {
        setFollowing(!next);
        toast.error(t("followFailed"));
      } else {
        router.refresh();
      }
    });
  };

  return (
    <Button
      type="button"
      size={size}
      variant={following ? "outline" : "default"}
      onClick={toggle}
      aria-pressed={following}
      disabled={pending}
      data-testid="follow-button"
    >
      {following ? t("following") : t("follow")}
    </Button>
  );
}

/** Copies older than this are refreshed when the reader opens the story again. */
const OFFLINE_REFRESH_MS = 6 * 60 * 60_000;

/**
 * Saving keeps the story on this device; unsaving lets it go. Opening a saved story refreshes an old
 * copy (or makes one, e.g. saved on another device), a few seconds in so it never competes with the page.
 */
function useKeepOffline(saved: boolean, offline: { url: string; title: string; author: string } | undefined) {
  const wasSaved = useRef(saved);
  const url = offline?.url;
  const title = offline?.title ?? "";
  const author = offline?.author ?? "";
  useEffect(() => {
    const before = wasSaved.current;
    wasSaved.current = saved;
    if (!url || !offlineReady()) return;
    if (!saved) {
      if (before) void removeStory(url);
      return;
    }
    const copy = offlineStories().find((item) => item.url === url);
    if (before && copy && Date.now() - new Date(copy.savedAt).getTime() < OFFLINE_REFRESH_MS) return;
    const timer = setTimeout(() => void downloadStory({ url, title, author }), before ? 3000 : 0);
    return () => clearTimeout(timer);
  }, [saved, url, title, author]);
}
