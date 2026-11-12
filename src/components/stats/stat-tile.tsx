import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Delta = { direction: "up" | "down" | "flat"; text: string } | null;

/** One headline number with an optional change against the previous period. */
export function StatTile({
  label,
  hint,
  children,
  delta,
  comparison,
  index = 0,
  testId,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  delta?: Delta;
  comparison?: string;
  index?: number;
  testId?: string;
}) {
  return (
    <div
      className="rise-in flex flex-col gap-1 rounded-2xl border border-border/70 bg-card p-4"
      style={{ "--delay": `${index * 70}ms` } as CSSProperties}
      data-testid={testId}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold tracking-tight">{children}</p>
      {delta ? (
        <p className={cn("flex items-start gap-1 text-sm", delta.direction === "up" ? "text-ember-text" : "text-muted-foreground")}>
          {delta.direction === "up" ? <ArrowUpRight className="size-4 shrink-0" aria-hidden /> : null}
          {delta.direction === "down" ? <ArrowDownRight className="size-4 shrink-0" aria-hidden /> : null}
          <span>
            {delta.text}
            {comparison ? <span className="text-muted-foreground"> {comparison}</span> : null}
          </span>
        </p>
      ) : comparison ? (
        <p className="text-sm text-muted-foreground">{comparison}</p>
      ) : null}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
