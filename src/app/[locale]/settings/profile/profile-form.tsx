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
import {
  BIO_MAX,
  DISPLAY_NAME_MAX,
  INFLUENCE_KINDS,
  MAX_PROFILE_LINKS,
  NOW_FOCUSES,
  NOW_TEXT_MAX,
  PRONOUNS_MAX,
  type InfluenceKind,
  type Influences,
  type NowFocus,
  type ProfileErrorKey,
} from "@/lib/domain/profile";
import { cn } from "@/lib/utils";

type Link = { label: string; url: string };

export function ProfileForm({
  initial,
}: {
  initial: {
    username: string;
    displayName: string;
    bio: string;
    links: Link[];
    pronouns: string;
    nowFocus: NowFocus;
    nowText: string;
    influences: Influences;
  };
}) {
  const t = useTranslations("Settings");
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [username, setUsername] = useState(initial.username);
  const [bio, setBio] = useState(initial.bio);
  const [links, setLinks] = useState<Link[]>(initial.links);
  const [pronouns, setPronouns] = useState(initial.pronouns);
  const [nowFocus, setNowFocus] = useState<NowFocus>(initial.nowFocus);
  const [nowText, setNowText] = useState(initial.nowText);
  // One entry per line while editing.
  const [influences, setInfluences] = useState<Record<InfluenceKind, string>>(
    () => Object.fromEntries(INFLUENCE_KINDS.map((kind) => [kind, (initial.influences[kind] ?? []).join("\n")])) as Record<InfluenceKind, string>,
  );
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
      pronouns,
      nowFocus,
      nowText,
      influences: Object.fromEntries(INFLUENCE_KINDS.map((kind) => [kind, influences[kind].split("\n")])),
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
            className="h-11 min-w-0 flex-1 bg-transparent pr-3 text-base outline-none sm:h-9 sm:text-sm"
          />
        </div>
        <p id="username-hint" className="text-xs text-muted-foreground">
          {t("usernameHint")}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pronouns">{t("pronouns")}</Label>
        <Input
          id="pronouns"
          value={pronouns}
          maxLength={PRONOUNS_MAX}
          placeholder={t("pronounsPlaceholder")}
          onChange={(event) => setPronouns(event.target.value)}
          aria-invalid={has("pronouns") || undefined}
          aria-describedby="pronouns-hint"
          autoComplete="off"
          className="sm:max-w-xs"
        />
        <p id="pronouns-hint" className="text-xs text-muted-foreground">
          {t("pronounsHint")}
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

      <fieldset className="flex flex-col gap-2" data-testid="now-fieldset">
        <legend className="mb-1 text-sm font-medium">{t("now")}</legend>
        <p className="text-xs text-muted-foreground">{t("nowHint")}</p>
        <div role="radiogroup" aria-label={t("nowFocus")} className="flex flex-wrap gap-2">
          {NOW_FOCUSES.map((focus) => (
            <label
              key={focus}
              className="flex min-h-11 cursor-pointer items-center rounded-full border border-input px-4 text-sm has-checked:border-primary has-checked:bg-ember-soft has-focus-visible:ring-3 has-focus-visible:ring-ring/50 sm:min-h-8 sm:px-3"
            >
              <input
                type="radio"
                name="now-focus"
                value={focus}
                checked={nowFocus === focus}
                onChange={() => setNowFocus(focus)}
                className="sr-only"
              />
              {t(`focus.${focus}`)}
            </label>
          ))}
        </div>
        <Label htmlFor="now-text" className="sr-only">
          {t("nowText", { focus: nowFocus })}
        </Label>
        <Input
          id="now-text"
          value={nowText}
          maxLength={NOW_TEXT_MAX}
          placeholder={t("nowPlaceholder", { focus: nowFocus })}
          onChange={(event) => setNowText(event.target.value)}
          aria-invalid={has("nowText") || undefined}
        />
      </fieldset>

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

      <fieldset className="flex flex-col gap-3" data-testid="influences-fieldset">
        <legend className="mb-1 text-sm font-medium">{t("influences")}</legend>
        <p className="text-xs text-muted-foreground">{t("influencesHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {INFLUENCE_KINDS.map((kind) => (
            <div key={kind} className="flex flex-col gap-1.5">
              <Label htmlFor={`influences-${kind}`}>{t(`influenceKinds.${kind}`)}</Label>
              <textarea
                id={`influences-${kind}`}
                value={influences[kind]}
                rows={3}
                placeholder={t("influencePlaceholder", { kind })}
                onChange={(event) => setInfluences({ ...influences, [kind]: event.target.value })}
                aria-invalid={has("influence", "tooManyInfluences") || undefined}
                className="rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          ))}
        </div>
      </fieldset>

      <div>
        <Button type="submit" disabled={pending} data-testid="profile-save">
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
