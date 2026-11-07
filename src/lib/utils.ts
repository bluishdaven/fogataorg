export { cn } from "cn"

/** Smooth scrolling unless the reader asked for less motion (CSS can't reach scrollIntoView). */
export function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
}
