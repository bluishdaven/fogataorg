import type { CSSProperties } from "react";

/**
 * How far visitors got: one meter per milestone, the share of visitors who reached it. The track
 * is a lighter step of the ember ramp; the figure beside each bar carries the value.
 */
export function DepthMeters({ rows }: { rows: { key: string; label: string; share: number; figure: string }[] }) {
  return (
    <ul className="flex flex-col gap-3" data-testid="read-depth">
      {rows.map((row, index) => (
        <li key={row.key} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr_auto]">
          <span className="text-muted-foreground">{row.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-ember-soft" aria-hidden>
            <span
              className="meter-fill block h-full rounded-full bg-chart-reads"
              style={{ width: `${Math.round(row.share * 100)}%`, "--delay": `${200 + index * 120}ms` } as CSSProperties}
            />
          </span>
          <span className="text-right tabular-nums">{row.figure}</span>
        </li>
      ))}
    </ul>
  );
}
