import { Skeleton } from "@/components/ui/Skeleton";

export default function MarketplaceLoading() {
  return (
    <div className="mx-auto max-w-[1536px] px-4 py-8">
      <Skeleton className="mb-3 h-9 w-56" />
      <Skeleton className="mb-8 h-4 w-72" />
      <div className="mb-6 flex gap-3">
        <Skeleton className="h-10 w-40 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-10 w-36 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-10 w-32 rounded-[var(--radius-lg)]" />
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1">
            <Skeleton className="aspect-[16/10] w-full rounded-none" />
            <div className="space-y-3 p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
