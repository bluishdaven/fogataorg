"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setBookmark, setFollow } from "@/app/actions/social";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Save for later ("Leña guardada"). Optimistic; rolls back on failure. */
export function SaveButton({
  storyId,
  initialSaved,
  signedIn,
  loginHref,
}: {
  storyId: string;
  initialSaved: boolean;
  signedIn: boolean;
  loginHref: string;
}) {
  const t = useTranslations("Social");
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [, startTransition] = useTransition();

  const toggle = () => {
    if (!signedIn) {
      router.push(loginHref);
      return;
    }
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      const result = await setBookmark({ storyId, saved: next });
      if (!result.ok) {
        setSaved(!next);
        toast.error(t("saveFailed"));
      } else {
        toast(next ? t("savedToast") : t("unsavedToast"));
      }
    });
  };

  const Icon = saved ? BookmarkCheck : Bookmark;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? t("saved") : t("save")}
      title={saved ? t("saved") : t("save")}
      className={cn(
        "flex size-11 items-center justify-center rounded-full transition-colors hover:bg-accent",
        saved ? "text-ember-text" : "text-muted-foreground",
      )}
      data-testid="save-button"
    >
      <Icon className={cn("size-5", saved && "fill-ember-soft")} aria-hidden />
    </button>
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
