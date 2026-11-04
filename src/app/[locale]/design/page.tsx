import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FlameLogo } from "@/components/flame-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UnsplashDemo } from "@/components/unsplash/unsplash-demo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Design");
  return { title: t("title"), robots: { index: false } };
}

const COLOR_TOKENS = [
  ["background", "foreground"],
  ["card", "card-foreground"],
  ["primary", "primary-foreground"],
  ["secondary", "secondary-foreground"],
  ["muted", "muted-foreground"],
  ["accent", "accent-foreground"],
  ["ember-soft", "ember-text"],
] as const;

const TYPE_SCALE = [
  { token: "text-display", className: "text-display font-serif font-semibold" },
  { token: "text-title", className: "text-title font-serif font-semibold" },
  { token: "text-heading", className: "text-heading font-serif font-semibold" },
  { token: "text-reading", className: "text-reading font-serif" },
  { token: "text-base (UI)", className: "text-base" },
  { token: "text-sm (UI)", className: "text-sm" },
] as const;

const VOCABULARY = ["sparks", "circle", "ember", "saved", "burningNow", "weeklySpark"] as const;

export default async function DesignPage() {
  const [t, tv] = await Promise.all([getTranslations("Design"), getTranslations("Vocabulary")]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-14 px-4 py-12 sm:py-16">
      <header className="flex flex-col gap-3">
        <h1 className="font-serif text-4xl font-semibold">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("lede")}</p>
      </header>

      <section aria-labelledby="brand" className="flex flex-col gap-4">
        <h2 id="brand" className="font-serif text-2xl font-semibold">{t("brand")}</h2>
        <div className="flex items-end gap-6">
          <FlameLogo className="h-20" title="Fogata" />
          <FlameLogo className="h-12" animated={false} />
          <FlameLogo className="h-7" />
        </div>
        <p className="text-sm text-muted-foreground">{t("flameCaption")}</p>
      </section>

      <section aria-labelledby="colors" className="flex flex-col gap-4">
        <h2 id="colors" className="font-serif text-2xl font-semibold">{t("colors")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COLOR_TOKENS.map(([bg, fg]) => (
            <li
              key={bg}
              className="flex h-24 flex-col justify-between rounded-xl border border-border p-4"
              style={{ background: `var(--${bg})`, color: `var(--${fg})` }}
            >
              <span className="font-serif text-lg font-semibold">Aa · Ññ</span>
              <code className="text-xs">
                --{bg} / --{fg}
              </code>
            </li>
          ))}
          <li className="flex h-24 flex-col justify-between rounded-xl border border-border bg-background p-4">
            <span className="flex gap-2">
              <span className="size-6 rounded-full" style={{ background: "var(--ember)" }} />
              <span className="size-6 rounded-full" style={{ background: "var(--ring)" }} />
              <span className="size-6 rounded-full" style={{ background: "var(--destructive)" }} />
            </span>
            <code className="text-xs">--ember / --ring / --destructive</code>
          </li>
        </ul>
      </section>

      <section aria-labelledby="type" className="flex flex-col gap-4">
        <h2 id="type" className="font-serif text-2xl font-semibold">{t("type")}</h2>
        <ul className="flex flex-col gap-4">
          {TYPE_SCALE.map(({ token, className }) => (
            <li key={token} className="flex flex-col gap-1 border-b border-border pb-4">
              <code className="text-xs text-muted-foreground">{token}</code>
              <span className={className}>Historias alrededor del fuego</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="reading" className="flex flex-col gap-4">
        <h2 id="reading" className="font-serif text-2xl font-semibold">{t("reading")}</h2>
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="prose-fogata">{t("readingSample")}</p>
        </div>
      </section>

      <section aria-labelledby="components" className="flex flex-col gap-6">
        <h2 id="components" className="font-serif text-2xl font-semibold">{t("components")}</h2>
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-muted-foreground">{t("buttons")}</h3>
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Destructive</Button>
            <Button disabled>Disabled</Button>
          </div>
        </div>
        <div className="flex max-w-sm flex-col gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{t("inputs")}</h3>
          <Label htmlFor="design-email">Email</Label>
          <Input id="design-email" type="email" placeholder="you@example.com" />
        </div>
      </section>

      <section aria-labelledby="image-search" className="flex flex-col gap-4">
        <h2 id="image-search" className="font-serif text-2xl font-semibold">{t("imageSearch")}</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("imageSearchNote")}</p>
        <UnsplashDemo />
      </section>

      <section aria-labelledby="vocabulary" className="flex flex-col gap-4">
        <h2 id="vocabulary" className="font-serif text-2xl font-semibold">{t("vocabulary")}</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("vocabularyNote")}</p>
        <table className="w-full max-w-2xl text-left text-sm">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th scope="col" className="py-2 font-medium">{t("term")}</th>
              <th scope="col" className="py-2 font-medium">{t("meaning")}</th>
            </tr>
          </thead>
          <tbody>
            {VOCABULARY.map((key) => (
              <tr key={key} className="border-b border-border">
                <td className="py-2 font-medium">{tv(key)}</td>
                <td className="py-2 text-muted-foreground">{tv(`${key}Meaning`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
