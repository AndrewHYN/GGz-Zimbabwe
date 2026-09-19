import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { GameArtwork } from "@/components/ui/GameArtwork";
import { StarIcon, ExternalLinkIcon } from "@/components/icons";

interface StoreLink {
  name: string;
  url: string;
}

interface Game {
  id: number;
  title: string;
  description: string;
  genre: string;
  platform: string;
  year: number;
  developer: string;
  igdb_rating?: number;
  artwork_url?: string;
  store_links?: StoreLink[];
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let game: Game | null = null;

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8000"}/games/${id}/?format=json`
    );
    if (!res.ok) {
      throw new Error("Game not found");
    }
    game = await res.json();
  } catch {
    return (
      <div className="max-w-[1536px] mx-auto px-4 py-8 text-center">
        <h1 className="text-3xl font-bold mb-4">Game Not Found</h1>
        <p className="text-ggz-muted mb-6">
          The game you are looking for does not exist or could not be loaded.
        </p>
        <Link
          href="/games"
          className="text-ggz-primary hover:underline"
        >
          Back to Games
        </Link>
      </div>
    );
  }

  if (!game) return null;

  return (
    <div className="max-w-[1536px] mx-auto px-4 py-8">
      <Link
        href="/games"
        className="inline-flex items-center gap-2 text-ggz-muted hover:text-ggz-text transition-colors mb-6"
      >
        ← Back to Games
      </Link>

      <div className="rounded-[var(--radius-lg)] overflow-hidden mb-8">
        <div className="aspect-[21/9] hidden md:block">
          <GameArtwork
            src={game.artwork_url ?? null}
            alt={game.title}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="aspect-[16/9] block md:hidden">
          <GameArtwork
            src={game.artwork_url ?? null}
            alt={game.title}
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      <h1 className="text-3xl font-bold mb-4">{game.title}</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        {game.genre && <Badge>{game.genre}</Badge>}
        {game.platform && <Badge>{game.platform}</Badge>}
        {game.year && <Badge>{game.year}</Badge>}
        {game.developer && <Badge>{game.developer}</Badge>}
      </div>

      <p className="text-ggz-text leading-relaxed mb-8">{game.description}</p>

      {game.igdb_rating != null && (
        <div className="flex items-center gap-2 mb-8">
          <StarIcon className="w-5 h-5 text-yellow-500" />
          <span className="font-semibold">{game.igdb_rating}</span>
          <span className="text-ggz-muted">/ 100</span>
        </div>
      )}

      {game.store_links && game.store_links.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Store Links</h2>
          <div className="flex flex-wrap gap-3">
            {game.store_links.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-ggz-surface border border-ggz-border rounded-[var(--radius-md)] hover:bg-ggz-surface-hover transition-colors"
              >
                {link.name}
                <ExternalLinkIcon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Reviews</h2>
        <div className="text-ggz-muted italic">No reviews yet.</div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Leaderboard</h2>
        <div className="text-ggz-muted italic">No leaderboard data available.</div>
      </div>
    </div>
  );
}
