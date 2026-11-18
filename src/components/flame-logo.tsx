import { cn } from "@/lib/utils";

/** The flame's resting shape: what still logos, reduced motion and browsers without path animation show. */
export const FLAME_OUTER =
  "M16 1c1.2 6.4 6.6 9.6 9.8 15.2 3.6 6.4 2.3 14.4-3.2 18.6A11.5 11.5 0 0 1 4.3 30C1.8 23.8 4.6 18.4 8 15.2c.4 3 1.9 5 4.2 6C10.6 14.4 12.8 6.6 16 1Z";
export const FLAME_INNER =
  "M16.5 17c.6 3.6 3.9 5.4 4.6 9a6.3 6.3 0 0 1-12.2 3.2c-.7-2.9.6-5.3 2.4-6.8.3 1.6 1.1 2.6 2.4 3.1-.6-3.4.8-6.4 2.8-8.5Z";

/**
 * The Fogata flame. Alive by default: it lights up when the page loads, then for a few cycles the
 * tip licks and leans (the outline itself moves, from the resting shape in globals.css
 * `flame-dance`), the heart dances and sparks drift off the tip; after that it breathes gently
 * (cheap: no repainting) until pointed at, when it flares and dances again. Holds its resting shape under prefers-reduced-motion and with `animated={false}`.
 * Decorative by default; pass `title` when it stands alone as a label.
 */
export function FlameLogo({
  className,
  animated = true,
  continuous = false,
  title,
}: {
  className?: string;
  animated?: boolean;
  /** Keep the full dance going (listen mode while reading); otherwise it settles after a few cycles. */
  continuous?: boolean;
  title?: string;
}) {
  // The wrapper carries the size and the breathing sway: a transform on an HTML element runs on the
  // compositor, which a transform on the <svg> itself doesn't (Chrome recalculated styles every frame).
  const flame = (
    <svg viewBox="0 0 32 40" className="h-full w-auto overflow-visible" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <g className="flame-flare">
        <g className="flame-ignite">
          <path className="flame-outer" d={FLAME_OUTER} fill="var(--ember)" />
          <path className="flame-core" d={FLAME_INNER} fill="#ffd27a" />
        </g>
      </g>
      {animated ? (
        <g aria-hidden>
          <circle className="flame-spark" cx="16" cy="5" r="1.1" fill="#ffd27a" />
          <circle className="flame-spark flame-spark-2" cx="17" cy="7" r="0.9" fill="var(--ember)" />
        </g>
      ) : null}
    </svg>
  );
  return (
    <span className={cn("inline-flex h-7 w-auto shrink-0", animated && "flame-live", animated && continuous && "flame-continuous", className)}>
      {flame}
    </span>
  );
}
