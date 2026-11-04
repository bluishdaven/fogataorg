"use client";

import { Button } from "@/components/ui/button";

/** Submit button that asks for confirmation first (for destructive form actions). */
export function ConfirmSubmit({ message, label }: { message: string; label: string }) {
  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      className="text-destructive hover:text-destructive"
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {label}
    </Button>
  );
}
