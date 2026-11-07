"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addStoryToSeries,
  createSeries,
  deleteSeries,
  moveStoryInSeries,
  removeStoryFromSeries,
  updateSeries,
} from "@/app/actions/series";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { seriesPath } from "@/lib/domain/handle-routes";
import { SERIES_DESCRIPTION_MAX, SERIES_TITLE_MAX } from "@/lib/domain/series";

type Story = { id: string; title: string; slug: string; status: string; seriesId: string | null; seriesPosition: number | null };
type Data = { series: { id: string; title: string; slug: string; description: string; parts: Story[] }[]; unassigned: Story[] };
type Result = { ok: true } | { ok: false; error: string };

function SeriesFields({ idPrefix, title, description }: { idPrefix: string; title?: string; description?: string }) {
  const t = useTranslations("Series");
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-title`}>{t("titleLabel")}</Label>
        <Input id={`${idPrefix}-title`} name="title" defaultValue={title} maxLength={SERIES_TITLE_MAX} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-description`}>{t("descriptionLabel")}</Label>
        <textarea
          id={`${idPrefix}-description`}
          name="description"
          defaultValue={description}
          maxLength={SERIES_DESCRIPTION_MAX}
          rows={2}
          className="rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm focus-visible:border-ring"
        />
      </div>
    </>
  );
}

export function SeriesManager({ username, data }: { username: string; data: Data }) {
  const t = useTranslations("Series");
  const router = useRouter();
  const newId = useId();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);

  const run = (action: () => Promise<Result>, success?: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        if (success) toast.success(success);
        setEditing(null);
        router.refresh();
      } else {
        toast.error(t(result.error === "title" ? "errors.title" : result.error === "description" ? "errors.description" : "errors.failed"));
      }
    });

  const label = (story: Story) => (story.status === "draft" ? `${story.title || t("untitled")} (${t("draft")})` : story.title || t("untitled"));

  return (
    <div className="flex flex-col gap-10">
      <form
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const target = event.currentTarget;
          run(async () => {
            const result = await createSeries({ title: form.get("title"), description: form.get("description") ?? "" });
            if (result.ok) target.reset();
            return result;
          }, t("created"));
        }}
        data-testid="new-series"
      >
        <h2 className="font-serif text-2xl font-semibold">{t("newTitle")}</h2>
        <SeriesFields idPrefix={newId} />
        <div>
          <Button type="submit" disabled={pending}>
            {t("create")}
          </Button>
        </div>
      </form>

      {data.series.length === 0 ? <p className="text-muted-foreground">{t("none")}</p> : null}
      {data.series.map((item) => (
        <section key={item.id} aria-labelledby={`series-${item.id}`} className="flex flex-col gap-4 rounded-2xl border border-border p-5" data-testid="my-series">
          {editing === item.id ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                run(() => updateSeries({ id: item.id, title: form.get("title"), description: form.get("description") ?? "" }), t("saved"));
              }}
            >
              <SeriesFields idPrefix={`edit-${item.id}`} title={item.title} description={item.description} />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={pending}>
                  {t("save")}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  {t("cancel")}
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id={`series-${item.id}`} className="font-serif text-2xl font-semibold">
                  {item.title}
                </h2>
                {item.description ? <p className="mt-1 text-sm text-muted-foreground">{item.description}</p> : null}
                <NextLink href={seriesPath(username, item.slug)} className="mt-1 inline-block text-sm text-ember-text underline underline-offset-4">
                  {t("view")}
                </NextLink>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(item.id)}>
                  {t("edit")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(t("deleteConfirm", { title: item.title }))) run(() => deleteSeries({ id: item.id }), t("deleted"));
                  }}
                >
                  {t("delete")}
                </Button>
              </div>
            </div>
          )}

          {item.parts.length ? (
            <ol className="flex flex-col divide-y divide-border rounded-xl border border-border" data-testid="series-parts">
              {item.parts.map((part, index) => (
                <li key={part.id} className="flex items-center gap-2 p-2 pl-3">
                  <span className="w-8 shrink-0 text-sm text-muted-foreground tabular-nums">{index + 1}.</span>
                  <span className="min-w-0 flex-1 truncate">{label(part)}</span>
                  <Button size="icon-sm" variant="ghost" aria-label={t("moveUp", { title: part.title })} disabled={pending || index === 0} onClick={() => run(() => moveStoryInSeries({ storyId: part.id, direction: "up" }))}>
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={t("moveDown", { title: part.title })} disabled={pending || index === item.parts.length - 1} onClick={() => run(() => moveStoryInSeries({ storyId: part.id, direction: "down" }))}>
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={t("remove", { title: part.title })} disabled={pending} onClick={() => run(() => removeStoryFromSeries({ storyId: part.id }))}>
                    <X aria-hidden />
                  </Button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noParts")}</p>
          )}

          {data.unassigned.length ? (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const storyId = new FormData(event.currentTarget).get("story");
                if (storyId) run(() => addStoryToSeries({ seriesId: item.id, storyId }));
              }}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Label htmlFor={`add-${item.id}`}>{t("addLabel")}</Label>
                <select id={`add-${item.id}`} name="story" className="min-h-11 rounded-lg border border-input bg-background px-2.5 text-sm sm:min-h-9" data-testid="add-to-series">
                  {data.unassigned.map((story) => (
                    <option key={story.id} value={story.id}>
                      {label(story)}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" variant="outline" disabled={pending} data-testid="add-to-series-submit">
                {t("add")}
              </Button>
            </form>
          ) : null}
        </section>
      ))}
    </div>
  );
}
