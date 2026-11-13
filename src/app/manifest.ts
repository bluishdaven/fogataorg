import type { MetadataRoute } from "next";
import { APP_MANIFEST } from "@/lib/domain/app";

/** Served at /manifest.webmanifest: what makes Fogata installable (see docs/plans/app.md). */
export default function manifest(): MetadataRoute.Manifest {
  return APP_MANIFEST;
}
