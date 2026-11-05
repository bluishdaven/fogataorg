import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/auth";
import { listCircles } from "@/lib/data/circles";
import { readableTextOn } from "@/lib/domain/circles";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Circles");
  return { title: t("title"), description: t("lede") };
}

export default async function CirclesPage() {
  const [t, circles] = await Promise.all([getTranslations("Circles"), listCircles()]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl font-semibold">{t("title")}</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">{t("lede")}</p>
        </div>
        <Suspense fallback={null}>
          <StartCircle />
        </Suspense>
      </div>
      {circles.length === 0 ? (
        <p className="mt-10 text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2" data-testid="circle-list">
          {circles.map((circle) => (
            <li key={circle.id}>
              <Link href={`/circles/${circle.slug}`} className="block h-full overflow-hidden rounded-xl border border-border hover:shadow-md">
                <div
                  className="flex items-start justify-between gap-3 px-4 py-3"
                  style={{ backgroundColor: circle.accentColor, color: readableTextOn(circle.accentColor) }}
                >
                  <span className="font-serif text-lg font-semibold">{circle.name}</span>
                  {circle.isPrivate ? (
                    <span className="mt-1 inline-flex shrink-0 items-center gap-1 text-xs font-medium" data-testid="circle-private">
                      <Lock className="size-3.5" aria-hidden />
                      {t("private")}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 px-4 py-3 text-sm">
                  {circle.description ? <p className="line-clamp-2 text-pretty">{circle.description}</p> : null}
                  <p className="text-muted-foreground">
                    {t("storyCount", { count: circle.stories })} · {t("followerCount", { count: circle.followers })}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function StartCircle() {
  const [viewer, t] = await Promise.all([getViewer(), getTranslations("Circles")]);
  if (!viewer) return null;
  return (
    <Link href="/circles/new" className={buttonVariants()} data-testid="start-circle">
      {t("start")}
    </Link>
  );
}
