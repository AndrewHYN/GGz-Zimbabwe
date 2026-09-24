import { HoverCard } from "@/components/motion/HoverCard";
import { Badge } from "@/components/ui/Badge";
import { GameArtwork } from "@/components/ui/GameArtwork";

interface GameCardProps {
  id: number;
  title: string;
  genre?: string;
  platform?: string;
  year?: number | null;
  artwork_url?: string | null;
}

export function GameCard({ id, title, genre, platform, year, artwork_url }: GameCardProps) {
  return (
    <HoverCard
      href={`/games/${id}`}
      className="group block overflow-hidden rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 transition-colors hover:border-ggz-border-strong hover:shadow-lg hover:shadow-black/20"
    >
      <GameArtwork src={artwork_url ?? null} alt={title} className="aspect-[16/10] w-full" />
      <div className="p-3">
        <h2 className="truncate font-semibold text-ggz-text-primary transition-colors group-hover:text-ggz-amber">
          {title}
        </h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {genre && <Badge className="text-xs">{genre}</Badge>}
          {platform && <Badge className="text-xs">{platform}</Badge>}
        </div>
        {year && <p className="mt-2 text-xs text-ggz-text-tertiary">{year}</p>}
      </div>
    </HoverCard>
  );
}
