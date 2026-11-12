import { getViewer } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { FeatureToggle } from "./feature-toggle";

/** The Feature toggle under an entry, for admins only (rendered in its own Suspense). */
export async function AdminFeature({ className, ...props }: { promptId: string; storyId: string; featured: boolean; title: string; className?: string }) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return null;
  return (
    <div className={cn("-mt-3 mb-3 flex justify-end", className)}>
      <FeatureToggle {...props} />
    </div>
  );
}
