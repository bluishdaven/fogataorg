import { cn } from "@/lib/utils";

/**
 * The Fogata flame. Flickers gently; holds still under prefers-reduced-motion.
 * Decorative by default; pass `title` when it stands alone as a label.
 */
export function FlameLogo({
  className,
  animated = true,
  title,
}: {
  className?: string;
  animated?: boolean;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 40"
      className={cn("h-7 w-auto overflow-visible", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <g
        className={cn("origin-bottom", animated && "motion-safe:animate-flicker")}
        style={{ transformBox: "fill-box" }}
      >
        <path
          d="M16 1c1.2 6.4 6.6 9.6 9.8 15.2 3.6 6.4 2.3 14.4-3.2 18.6A11.5 11.5 0 0 1 4.3 30C1.8 23.8 4.6 18.4 8 15.2c.4 3 1.9 5 4.2 6C10.6 14.4 12.8 6.6 16 1Z"
          fill="var(--ember)"
        />
        <path
          className={cn("origin-bottom", animated && "motion-safe:animate-flicker-inner")}
          style={{ transformBox: "fill-box" }}
          d="M16.5 17c.6 3.6 3.9 5.4 4.6 9a6.3 6.3 0 0 1-12.2 3.2c-.7-2.9.6-5.3 2.4-6.8.3 1.6 1.1 2.6 2.4 3.1-.6-3.4.8-6.4 2.8-8.5Z"
          fill="#ffd27a"
        />
      </g>
    </svg>
  );
}
