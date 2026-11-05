"use client";

import { Camera, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState, type ChangeEvent } from "react";
import { updateAvatar } from "@/app/actions/profile";
import { Avatar } from "@/components/avatar";
import { UploadError } from "@/components/editor/upload";
import { ACCEPTED_AVATAR_TYPES, deleteAvatarFile, uploadAvatar } from "@/components/profile/upload-avatar";
import { Button } from "@/components/ui/button";

type Status = "idle" | "working" | "saved" | "removed" | "type" | "size" | "failed" | "unauthorized";

export function AvatarEditor({ userId, name, initialUrl }: { userId: string; name: string; initialUrl: string | null }) {
  const t = useTranslations("Settings");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [status, setStatus] = useState<Status>("idle");
  const working = status === "working";

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setStatus("working");
    let uploaded: string | null = null;
    try {
      uploaded = await uploadAvatar(file, userId);
      const result = await updateAvatar({ avatarUrl: uploaded });
      if (!result.ok) {
        await deleteAvatarFile(uploaded);
        setStatus(result.error === "unauthorized" ? "unauthorized" : "failed");
        return;
      }
      const previous = url;
      setUrl(uploaded);
      setStatus("saved");
      void deleteAvatarFile(previous);
      router.refresh();
    } catch (error) {
      if (uploaded) void deleteAvatarFile(uploaded);
      setStatus(error instanceof UploadError ? error.reason : "failed");
    }
  };

  const remove = async () => {
    setStatus("working");
    try {
      const result = await updateAvatar({ avatarUrl: null });
      if (!result.ok) {
        setStatus(result.error === "unauthorized" ? "unauthorized" : "failed");
        return;
      }
      const previous = url;
      setUrl(null);
      setStatus("removed");
      void deleteAvatarFile(previous);
      router.refresh();
    } catch {
      setStatus("failed");
    }
  };

  const error = status === "type" || status === "size" || status === "failed" || status === "unauthorized";

  return (
    <section aria-labelledby="photo-heading" className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
      <Avatar name={name} url={url} className="size-24 text-2xl ring-4 ring-background shadow-sm sm:size-28" />
      <div className="flex flex-col gap-3">
        <div>
          <h2 id="photo-heading" className="font-medium">
            {t("photo")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("photoHint")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept={ACCEPTED_AVATAR_TYPES}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={choose}
            data-testid="avatar-input"
          />
          <Button type="button" variant="outline" disabled={working} onClick={() => input.current?.click()} data-testid="avatar-upload">
            <Camera aria-hidden />
            {working ? t("photoWorking") : url ? t("changePhoto") : t("uploadPhoto")}
          </Button>
          {url ? (
            <Button type="button" variant="ghost" disabled={working} onClick={remove} data-testid="avatar-remove">
              <Trash2 aria-hidden />
              {t("removePhoto")}
            </Button>
          ) : null}
        </div>
        {status === "saved" || status === "removed" ? (
          <p role="status" className="text-sm text-muted-foreground" data-testid="avatar-status">
            {status === "saved" ? t("photoSaved") : t("photoRemoved")}
          </p>
        ) : error ? (
          <p role="alert" className="text-sm text-destructive">
            {t(`photoErrors.${status}`)}
          </p>
        ) : null}
      </div>
    </section>
  );
}
