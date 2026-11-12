import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

// Fixed positions and timings, so server and client render the same thing.
const EMBERS = [
  { x: "22%", dx: "-8px", delay: "0s", size: "4px", duration: "4.4s" },
  { x: "48%", dx: "6px", delay: "1.3s", size: "3px", duration: "5.2s" },
  { x: "70%", dx: "-4px", delay: "2.4s", size: "4px", duration: "4.8s" },
  { x: "35%", dx: "10px", delay: "3.1s", size: "3px", duration: "5.6s" },
  { x: "60%", dx: "-10px", delay: "0.7s", size: "2px", duration: "4.1s" },
  { x: "82%", dx: "5px", delay: "1.9s", size: "3px", duration: "5s" },
  { x: "12%", dx: "7px", delay: "2.8s", size: "2px", duration: "4.6s" },
  { x: "55%", dx: "-6px", delay: "3.8s", size: "4px", duration: "5.4s" },
] as const;

/**
 * A few embers drifting up, behind a flame or across a card. Decorative; still (invisible) under
 * reduced motion. Position it with `className` inside a `relative` parent.
 */
export function EmberDrift({ className, count = 6, rise = "-90px" }: { className?: string; count?: number; rise?: string }) {
  return (
    <div aria-hidden className={cn("ember-drift", className)} style={{ "--rise": rise } as CSSProperties}>
      {EMBERS.slice(0, count).map((ember, index) => (
        <span
          key={index}
          style={{ "--x": ember.x, "--dx": ember.dx, "--delay": ember.delay, "--size": ember.size, "--duration": ember.duration } as CSSProperties}
        />
      ))}
    </div>
  );
}
