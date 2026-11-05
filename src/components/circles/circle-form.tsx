"use client";

import { Camera, Check, ImagePlus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { createCircle, updateCircle } from "@/app/actions/circles";
import { editorImageSrc } from "@/components/editor/nodes";
import { ACCEPTED_IMAGE_TYPES, UploadError, uploadStoryImage } from "@/components/editor/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UnsplashPicker } from "@/components/unsplash/unsplash-picker";
import { ACCENT_PRESETS, CIRCLE_DESCRIPTION_MAX, readableTextOn, type CircleErrorKey } from "@/lib/domain/circles";
import { slugify } from "@/lib/domain/slug";
import { creditFromPhoto, type ImageCredit } from "@/lib/domain/unsplash";
import { cn } from "@/lib/utils";

type Header = { url: string; alt: string; credit: ImageCredit | null } | null;

export function CircleForm({
  userId,
  initial,
}: {
  userId: string;
  /** Present when editing an existing circle. */
  initial?: { circleId: string; slug: string; name: string; description: string; accentColor: string; header: Header };
}) {
  const t = useTranslations("Circles");
  const locale = useLocale();
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [accent, setAccent] = useState(initial?.accentColor ?? ACCENT_PRESETS[0]);
  const [header, setHeader] = useState<Header>(initial?.header ?? null);
  const [errors, setErrors] = useState<CircleErrorKey[]>([]);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [unsplashOpen, setUnsplashOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const shownSlug = slugTouched ? slug : slugify(name, 40);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const image = await uploadStoryImage(file, userId);
      setHeader({ url: image.url, alt: "", credit: null });
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
    const result = initial
      ? await updateCircle({ circleId: initial.circleId, name, description, accentColor: accent, header })
      : await createCircle({ name, slug: shownSlug, description, accentColor: accent, header });
    setPending(false);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast.success(initial ? t("savedToast") : t("createdToast"));
    router.push(`/${locale}/circles/${result.slug}`);
    router.refresh();
  };

  const text = readableTextOn(accent);

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate data-testid="circle-form">
      {errors.length ? (
        <ul role="alert" className="list-disc rounded-lg border border-destructive/30 bg-destructive/5 py-3 pr-4 pl-8 text-sm text-destructive">
          {errors.map((key) => (
            <li key={key}>{t(`errors.${key}`)}</li>
          ))}
        </ul>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border" aria-hidden>
        {header ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={editorImageSrc(header.url)} alt="" className="aspect-[4/1] w-full object-cover" />
        ) : null}
        <div className="px-5 py-4" style={{ backgroundColor: accent, color: text }}>
          <p className="font-serif text-2xl font-semibold">{name.trim() || t("namePlaceholder")}</p>
          {description ? <p className="mt-1 text-sm opacity-90">{description}</p> : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="circle-name">{t("name")}</Label>
        <Input id="circle-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} />
      </div>

      {initial ? null : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="circle-slug">{t("slug")}</Label>
          <div className="flex items-center rounded-lg border border-input focus-within:ring-3 focus-within:ring-ring/50">
            <span className="pl-2.5 text-sm text-muted-foreground" aria-hidden>
              /circles/
            </span>
            <input
              id="circle-slug"
              value={shownSlug}
              maxLength={40}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase());
              }}
              className="h-11 min-w-0 flex-1 bg-transparent pr-3 text-base outline-none sm:h-9 sm:text-sm"
              spellCheck={false}
              aria-describedby="circle-slug-hint"
            />
          </div>
          <p id="circle-slug-hint" className="text-xs text-muted-foreground">
            {t("slugHint")}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="circle-description">{t("description")}</Label>
          <span className="text-xs text-muted-foreground" aria-hidden>
            {description.length}/{CIRCLE_DESCRIPTION_MAX}
          </span>
        </div>
        <textarea
          id="circle-description"
          value={description}
          maxLength={CIRCLE_DESCRIPTION_MAX}
          rows={3}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("descriptionPlaceholder")}
          className="rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("accent")}</legend>
        <div className="flex flex-wrap items-center gap-2">
          {ACCENT_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setAccent(color)}
              aria-label={t("accentOption", { color })}
              aria-pressed={accent === color}
              className={cn("flex size-9 items-center justify-center rounded-full border-2", accent === color ? "border-foreground" : "border-transparent")}
              style={{ backgroundColor: color, color: readableTextOn(color) }}
            >
              {accent === color ? <Check className="size-4" aria-hidden /> : null}
            </button>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="size-9 cursor-pointer rounded border border-input bg-transparent" />
            {t("customAccent")}
          </label>
        </div>
        <p className="text-xs text-muted-foreground">{t("accentHint")}</p>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("header")}</legend>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
            <ImagePlus />
            {uploading ? t("uploading") : t("uploadHeader")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setUnsplashOpen(true)}>
            <Camera />
            {t("unsplashHeader")}
          </Button>
          {header ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setHeader(null)}>
              <X />
              {t("removeHeader")}
            </Button>
          ) : null}
        </div>
        {header ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="circle-header-alt">{t("headerAlt")}</Label>
            <Input id="circle-header-alt" value={header.alt} maxLength={300} onChange={(e) => setHeader({ ...header, alt: e.target.value })} />
          </div>
        ) : null}
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </fieldset>

      <div>
        <Button type="submit" disabled={pending || uploading} data-testid="circle-submit">
          {pending ? t("saving") : initial ? t("save") : t("create")}
        </Button>
      </div>

      <UnsplashPicker
        trigger={null}
        open={unsplashOpen}
        onOpenChange={setUnsplashOpen}
        onSelect={(photo) => setHeader({ url: photo.rawUrl, alt: photo.alt, credit: creditFromPhoto(photo) })}
      />
    </form>
  );
}
