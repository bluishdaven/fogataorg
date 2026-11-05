"use client";

import { Camera, ImagePlus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { publishStory, unpublishStory } from "@/app/actions/stories";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UnsplashCredit } from "@/components/unsplash/unsplash-credit";
import { UnsplashPicker } from "@/components/unsplash/unsplash-picker";
import type { Locale } from "@/lib/domain/locale";
import { MAX_TOPICS_PER_STORY } from "@/lib/domain/schemas";
import {
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  storyState,
  type PublishErrorKey,
} from "@/lib/domain/stories";
import { creditFromPhoto, type ImageCredit } from "@/lib/domain/unsplash";
import { cn } from "@/lib/utils";
import { editorImageSrc } from "./nodes";
import { ACCEPTED_IMAGE_TYPES, UploadError, uploadStoryImage } from "./upload";

export type TopicOption = { slug: string; nameEn: string; nameEs: string };

export type PublishDialogStory = {
  id: string;
  title: string;
  subtitle: string;
  status: "draft" | "scheduled" | "published" | "unlisted";
  slug: string;
  language: Locale;
  publishedAt: Date | null;
  cover: { url: string; alt: string; credit: ImageCredit | null } | null;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  topics: string[];
};

/** "YYYY-MM-DDTHH:mm" in the browser's time zone, for datetime-local inputs. */
function localInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function tomorrowMorning(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return localInputValue(date);
}

export function PublishDialog({
  open,
  onOpenChange,
  story,
  topics,
  userId,
  onPublished,
  onUnpublished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  story: PublishDialogStory;
  topics: TopicOption[];
  userId: string;
  onPublished: (result: { path: string; scheduled: boolean }) => void;
  onUnpublished: () => void;
}) {
  const t = useTranslations("Publish");
  const locale = useLocale();
  const state = storyState(story, new Date());
  const [cover, setCover] = useState(story.cover);
  const [selected, setSelected] = useState<string[]>(story.topics);
  const [language, setLanguage] = useState<Locale>(story.language);
  const [visibility, setVisibility] = useState<"public" | "unlisted">(story.status === "unlisted" ? "unlisted" : "public");
  const [when, setWhen] = useState<"now" | "later">(state === "scheduled" ? "later" : "now");
  const [scheduleAt, setScheduleAt] = useState(
    state === "scheduled" && story.publishedAt ? localInputValue(story.publishedAt) : "",
  );
  const [seoTitle, setSeoTitle] = useState(story.seoTitle);
  const [seoDescription, setSeoDescription] = useState(story.seoDescription);
  const [canonicalUrl, setCanonicalUrl] = useState(story.canonicalUrl);
  const [errors, setErrors] = useState<PublishErrorKey[]>([]);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [unsplashOpen, setUnsplashOpen] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);

  const toggleTopic = (slug: string) => {
    setSelected((current) =>
      current.includes(slug)
        ? current.filter((s) => s !== slug)
        : current.length >= MAX_TOPICS_PER_STORY
          ? current
          : [...current, slug],
    );
  };

  const uploadCover = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const image = await uploadStoryImage(file, userId);
      setCover({ url: image.url, alt: "", credit: null });
    } catch (error) {
      toast.error(t(`uploadErrors.${error instanceof UploadError ? error.reason : "failed"}`));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setErrors([]);
    try {
      const result = await publishStory({
        id: story.id,
        cover: cover ? { url: cover.url, alt: cover.alt, credit: cover.credit } : null,
        topics: selected,
        language,
        seoTitle,
        seoDescription,
        canonicalUrl,
        visibility,
        publishAt: when === "later" && scheduleAt ? new Date(scheduleAt).toISOString() : null,
      });
      if (result.ok) {
        onOpenChange(false);
        toast.success(result.scheduled ? t("scheduledToast") : t("publishedToast"));
        onPublished(result);
      } else {
        setErrors(result.errors);
      }
    } catch {
      setErrors(["invalid"]);
    } finally {
      setPending(false);
    }
  };

  const unpublish = async () => {
    if (!window.confirm(t("unpublishConfirm"))) return;
    setPending(true);
    const result = await unpublishStory(story.id);
    setPending(false);
    if (result.ok) {
      onOpenChange(false);
      toast(t("unpublishedToast"));
      onUnpublished();
    }
  };

  const live = state !== "draft";
  const submitLabel = when === "later" ? t("schedule") : live ? t("publishChanges") : t("publishNow");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent closeLabel={t("close")} className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl" data-testid="publish-dialog">
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <DialogHeader className="border-b border-border p-5">
              <DialogTitle className="font-serif text-xl">{live ? t("titleUpdate") : t("title")}</DialogTitle>
              <DialogDescription>{t("description")}</DialogDescription>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
              {errors.length ? (
                <ul role="alert" className="list-disc rounded-lg border border-destructive/30 bg-destructive/5 py-3 pr-4 pl-8 text-sm text-destructive" data-testid="publish-errors">
                  {errors.map((key) => (
                    <li key={key}>{t(`errors.${key}`)}</li>
                  ))}
                </ul>
              ) : null}

              <section className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" aria-labelledby="cover-heading">
                <div className="flex flex-col gap-2">
                  <h3 id="cover-heading" className="text-sm font-semibold">{t("cover")}</h3>
                  {cover ? (
                    <div className="relative overflow-hidden rounded-lg bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={editorImageSrc(cover.url)} alt={cover.alt} className="aspect-[16/9] w-full object-cover" />
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="secondary"
                        className="absolute top-2 right-2"
                        aria-label={t("removeCover")}
                        onClick={() => setCover(null)}
                      >
                        <X />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex aspect-[16/9] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                      {t("coverHint")}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => coverInput.current?.click()}>
                      <ImagePlus />
                      {uploading ? t("uploading") : t("uploadCover")}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setUnsplashOpen(true)}>
                      <Camera />
                      {t("unsplashCover")}
                    </Button>
                  </div>
                  {cover ? (
                    <>
                      <Label htmlFor="cover-alt" className={cn(!cover.alt.trim() && "text-destructive")}>
                        {t("coverAlt")}
                      </Label>
                      <Input
                        id="cover-alt"
                        value={cover.alt}
                        maxLength={300}
                        onChange={(event) => setCover({ ...cover, alt: event.target.value })}
                        placeholder={t("coverAltPlaceholder")}
                        aria-invalid={!cover.alt.trim() || undefined}
                      />
                      {cover.credit ? <UnsplashCredit credit={cover.credit} /> : null}
                    </>
                  ) : null}
                  <input
                    ref={coverInput}
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                    data-testid="cover-input"
                    onChange={(event) => {
                      void uploadCover(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1 rounded-lg bg-secondary/60 p-4">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("preview")}</p>
                  <p className="font-serif text-lg leading-snug font-semibold text-balance" lang={language}>
                    {story.title.trim() || t("untitled")}
                  </p>
                  {story.subtitle ? (
                    <p className="font-serif text-muted-foreground" lang={language}>
                      {story.subtitle}
                    </p>
                  ) : null}
                </div>
              </section>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-semibold">
                  {t("topics")}{" "}
                  <span className="font-normal text-muted-foreground">
                    {t("topicsCount", { count: selected.length, max: MAX_TOPICS_PER_STORY })}
                  </span>
                </legend>
                <div className="flex flex-wrap gap-2">
                  {[...topics]
                    .sort((a, b) =>
                      (locale === "es" ? a.nameEs : a.nameEn).localeCompare(locale === "es" ? b.nameEs : b.nameEn, locale),
                    )
                    .map((topic) => {
                    const active = selected.includes(topic.slug);
                    const full = !active && selected.length >= MAX_TOPICS_PER_STORY;
                    return (
                      <button
                        key={topic.slug}
                        type="button"
                        aria-pressed={active}
                        disabled={full}
                        onClick={() => toggleTopic(topic.slug)}
                        className={cn(
                          "min-h-10 rounded-full border px-4 text-sm transition-colors disabled:opacity-40 sm:min-h-8 sm:px-3",
                          active ? "border-transparent bg-primary text-primary-foreground" : "border-border hover:bg-accent",
                        )}
                      >
                        {locale === "es" ? topic.nameEs : topic.nameEn}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="grid gap-6 sm:grid-cols-2">
                <Choice
                  legend={t("language")}
                  name="language"
                  value={language}
                  onChange={(value) => setLanguage(value as Locale)}
                  options={[
                    { value: "es", label: "Español" },
                    { value: "en", label: "English" },
                  ]}
                />
                <Choice
                  legend={t("visibility")}
                  name="visibility"
                  value={visibility}
                  onChange={(value) => setVisibility(value as "public" | "unlisted")}
                  options={[
                    { value: "public", label: t("public"), hint: t("publicHint") },
                    { value: "unlisted", label: t("unlisted"), hint: t("unlistedHint") },
                  ]}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Choice
                  legend={t("when")}
                  name="when"
                  value={when}
                  onChange={(value) => {
                    setWhen(value as "now" | "later");
                    if (value === "later" && !scheduleAt) setScheduleAt(tomorrowMorning());
                  }}
                  options={[
                    { value: "now", label: live && state !== "scheduled" ? t("keepDate") : t("now") },
                    { value: "later", label: t("later") },
                  ]}
                />
                {when === "later" ? (
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="schedule-at">{t("scheduleAt")}</Label>
                    <Input
                      id="schedule-at"
                      type="datetime-local"
                      value={scheduleAt}
                      min={localInputValue(new Date())}
                      onChange={(event) => setScheduleAt(event.target.value)}
                      className="w-fit"
                    />
                  </div>
                ) : null}
              </div>

              <details className="rounded-lg border border-border px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold">{t("advanced")}</summary>
                <div className="mt-4 flex flex-col gap-4">
                  <CountedInput
                    id="seo-title"
                    label={t("seoTitle")}
                    value={seoTitle}
                    max={SEO_TITLE_MAX}
                    placeholder={story.title}
                    onChange={setSeoTitle}
                  />
                  <CountedInput
                    id="seo-description"
                    label={t("seoDescription")}
                    value={seoDescription}
                    max={SEO_DESCRIPTION_MAX}
                    placeholder={story.subtitle}
                    onChange={setSeoDescription}
                  />
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="canonical-url">{t("canonicalUrl")}</Label>
                    <Input
                      id="canonical-url"
                      type="url"
                      inputMode="url"
                      value={canonicalUrl}
                      onChange={(event) => setCanonicalUrl(event.target.value)}
                      placeholder="https://"
                    />
                    <p className="text-xs text-muted-foreground">{t("canonicalHint")}</p>
                  </div>
                </div>
              </details>
            </div>

            <DialogFooter className="border-t border-border p-4">
              {live ? (
                <Button type="button" variant="ghost" className="mr-auto text-destructive" disabled={pending} onClick={() => void unpublish()}>
                  {t("unpublish")}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={pending || uploading} data-testid="publish-submit">
                {pending ? t("publishing") : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <UnsplashPicker
        trigger={null}
        open={unsplashOpen}
        onOpenChange={setUnsplashOpen}
        onSelect={(photo) => setCover({ url: photo.rawUrl, alt: photo.alt, credit: creditFromPhoto(photo) })}
      />
    </>
  );
}

function Choice({
  legend,
  name,
  value,
  onChange,
  options,
}: {
  legend: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; hint?: string }[];
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="mt-0.5 accent-[var(--primary)]"
          />
          <span>
            {option.label}
            {option.hint ? <span className="block text-xs text-muted-foreground">{option.hint}</span> : null}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function CountedInput({
  id,
  label,
  value,
  max,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  max: number;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className={cn("text-xs text-muted-foreground", value.length > max && "text-destructive")} aria-hidden>
          {value.length}/{max}
        </span>
      </div>
      <Input id={id} value={value} maxLength={max} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
