"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { deleteReadingList, renameReadingList } from "@/app/actions/social";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { useRouter } from "@/i18n/navigation";
import { READING_LIST_NAME_MAX } from "@/lib/domain/social";

/** Rename or delete one of the reader's reading lists (on the Saved page). */
export function ReadingListTools({ id, name }: { id: string; name: string }) {
  const t = useTranslations("Social");
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const rename = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await renameReadingList({ id, name: value });
    setPending(false);
    if (!result.ok) {
      setError(t(`errors.${result.error}`));
      return;
    }
    setRenaming(false);
    toast(t("listRenamedToast"));
    router.refresh();
  };

  const remove = async () => {
    if (!window.confirm(t("deleteListConfirm", { name }))) return;
    const result = await deleteReadingList(id);
    if (!result.ok) {
      toast.error(t("genericError"));
      return;
    }
    toast(t("listDeletedToast"));
    router.replace("/me/saved");
  };

  return (
    <>
      <Toaster position="bottom-center" />
      {renaming ? (
        <form onSubmit={rename} className="flex w-full flex-col gap-1.5 sm:w-auto" data-testid="rename-list-form">
          <div className="flex gap-2">
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              maxLength={READING_LIST_NAME_MAX}
              aria-label={t("listName")}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? "rename-list-error" : undefined}
              autoFocus
            />
            <Button type="submit" size="sm" disabled={pending || !value.trim()}>
              {t("saveEdit")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(false)}>
              {t("cancel")}
            </Button>
          </div>
          {error ? (
            <p id="rename-list-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </form>
      ) : (
        <span className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setValue(name);
              setRenaming(true);
            }}
          >
            {t("renameList")}
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void remove()}>
            {t("deleteList")}
          </Button>
        </span>
      )}
    </>
  );
}
