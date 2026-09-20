const API_BASE = process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8000";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { SearchIcon, FilterIcon } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { GameArtwork } from "@/components/ui/GameArtwork";

const GENRES = ["All", "Action", "RPG", "Sports", "Strategy", "Shooter", "Adventure", "Simulation", "Fighting", "Racing"];
const PLATFORMS = ["All", "PC", "PlayStation", "Xbox", "Nintendo", "Mobile"];
const SORT_OPTIONS = [
  { label: "Popular", value: "popular" },
  { label: "Name A-Z", value: "name" },
  { label: "Newest", value: "newest" },
  { label: "Rating", value: "rating" },
];

interface Game {
  id: number;
  name: string;
  genre: string;
  platform: string;
  release_year: number | null;
  igdb_rating: number | null;
  cover_art_url: string | null;
  player_count: number | null;
  featured: boolean;
}

interface SearchParams {
  genre?: string;
  platform?: string;
  sort?: string;
  q?: string;
}

async function getGames(searchParams: SearchParams) {
  try {
    const res = await fetch(\`${API_BASE}/api/games/\`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    let games = (data.results ?? data) as Game[];

    if (searchParams.q) {
      const query = searchParams.q.toLowerCase();
      games = games.filter((game) =>
        [game.name, game.genre, game.platform, game.developer]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      );
    }

    if (searchParams.genre && searchParams.genre !== "All") {
      games = games.filter((game) =>
        game.genre?.toLowerCase().includes(searchParams.genre!.toLowerCase())
      );
    }

    if (searchParams.platform && searchParams.platform !== "All") {
      games = games.filter((game) =>
        game.platform?.toLowerCase().includes(searchParams.platform!.toLowerCase())
      );
    }

    switch (searchParams.sort) {
      case "name":
        games.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "newest":
        games.sort((a, b) => (b.release_year ?? 0) - (a.release_year ?? 0));
        break;
      case "rating":
        games.sort((a, b) => (b.igdb_rating ?? 0) - (a.igdb_rating ?? 0));
        break;
      default:
        games.sort(
          (a, b) =>
            Number(b.featured) - Number(a.featured) ||
            (b.player_count ?? 0) - (a.player_count ?? 0)
        );
        break;
    }

    return games;
  } catch {
    return [];
  }
}

function ActiveFilters({ searchParams }: { searchParams: SearchParams }) {
  const filters: { label: string; value: string }[] = [];
  if (searchParams.q) filters.push({ label: `"${searchParams.q}"`, value: "q" });
  if (searchParams.genre && searchParams.genre !== "All") filters.push({ label: searchParams.genre!, value: "genre" });
  if (searchParams.platform && searchParams.platform !== "All") filters.push({ label: searchParams.platform!, value: "platform" });

  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((f) => (
        <Badge key={f.value} className="bg-ggz-amber/10 text-ggz-amber">
          {f.label}
        </Badge>
      ))}
    </div>
  );
}

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const games = await getGames(params);

  return (
    <div className="max-w-[1536px] mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Games</h1>
        <p className="text-ggz-text-2 mt-1">Browse the gaming catalogue</p>
      </div>

      <form className="mb-6 flex flex-col gap-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ggz-text-2" />
          <input
            type="text"
            name="q"
            placeholder="Search games..."
            defaultValue={params.q}
            className="w-full bg-ggz-bg-2 border border-ggz-border rounded-[var(--radius-md)] pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-ggz-border-strong"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <FilterIcon className="h-4 w-4 text-ggz-text-2" />
            <span className="text-sm text-ggz-text-2">Filters</span>
          </div>

          <select
            name="genre"
            defaultValue={params.genre ?? "All"}
            className="bg-ggz-bg-2 border border-ggz-border rounded-[var(--radius-md)] px-3 py-1.5 text-sm focus:outline-none focus:border-ggz-border-strong"
          >
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g === "All" ? "All Genres" : g}
              </option>
            ))}
          </select>

          <select
            name="platform"
            defaultValue={params.platform ?? "All"}
            className="bg-ggz-bg-2 border border-ggz-border rounded-[var(--radius-md)] px-3 py-1.5 text-sm focus:outline-none focus:border-ggz-border-strong"
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p === "All" ? "All Platforms" : p}
              </option>
            ))}
          </select>

          <select
            name="sort"
            defaultValue={params.sort ?? "popular"}
            className="bg-ggz-bg-2 border border-ggz-border rounded-[var(--radius-md)] px-3 py-1.5 text-sm focus:outline-none focus:border-ggz-border-strong"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="bg-ggz-amber/10 text-ggz-amber border border-ggz-amber/30 rounded-[var(--radius-md)] px-4 py-1.5 text-sm font-medium hover:bg-ggz-amber/20 transition-colors"
          >
            Apply
          </button>
        </div>
      </form>

      <ActiveFilters searchParams={params} />

      {/* Loading state: Suspense boundary with fallback UI can wrap this section */}
      {games.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-ggz-text-2">
          <SearchIcon className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg font-medium">No games found</p>
          <p className="text-sm mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {games.map((game) => (
            <Link
              key={game.id}
              href={`/games/${game.id}`}
              className="bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] overflow-hidden hover:border-ggz-border-strong transition-all"
            >
              <GameArtwork
                src={game.cover_art_url}
                alt={game.name}
                className="aspect-[16/10] w-full"
              />
              <div className="p-3">
                <h2 className="font-semibold truncate">{game.name}</h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {game.genre && (
                    <Badge className="text-xs">{game.genre}</Badge>
                  )}
                  {game.platform && (
                    <Badge className="text-xs">{game.platform}</Badge>
                  )}
                </div>
                {game.release_year && (
                  <p className="text-xs text-ggz-text-2 mt-2">{game.release_year}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
