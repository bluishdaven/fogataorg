"use client";

import { Ellipsis } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { setBlock } from "@/app/actions/social";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { BlockKind } from "@/lib/domain/social";

/** The "…" menu on someone's profile: mute or block them (or undo it). Nobody is told. */
export function BlockMenu({ userId, name, initialKind }: { userId: string; name: string; initialKind: BlockKind | null }) {
  const t = useTranslations("Social");
  const router = useRouter();
  const [kind, setKind] = useState(initialKind);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  const change = async (next: BlockKind | null) => {
    setPending(true);
    const result = await setBlock({ userId, kind: next });
    setPending(false);
    setConfirming(false);
    if (!result.ok) {
      toast.error(t("blockFailed"));
      return;
    }
    const message = next === "mute" ? "mutedToast" : next === "block" ? "blockedToast" : kind === "block" ? "unblockedToast" : "unmutedToast";
    setKind(next);
    toast(t(message));
    router.refresh();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t("moreActions", { name })} data-testid="block-menu">
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-44">
          {kind === "block" ? (
            <DropdownMenuItem onSelect={() => void change(null)} disabled={pending}>
              {t("unblock")}
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onSelect={() => void change(kind === "mute" ? null : "mute")} disabled={pending}>
                {kind === "mute" ? t("unmute") : t("mute")}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)} disabled={pending}>
                {t("block")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent closeLabel={t("cancel")} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{t("blockTitle", { name })}</DialogTitle>
            <DialogDescription>{t("blockDescription")}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void change("block")} disabled={pending} data-testid="confirm-block">
              {t("blockConfirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
