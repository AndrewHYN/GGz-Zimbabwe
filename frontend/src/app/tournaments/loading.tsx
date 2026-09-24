import { Skeleton } from "@/components/ui/Skeleton";

export default function TournamentsLoading() {
  return (
    <div className="mx-auto max-w-[1536px] px-4 py-8">
      <Skeleton className="mb-3 h-9 w-48" />
      <Skeleton className="mb-8 h-4 w-72" />
      <div className="mb-6 flex gap-2">
        <Skeleton className="h-10 w-24 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-10 w-36 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-10 w-20 rounded-[var(--radius-lg)]" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 p-5">
            <Skeleton className="mb-3 h-3 w-24" />
            <Skeleton className="mb-4 h-5 w-3/4" />
            <div className="mb-4 flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="mb-2 h-4 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
