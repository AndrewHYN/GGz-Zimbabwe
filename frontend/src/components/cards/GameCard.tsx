import Link from "next/link";
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
    <Link
      href={`/games/${id}`}
      className="group block overflow-hidden rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 transition-all hover:border-ggz-border-strong"
    >
      <GameArtwork
        src={artwork_url ?? null}
        alt={title}
        className="aspect-[16/10] w-full transition group-hover:scale-105"
      />
      <div className="p-3">
        <h2 className="font-semibold truncate text-ggz-text-primary group-hover:text-ggz-amber transition-colors">
          {title}
        </h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {genre && <Badge className="text-xs">{genre}</Badge>}
          {platform && <Badge className="text-xs">{platform}</Badge>}
        </div>
        {year && <p className="text-xs text-ggz-text-tertiary mt-2">{year}</p>}
      </div>
    </Link>
  );
}
