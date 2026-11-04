export function StoryListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden className="divide-y divide-border">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-3 py-6">
          <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
          <div className="h-6 w-4/5 animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
          <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
