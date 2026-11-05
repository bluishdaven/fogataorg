"use client";

import { Plus, Trash2 } from "lucide-react";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { updateProfile } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { profilePath } from "@/lib/domain/handle-routes";
import { BIO_MAX, DISPLAY_NAME_MAX, MAX_PROFILE_LINKS, type ProfileErrorKey } from "@/lib/domain/profile";
import { cn } from "@/lib/utils";

type Link = { label: string; url: string };

export function ProfileForm({
  initial,
}: {
  initial: { username: string; displayName: string; bio: string; links: Link[] };
}) {
  const t = useTranslations("Settings");
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [username, setUsername] = useState(initial.username);
  const [bio, setBio] = useState(initial.bio);
  const [links, setLinks] = useState<Link[]>(initial.links);
  const [errors, setErrors] = useState<ProfileErrorKey[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setErrors([]);
    setSaved(null);
    const result = await updateProfile({
      displayName,
      username,
      bio,
      links: links.filter((link) => link.label.trim() || link.url.trim()),
    });
    setPending(false);
    if (result.ok) setSaved(result.username);
    else setErrors(result.errors);
  };

  const has = (...keys: ProfileErrorKey[]) => keys.some((key) => errors.includes(key));

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      {errors.length ? (
        <ul role="alert" className="list-disc rounded-lg border border-destructive/30 bg-destructive/5 py-3 pr-4 pl-8 text-sm text-destructive">
          {errors.map((key) => (
            <li key={key}>{t(`errors.${key}`)}</li>
          ))}
        </ul>
      ) : null}
      {saved ? (
        <p role="status" className="rounded-lg bg-secondary px-4 py-3 text-sm" data-testid="profile-saved">
          {t("saved")}{" "}
          <NextLink href={profilePath(saved)} className="font-medium text-ember-text underline underline-offset-2">
            {t("viewProfile")}
          </NextLink>
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="display-name">{t("displayName")}</Label>
        <Input
          id="display-name"
          value={displayName}
          maxLength={DISPLAY_NAME_MAX}
          onChange={(event) => setDisplayName(event.target.value)}
          aria-invalid={has("displayName") || undefined}
          autoComplete="name"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="username">{t("username")}</Label>
        <div className="flex items-center rounded-lg border border-input focus-within:ring-3 focus-within:ring-ring/50">
          <span className="pl-2.5 text-muted-foreground" aria-hidden>
            fogata.org/@
          </span>
          <input
            id="username"
            value={username}
            maxLength={30}
            onChange={(event) => setUsername(event.target.value)}
            aria-invalid={has("username", "usernameReserved", "usernameTaken") || undefined}
            aria-describedby="username-hint"
            autoComplete="username"
            spellCheck={false}
            className="h-8 min-w-0 flex-1 bg-transparent pr-2.5 text-sm outline-none"
          />
        </div>
        <p id="username-hint" className="text-xs text-muted-foreground">
          {t("usernameHint")}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="bio">{t("bio")}</Label>
          <span className={cn("text-xs text-muted-foreground", bio.length > BIO_MAX && "text-destructive")} aria-hidden>
            {bio.length}/{BIO_MAX}
          </span>
        </div>
        <textarea
          id="bio"
          value={bio}
          maxLength={BIO_MAX}
          rows={3}
          onChange={(event) => setBio(event.target.value)}
          aria-invalid={has("bio") || undefined}
          className="rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("links")}</legend>
        <p className="text-xs text-muted-foreground">{t("linksHint")}</p>
        {links.map((link, index) => (
          <div key={index} className="flex gap-2">
            <Input
              aria-label={t("linkLabel")}
              placeholder={t("linkLabelPlaceholder")}
              value={link.label}
              maxLength={40}
              onChange={(event) => setLinks(links.map((l, i) => (i === index ? { ...l, label: event.target.value } : l)))}
              className="w-1/3"
            />
            <Input
              aria-label={t("linkUrl")}
              placeholder="https://"
              inputMode="url"
              value={link.url}
              maxLength={300}
              onChange={(event) => setLinks(links.map((l, i) => (i === index ? { ...l, url: event.target.value } : l)))}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("removeLink")}
              onClick={() => setLinks(links.filter((_, i) => i !== index))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        {links.length < MAX_PROFILE_LINKS ? (
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setLinks([...links, { label: "", url: "" }])}>
            <Plus />
            {t("addLink")}
          </Button>
        ) : null}
      </fieldset>

      <div>
        <Button type="submit" disabled={pending} data-testid="profile-save">
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
