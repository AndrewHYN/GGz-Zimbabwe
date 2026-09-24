import { HoverCard } from "@/components/motion/HoverCard";
import { MediaFallback } from "@/components/ui/MediaFallback";
import { SafeImage } from "@/components/ui/SafeImage";

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
  location?: string | null;
  save_count: number;
  category?: string | null;
  created_at?: string | null;
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
  category,
  created_at,
}: ListingCardProps) {
  return (
    <HoverCard
      href={`/marketplace/listing/${id}`}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 transition hover:border-ggz-amber/40 hover:shadow-lg hover:shadow-ggz-amber/5"
    >
      <div className="relative aspect-[16/10] w-full bg-ggz-bg-2">
        <SafeImage
          src={image}
          alt={title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          unoptimized
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          fallback={<MediaFallback kind="listing" label={title} className="absolute inset-0" />}
        />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="truncate font-semibold text-ggz-text-primary transition-colors group-hover:text-ggz-amber">
          {title}
        </h3>

        <p className="mt-1 text-lg font-bold text-ggz-amber">${parseFloat(price).toFixed(2)}</p>

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
              <SafeImage
                src={seller_avatar}
                alt={seller_name}
                fill
                sizes="24px"
                unoptimized
                className="object-cover"
                fallback={
                  <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-ggz-text-secondary">
                    {seller_name?.charAt(0).toUpperCase()}
                  </div>
                }
              />
            </div>
            <span className="truncate text-xs text-ggz-text-secondary">{seller_name}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ggz-text-secondary">
            {category && <span>{category}</span>}
            {location && <span>{location}</span>}
            <span>{save_count} saves</span>
            {created_at && !Number.isNaN(new Date(created_at).getTime()) && (
              <span>{new Date(created_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </div>
    </HoverCard>
  );
}
