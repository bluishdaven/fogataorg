import type { MetadataRoute } from "next";
import { isPublicSite } from "@/lib/deployment";
import { robotsPolicy } from "@/lib/domain/seo";
import { publicEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return robotsPolicy(isPublicSite, publicEnv.NEXT_PUBLIC_SITE_URL);
}
