import { useTranslations } from "next-intl";
import { FlameLogo } from "@/components/flame-logo";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <FlameLogo className="h-12 opacity-60" animated={false} />
      <h1 className="font-serif text-3xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("body")}</p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        {t("home")}
      </Link>
    </div>
  );
}
