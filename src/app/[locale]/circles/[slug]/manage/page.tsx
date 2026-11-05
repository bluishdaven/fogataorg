import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CircleForm } from "@/components/circles/circle-form";
import { JoinRequests, MembersManager, SubmissionQueue } from "@/components/circles/manage-circle";
import { Toaster } from "@/components/ui/sonner";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/auth";
import { getCircleForManage } from "@/lib/data/circles";

type Props = PageProps<"/[locale]/circles/[slug]/manage">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Circles");
  return { title: t("manage"), robots: { index: false } };
}

export default function ManageCirclePage({ params }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Toaster position="bottom-center" />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" aria-hidden />}>
        <Manage params={params} />
      </Suspense>
    </div>
  );
}

async function Manage({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const viewer = await getViewer();
  const locale = await getLocale();
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/circles/${slug}/manage`)}`);
  const circle = await getCircleForManage(viewer, slug);
  if (!circle) notFound();
  const t = await getTranslations("Circles");

  return (
    <div className="flex flex-col gap-12">
      <div>
        <Link href={`/circles/${circle.slug}`} className="text-sm text-muted-foreground hover:text-foreground">
          {t("backToCircle", { name: circle.name })}
        </Link>
        <h1 className="mt-2 font-serif text-4xl font-semibold">{t("manageTitle", { name: circle.name })}</h1>
      </div>
      {circle.isPrivate || circle.joinRequests.length ? <JoinRequests requests={circle.joinRequests} /> : null}
      <SubmissionQueue pending={circle.pending} accepted={circle.accepted} />
      <MembersManager circleId={circle.id} members={circle.members} isOwner={circle.role === "owner"} />
      <section aria-labelledby="details-heading" className="flex flex-col gap-4">
        <h2 id="details-heading" className="font-serif text-2xl font-semibold">
          {t("details")}
        </h2>
        <CircleForm
          userId={viewer.id}
          initial={{
            circleId: circle.id,
            slug: circle.slug,
            name: circle.name,
            description: circle.description,
            accentColor: circle.accentColor,
            header: circle.header,
            isPrivate: circle.isPrivate,
          }}
        />
      </section>
    </div>
  );
}
