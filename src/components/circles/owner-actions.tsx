"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { deleteCircle, transferCircle } from "@/app/actions/circles";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { confirmsCircleName } from "@/lib/domain/circles";

type Member = { userId: string; role: "owner" | "editor" | "writer"; username: string; displayName: string };

/** Owner-only: hand the circle to another member, or delete it after typing its name. */
export function OwnerActions({ circleId, circleName, members }: { circleId: string; circleName: string; members: Member[] }) {
  const t = useTranslations("Circles");
  const router = useRouter();
  const others = members.filter((member) => member.role !== "owner");
  const [choice, setHeir] = useState("");
  // Members can arrive after the first render (the list refreshes), so fall back to the first one.
  const heir = others.some((member) => member.userId === choice) ? choice : (others[0]?.userId ?? "");
  const [handing, setHanding] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handOver = async (event: FormEvent) => {
    event.preventDefault();
    const member = others.find((m) => m.userId === heir);
    if (!member || !window.confirm(t("transferConfirm", { name: member.displayName, circle: circleName }))) return;
    setHanding(true);
    const result = await transferCircle({ circleId, userId: heir });
    setHanding(false);
    if (!result.ok) {
      toast.error(t(`errors.${result.errors[0] ?? "invalid"}`));
      return;
    }
    toast(t("transferredToast", { name: member.displayName }));
    router.refresh();
  };

  const remove = async (event: FormEvent) => {
    event.preventDefault();
    setDeleting(true);
    setError(null);
    const result = await deleteCircle({ circleId, confirmName: typed });
    if (!result.ok) {
      setDeleting(false);
      setError(t(`errors.${result.errors[0] ?? "invalid"}`));
      return;
    }
    toast(t("deletedToast", { circle: circleName }));
    router.replace("/circles");
  };

  return (
    <section aria-labelledby="owner-heading" className="flex flex-col gap-6 rounded-2xl border border-destructive/40 p-5" data-testid="owner-actions">
      <h2 id="owner-heading" className="font-serif text-2xl font-semibold">
        {t("ownerHeading")}
      </h2>

      <form onSubmit={handOver} className="flex flex-col gap-2">
        <h3 className="font-semibold">{t("transferTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("transferHint")}</p>
        {others.length ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="transfer-to">{t("transferTo")}</Label>
              <select
                id="transfer-to"
                value={heir}
                onChange={(event) => setHeir(event.target.value)}
                className="h-11 rounded-xl border border-input bg-transparent px-3 text-base sm:h-9 sm:text-sm"
              >
                {others.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.displayName} (@{member.username})
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="outline" disabled={handing || !heir}>
              {t("transfer")}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("transferNoMembers")}</p>
        )}
      </form>

      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">{t("deleteTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("deleteHint")}</p>
        <Dialog
          open={deleteOpen}
          onOpenChange={(open) => {
            setDeleteOpen(open);
            setTyped("");
            setError(null);
          }}
        >
          <DialogTrigger asChild>
            <Button variant="destructive" className="self-start" data-testid="delete-circle">
              {t("deleteCircle")}
            </Button>
          </DialogTrigger>
          <DialogContent closeLabel={t("close")} className="sm:max-w-md">
            <form onSubmit={remove} className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">{t("deleteDialogTitle", { circle: circleName })}</DialogTitle>
                <DialogDescription>{t("deleteDialogDescription")}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="delete-confirm">{t("deleteTypeName", { circle: circleName })}</Label>
                <Input
                  id="delete-confirm"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={Boolean(error) || undefined}
                  aria-describedby={error ? "delete-error" : undefined}
                />
                {error ? (
                  <p id="delete-error" role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="destructive" disabled={deleting || !confirmsCircleName(typed, circleName)}>
                  {deleting ? t("deleting") : t("deleteForever")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
