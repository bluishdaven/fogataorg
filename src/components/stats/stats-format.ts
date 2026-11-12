import { change, formatDuration } from "@/lib/domain/stats";

type NumberFormatter = { number(value: number, options?: Intl.NumberFormatOptions): string };

/** Which way a number moved against the previous period, and by how much (as a percent); null without a base. */
export function deltaParts(format: NumberFormatter, current: number, previous: number): { direction: "up" | "down" | "flat"; value: string } | null {
  const relative = change(current, previous);
  if (relative === null) return null;
  const value = format.number(Math.abs(relative), { style: "percent", maximumFractionDigits: 0 });
  if (Math.abs(relative) < 0.005) return { direction: "flat", value };
  return { direction: relative > 0 ? "up" : "down", value };
}

/** Minutes and zero-padded seconds for a reading time ("4" and "05"). */
export function durationParts(seconds: number): { minutes: number; seconds: string } {
  const parts = formatDuration(seconds);
  return { minutes: parts.minutes, seconds: String(parts.seconds).padStart(2, "0") };
}
