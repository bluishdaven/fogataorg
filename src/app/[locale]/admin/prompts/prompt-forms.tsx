"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { deletePrompt, savePrompt } from "@/app/actions/prompts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROMPT_TEXT_MAX } from "@/lib/domain/prompts";

type Prompt = { id: string; weekOf: string; textEn: string; textEs: string; entries: number };

const textarea = "rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm focus-visible:border-ring";

export function PromptForm({ defaultWeek }: { defaultWeek: string }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const target = event.currentTarget;
        startTransition(async () => {
          const result = await savePrompt({ weekOf: form.get("weekOf"), textEn: form.get("textEn"), textEs: form.get("textEs") });
          if (result.ok) {
            toast.success(t("promptSaved"));
            target.reset();
            router.refresh();
          } else {
            toast.error(t(result.error === "weekOf" ? "promptErrors.weekOf" : result.error === "text" ? "promptErrors.text" : "promptErrors.failed"));
          }
        });
      }}
      data-testid="prompt-form"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prompt-week">{t("promptWeek")}</Label>
        <Input id="prompt-week" name="weekOf" type="date" defaultValue={defaultWeek} required className="w-fit" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prompt-en">{t("promptEn")}</Label>
        <textarea id="prompt-en" name="textEn" rows={2} maxLength={PROMPT_TEXT_MAX} required lang="en" className={textarea} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prompt-es">{t("promptEs")}</Label>
        <textarea id="prompt-es" name="textEs" rows={2} maxLength={PROMPT_TEXT_MAX} required lang="es" className={textarea} />
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {t("promptSave")}
        </Button>
      </div>
    </form>
  );
}

export function PromptList({ prompts, thisWeek }: { prompts: Prompt[]; thisWeek: string }) {
  const t = useTranslations("Admin");
  const s = useTranslations("Spark");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (!prompts.length) return <p className="text-muted-foreground">{t("promptNone")}</p>;
  const date = (week: string) => format.dateTime(new Date(`${week}T00:00:00Z`), { dateStyle: "long", timeZone: "UTC" });
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border" data-testid="prompt-list">
      {prompts.map((prompt) => (
        <li key={prompt.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">
              {date(prompt.weekOf)}
              {prompt.weekOf > thisWeek ? ` · ${t("promptUpcoming")}` : ` · ${s("entries", { count: prompt.entries })}`}
            </p>
            <p className="mt-1" lang="en">{prompt.textEn}</p>
            <p className="mt-1 text-muted-foreground" lang="es">{prompt.textEs}</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(t("promptDeleteConfirm", { week: date(prompt.weekOf) }))) return;
              startTransition(async () => {
                await deletePrompt({ id: prompt.id });
                router.refresh();
              });
            }}
          >
            {t("promptDelete")}
          </Button>
        </li>
      ))}
    </ul>
  );
}
