"use client";

import { LogOut } from "lucide-react";
import { useRef, type FormEvent, type ReactNode } from "react";
import { signOut } from "@/app/actions/auth";
import { forgetDevice } from "@/lib/push-client";

/**
 * Sign out, after this device lets go of the person: no more of their push notifications here, and
 * no offline copies of pages as they saw them. Then the form submits as usual.
 */
export function SignOutForm({ locale, children }: { locale: string; children: ReactNode }) {
  const cleared = useRef(false);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (cleared.current) return;
    event.preventDefault();
    const form = event.currentTarget;
    void forgetDevice().finally(() => {
      cleared.current = true;
      form.requestSubmit();
    });
  };
  return (
    <form action={signOut} onSubmit={onSubmit} className="w-full">
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" className="flex w-full items-center gap-2" data-testid="sign-out">
        <LogOut className="size-4 text-muted-foreground" />
        {children}
      </button>
    </form>
  );
}
