"use client";

import { UserPlus } from "lucide-react";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { requestToJoin, withdrawJoinRequest } from "@/app/actions/circles";
import { Button, buttonVariants } from "@/components/ui/button";

/** For people outside a private circle: ask to join, see that the request is waiting, or take it back. */
export function JoinCircleButton({
  circleId,
  circleName,
  initialRequest,
  signedIn,
  loginHref,
}: {
  circleId: string;
  circleName: string;
  initialRequest: "pending" | "declined" | null;
  signedIn: boolean;
  loginHref: string;
}) {
  const t = useTranslations("Circles");
  const router = useRouter();
  const [request, setRequest] = useState(initialRequest);
  const [busy, setBusy] = useState(false);

  if (!signedIn) {
    return (
      <NextLink href={loginHref} className={buttonVariants({ variant: "secondary", size: "sm" })} data-testid="request-to-join">
        <UserPlus />
        {t("requestToJoin")}
      </NextLink>
    );
  }

  if (request === "declined") {
    return (
      <span data-testid="join-declined">
        {t("requestDeclined")}
      </span>
    );
  }

  const ask = async () => {
    setBusy(true);
    const result = await requestToJoin({ circleId });
    setBusy(false);
    if (!result.ok) {
      toast.error(t(`errors.${result.errors[0] ?? "invalid"}`));
      return;
    }
    setRequest("pending");
    toast.success(t("requestSentToast", { circle: circleName }));
  };

  const cancel = async () => {
    setBusy(true);
    const result = await withdrawJoinRequest({ circleId });
    setBusy(false);
    if (!result.ok) {
      toast.error(t(`errors.${result.errors[0] ?? "invalid"}`));
      router.refresh();
      return;
    }
    setRequest(null);
    toast(t("requestCanceledToast"));
  };

  if (request === "pending") {
    return (
      <span className="flex flex-wrap items-center gap-2" data-testid="join-pending">
        <span className="font-medium">{t("requestSent")}</span>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void cancel()} data-testid="cancel-join-request">
          {t("cancelRequest")}
        </Button>
      </span>
    );
  }

  return (
    <Button variant="secondary" size="sm" disabled={busy} onClick={() => void ask()} data-testid="request-to-join">
      <UserPlus />
      {t("requestToJoin")}
    </Button>
  );
}
