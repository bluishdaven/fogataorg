import type { CSSProperties } from "react";

/**
 * A number that counts up from zero (CSS only; see `.count-up` in globals.css). Screen readers and
 * reduced-motion readers get the final value straight away. Values of 1,000 or more, or with
 * decimals, are shown as they are: the CSS counter can't place thousands separators.
 */
export function CountUp({ value, formatted, delay = 0 }: { value: number; formatted: string; delay?: number }) {
  if (!Number.isInteger(value) || value < 0 || value >= 1000) return <>{formatted}</>;
  return (
    <>
      <span className="sr-only">{formatted}</span>
      <span aria-hidden className="count-up" style={{ "--count": value, "--delay": `${delay}ms` } as CSSProperties} />
    </>
  );
}
