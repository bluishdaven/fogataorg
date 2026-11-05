/**
 * True only for the public site (a Vercel production deployment). Local and CI
 * production builds, and Vercel previews, return false, so internal pages such
 * as the style guide stay available there for development and tests.
 * Read at build time; Vercel sets VERCEL_ENV for builds and functions.
 */
export const isPublicSite = process.env.VERCEL_ENV === "production";
