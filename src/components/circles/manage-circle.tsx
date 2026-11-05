"use client";

import NextLink from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { addCircleMember, decideSubmission, removeCircleMember, removeSubmission } from "@/app/actions/circles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { profilePath, storyPath } from "@/lib/domain/handle-routes";

type Submission = { id: string; createdAt: Date; storyTitle: string; storySlug: string; authorUsername: string; authorName: string };
type Member = { userId: string; role: "owner" | "editor" | "writer"; username: string; displayName: string };

export function SubmissionQueue({ pending, accepted }: { pending: Submission[]; accepted: Submission[] }) {
  const t = useTranslations("Circles");
  const format = useFormatter();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (id: string, action: () => Promise<{ ok: boolean }>, message: string) => {
    setBusy(id);
    const result = await action();
    setBusy(null);
    if (!result.ok) toast.error(t("errors.not_allowed"));
    else {
      toast(message);
      router.refresh();
    }
  };

  const row = (item: Submission, actions: React.ReactNode) => (
    <li key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between" data-testid="submission">
      <span className="min-w-0">
        <NextLink href={storyPath(item.authorUsername, item.storySlug)} className="block truncate font-serif font-semibold hover:text-ember-text">
          {item.storyTitle}
        </NextLink>
        <span className="text-xs text-muted-foreground">
          {t("byOn", { name: item.authorName || item.authorUsername, date: format.dateTime(item.createdAt, { dateStyle: "medium" }) })}
        </span>
      </span>
      <span className="flex shrink-0 gap-1">{actions}</span>
    </li>
  );

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="queue-heading">
        <h2 id="queue-heading" className="mb-2 font-serif text-2xl font-semibold">
          {t("queue", { count: pending.length })}
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("queueEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {pending.map((item) =>
              row(
                item,
                <>
                  <Button size="sm" disabled={busy === item.id} onClick={() => void act(item.id, () => decideSubmission({ submissionId: item.id, status: "accepted" }), t("acceptedToast"))}>
                    {t("accept")}
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === item.id} onClick={() => void act(item.id, () => decideSubmission({ submissionId: item.id, status: "declined" }), t("declinedToast"))}>
                    {t("decline")}
                  </Button>
                </>,
              ),
            )}
          </ul>
        )}
      </section>
      <section aria-labelledby="accepted-heading">
        <h2 id="accepted-heading" className="mb-2 font-serif text-2xl font-semibold">
          {t("inCircle", { count: accepted.length })}
        </h2>
        {accepted.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("inCircleEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {accepted.map((item) =>
              row(
                item,
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={busy === item.id}
                  onClick={() => window.confirm(t("removeStoryConfirm")) && void act(item.id, () => removeSubmission(item.id), t("removedToast"))}
                >
                  {t("removeStory")}
                </Button>,
              ),
            )}
          </ul>
        )}
      </section>
    </div>
  );
}

export function MembersManager({ circleId, members, isOwner }: { circleId: string; members: Member[]; isOwner: boolean }) {
  const t = useTranslations("Circles");
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"editor" | "writer">("editor");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await addCircleMember({ circleId, username, role });
    setPending(false);
    if (!result.ok) {
      setError(t(`errors.${result.errors[0] ?? "invalid"}`));
      return;
    }
    setUsername("");
    toast(t("memberAdded"));
    router.refresh();
  };

  const remove = async (userId: string) => {
    if (!window.confirm(t("removeMemberConfirm"))) return;
    const result = await removeCircleMember(circleId, userId);
    if (!result.ok) toast.error(t("errors.not_allowed"));
    else router.refresh();
  };

  return (
    <section aria-labelledby="members-heading" className="flex flex-col gap-3">
      <h2 id="members-heading" className="font-serif text-2xl font-semibold">
        {t("members")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("membersHint")}</p>
      <ul className="divide-y divide-border">
        {members.map((member) => (
          <li key={member.userId} className="flex items-center justify-between gap-3 py-2.5" data-testid="member">
            <span>
              <NextLink href={profilePath(member.username)} className="font-medium hover:text-ember-text">
                {member.displayName}
              </NextLink>{" "}
              <span className="text-xs text-muted-foreground">@{member.username}</span>
            </span>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              {t(`roles.${member.role}`)}
              {isOwner && member.role !== "owner" ? (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void remove(member.userId)}>
                  {t("removeMember")}
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {isOwner ? (
        <form onSubmit={add} className="flex flex-col gap-2 rounded-lg border border-border p-4 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="member-username">{t("addMember")}</Label>
            <Input id="member-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" spellCheck={false} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="member-role">{t("role")}</Label>
            <select
              id="member-role"
              value={role}
              onChange={(e) => setRole(e.target.value as "editor" | "writer")}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              <option value="editor">{t("roles.editor")}</option>
              <option value="writer">{t("roles.writer")}</option>
            </select>
          </div>
          <Button type="submit" disabled={pending || !username.trim()}>
            {t("add")}
          </Button>
          {error ? (
            <p role="alert" className="text-sm text-destructive sm:basis-full">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
