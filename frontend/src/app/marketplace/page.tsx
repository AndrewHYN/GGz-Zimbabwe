const API_BASE = process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8000";

import type { Metadata } from "next";
import { StoreIcon } from "@/components/icons";
import { ListingCard } from "@/components/cards";
import { EmptyState } from "@/components/ui/EmptyState";
import { MotionReveal } from "@/components/motion/MotionReveal";

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
    <div className="mx-auto max-w-[1536px] px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ggz-text-primary">Marketplace</h1>
        <p className="mt-1 text-ggz-text-secondary">Buy and sell gaming gear</p>
      </div>

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

      {listings.length === 0 ? (
        <EmptyState
          icon={<StoreIcon size={40} />}
          title="No listings found"
          description="Be the first to list something for the community."
          action={{ label: "View marketplace", href: "/marketplace" }}
        />
      ) : (
        <MotionReveal>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                id={listing.id}
                title={listing.title}
                price={listing.price}
                condition={listing.condition}
                image={listing.image}
                seller_name={listing.seller_name}
                seller_avatar={listing.seller_avatar}
                location={listing.location}
                save_count={listing.save_count}
                category={listing.category}
                created_at={listing.created_at}
              />
            ))}
          </div>
        </MotionReveal>
      )}
    </div>
  );
}
