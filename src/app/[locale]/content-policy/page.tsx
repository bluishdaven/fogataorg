import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { LEGAL_PATHS, LegalDocument, legalDoc } from "@/components/legal/legal-document";
import { localeAlternates } from "@/lib/domain/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [data, locale] = await Promise.all([legalDoc("content"), getLocale()]);
  return { title: data.title, description: data.description, alternates: localeAlternates(locale, LEGAL_PATHS.content) };
}

export default function Page() {
  return <LegalDocument doc="content" />;
}
