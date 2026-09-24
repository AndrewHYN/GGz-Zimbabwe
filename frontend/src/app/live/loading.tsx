import { Skeleton } from "@/components/ui/Skeleton";

export default function LiveLoading() {
  return (
    <div className="mx-auto max-w-[1536px] px-4 pb-24 pt-10">
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-9 w-48 mb-3" />
      <Skeleton className="h-4 w-72 mb-8" />
      <div className="mb-8 flex gap-2">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
      <Skeleton className="h-6 w-32 mb-4" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1">
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
