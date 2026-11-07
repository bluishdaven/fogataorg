"use client";

import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { setBlock } from "@/app/actions/social";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { profilePath } from "@/lib/domain/handle-routes";

type Person = { userId: string; username: string; displayName: string; kind: "mute" | "block" };

/** The people the reader muted or blocked, each with a way to undo it. */
export function BlockedPeople({ people }: { people: Person[] }) {
  const t = useTranslations("Account");
  const social = useTranslations("Social");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const undo = async (person: Person) => {
    setBusy(person.userId);
    const result = await setBlock({ userId: person.userId, kind: null });
    setBusy(null);
    if (!result.ok) {
      toast.error(social("blockFailed"));
      return;
    }
    toast(person.kind === "block" ? social("unblockedToast") : social("unmutedToast"));
    router.refresh();
  };

  return (
    <>
      <Toaster position="bottom-center" />
      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("blockedEmpty")}</p>
      ) : (
        <ul className="divide-y divide-border" data-testid="blocked-people">
          {people.map((person) => (
            <li key={person.userId} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <NextLink href={profilePath(person.username)} className="font-medium hover:text-ember-text">
                  {person.displayName || person.username}
                </NextLink>{" "}
                <span className="text-xs text-muted-foreground">
                  @{person.username} · {person.kind === "block" ? social("blockedBadge") : social("mutedBadge")}
                </span>
              </span>
              <Button size="sm" variant="outline" disabled={busy === person.userId} onClick={() => void undo(person)}>
                {person.kind === "block" ? social("unblock") : social("unmute")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
