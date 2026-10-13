import { Skeleton } from "@/components/ui/skeleton";

/** Shaped like the screen it stands in for, so nothing jumps when the data streams in. */
export function PageSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="grid min-h-0 flex-1 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="hidden space-y-2 border-r p-4 lg:block">
        <Skeleton className="mb-4 h-6 w-28" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
      <div className="space-y-6 p-6">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
