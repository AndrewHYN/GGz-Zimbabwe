const API_BASE = process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8000";

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Marketplace - GG2",
  description: "Buy and sell gaming gear",
};

interface Listing {
  id: number;
  title: string;
  price: string;
  condition: string;
  category: string;
  location: string;
  seller_name: string;
  seller_avatar: string | null;
  image: string | null;
  save_count: number;
  created_at: string;
}

const CATEGORIES = [
  "All",
  "Consoles",
  "Controllers",
  "Headsets",
  "Monitors",
  "Keyboards",
  "Mice",
  "Games",
  "Accessories",
  "Other",
];

const CONDITIONS = ["All", "New", "Like New", "Good", "Fair", "Poor"];

const CONDITION_COLORS: Record<string, string> = {
  New: "bg-green-500/20 text-green-400 border-green-500/30",
  "Like New": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Good: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Fair: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Poor: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const category = typeof params.category === "string" ? params.category : "All";
  const condition = typeof params.condition === "string" ? params.condition : "All";

  const apiUrl = new URL(`${API_BASE}/api/marketplace/`);
  apiUrl.searchParams.set("format", "json");
  if (category !== "All") apiUrl.searchParams.set("category", category);
  if (condition !== "All") apiUrl.searchParams.set("condition", condition);

  let listings: Listing[] = [];
  try {
    const res = await fetch(apiUrl.toString(), { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      listings = data.results ?? data;
    }
  } catch {
    // keep listings empty on failure
  }

  return (
    <div className="min-h-screen bg-ggz-bg-1">
      <div className="mx-auto max-w-[1536px] px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-ggz-text-primary">Marketplace</h1>
          <p className="mt-1 text-ggz-text-secondary">Buy and sell gaming gear</p>
        </div>

        {/* Filters */}
        <form className="mb-6 flex flex-wrap gap-3">
          <select
            name="category"
            defaultValue={category}
            className="rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-2 px-4 py-2 text-sm text-ggz-text-primary focus:outline-none focus:ring-2 focus:ring-ggz-amber/50"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c === "All" ? "All Categories" : c}
              </option>
            ))}
          </select>

          <select
            name="condition"
            defaultValue={condition}
            className="rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-2 px-4 py-2 text-sm text-ggz-text-primary focus:outline-none focus:ring-2 focus:ring-ggz-amber/50"
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c === "All" ? "All Conditions" : c}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="rounded-[var(--radius-lg)] bg-ggz-amber px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
          >
            Apply Filters
          </button>
        </form>

        {/* Listings Grid */}
        {listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-2 py-20 text-center">
            <p className="text-lg font-semibold text-ggz-text-primary">No listings found.</p>
            <p className="mt-1 text-ggz-text-secondary">
              Be the first to list something!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <Link
                key={listing.id}
                href={`/marketplace/listing/${listing.id}`}
                className="group flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-2 transition hover:border-ggz-amber/40 hover:shadow-lg hover:shadow-ggz-amber/5"
              >
                {/* Image */}
                <div className="relative aspect-[16/10] w-full bg-ggz-bg-1">
                  {listing.image ? (
                    <Image
                      src={listing.image}
                      alt={listing.title}
                      fill
                      className="object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-ggz-text-secondary">
                      <svg
                        className="h-12 w-12 opacity-30"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="truncate font-semibold text-ggz-text-primary">
                    {listing.title}
                  </h3>

                  <p className="mt-1 text-lg font-bold text-ggz-amber">
                    ${parseFloat(listing.price).toFixed(2)}
                  </p>

                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
                        CONDITION_COLORS[listing.condition] ?? "border-ggz-border bg-ggz-bg-1 text-ggz-text-secondary"
                      }`}
                    >
                      {listing.condition}
                    </span>
                  </div>

                  {/* Meta */}
                  <div className="mt-auto pt-3">
                    {/* Seller */}
                    <div className="flex items-center gap-2">
                      <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-ggz-bg-1">
                        {listing.seller_avatar ? (
                          <Image
                            src={listing.seller_avatar}
                            alt={listing.seller_name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-ggz-text-secondary">
                            {listing.seller_name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className="truncate text-xs text-ggz-text-secondary">
                        {listing.seller_name}
                      </span>
                    </div>

                    {/* Location, saves, date */}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ggz-text-secondary">
                      {listing.location && (
                        <span className="flex items-center gap-1">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                            />
                          </svg>
                          {listing.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                          />
                        </svg>
                        {listing.save_count}
                      </span>
                      <span>
                        {new Date(listing.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
