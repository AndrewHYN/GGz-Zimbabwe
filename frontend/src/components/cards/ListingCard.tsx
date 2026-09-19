import Link from "next/link";
import Image from "next/image";

const CONDITION_COLORS: Record<string, string> = {
  New: "bg-green-500/20 text-green-400 border-green-500/30",
  "Like New": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Good: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Fair: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Poor: "bg-red-500/20 text-red-400 border-red-500/30",
};

interface ListingCardProps {
  id: number;
  title: string;
  price: string;
  condition: string;
  image?: string | null;
  seller_name: string;
  seller_avatar?: string | null;
  location?: string;
  save_count: number;
}

export function ListingCard({
  id,
  title,
  price,
  condition,
  image,
  seller_name,
  seller_avatar,
  location,
  save_count,
}: ListingCardProps) {
  return (
    <Link
      href={`/marketplace/listing/${id}`}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 transition hover:border-ggz-amber/40 hover:shadow-lg hover:shadow-ggz-amber/5"
    >
      <div className="relative aspect-[16/10] w-full bg-ggz-bg-2">
        {image ? (
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-ggz-text-muted">
            No image
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="truncate font-semibold text-ggz-text-primary">
          {title}
        </h3>

        <p className="mt-1 text-lg font-bold text-ggz-amber">
          ${parseFloat(price).toFixed(2)}
        </p>

        <div className="mt-2">
          <span
            className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
              CONDITION_COLORS[condition] ?? "border-ggz-border bg-ggz-bg-1 text-ggz-text-secondary"
            }`}
          >
            {condition}
          </span>
        </div>

        <div className="mt-auto pt-3">
          <div className="flex items-center gap-2">
            <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-ggz-bg-2">
              {seller_avatar ? (
                <Image
                  src={seller_avatar}
                  alt={seller_name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-ggz-text-secondary">
                  {seller_name?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <span className="truncate text-xs text-ggz-text-secondary">
              {seller_name}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ggz-text-secondary">
            {location && <span>{location}</span>}
            <span>{save_count} saves</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
