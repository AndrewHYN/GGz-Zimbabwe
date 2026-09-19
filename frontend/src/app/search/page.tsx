import { Suspense } from "react";
import SearchContent from "./SearchContent";

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1536px] mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-6">Search</h1>
          <div className="text-center py-12 text-ggz-text-muted">Loading...</div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
