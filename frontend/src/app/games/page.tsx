const API_BASE = process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8000";

import { SearchIcon, FilterIcon } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { GameCard } from "@/components/cards";
import { MotionReveal } from "@/components/motion/MotionReveal";

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
  developer?: string | null;
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
    const res = await fetch(`${API_BASE}/api/games/`, { next: { revalidate: 60 } });
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
    <div className="mb-6 flex flex-wrap gap-2">
      {filters.map((f) => (
        <Badge key={f.value} className="bg-ggz-amber/10 text-ggz-amber">
          {f.label}
        </Badge>
      ))}
    </div>
  );
}

export const metadata = {
  title: "Games",
  description: "Browse the gaming catalogue.",
};

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const games = await getGames(params);

  return (
    <div className="mx-auto max-w-[1536px] px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ggz-text-primary">Games</h1>
        <p className="mt-1 text-ggz-text-secondary">Browse the gaming catalogue</p>
      </div>

      <form className="mb-6 flex flex-col gap-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ggz-text-muted" />
          <input
            type="text"
            name="q"
            placeholder="Search games..."
            defaultValue={params.q}
            className="w-full rounded-[var(--radius-md)] border border-ggz-border bg-ggz-bg-2 py-2.5 pl-10 pr-4 text-sm text-ggz-text-primary focus:border-ggz-border-strong focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <FilterIcon className="h-4 w-4 text-ggz-text-muted" />
            <span className="text-sm text-ggz-text-tertiary">Filters</span>
          </div>

          <select
            name="genre"
            defaultValue={params.genre ?? "All"}
            className="rounded-[var(--radius-md)] border border-ggz-border bg-ggz-bg-2 px-3 py-1.5 text-sm text-ggz-text-primary focus:border-ggz-border-strong focus:outline-none"
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
            className="rounded-[var(--radius-md)] border border-ggz-border bg-ggz-bg-2 px-3 py-1.5 text-sm text-ggz-text-primary focus:border-ggz-border-strong focus:outline-none"
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
            className="rounded-[var(--radius-md)] border border-ggz-border bg-ggz-bg-2 px-3 py-1.5 text-sm text-ggz-text-primary focus:border-ggz-border-strong focus:outline-none"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="rounded-[var(--radius-md)] border border-ggz-amber/30 bg-ggz-amber/10 px-4 py-1.5 text-sm font-medium text-ggz-amber transition-colors hover:bg-ggz-amber/20"
          >
            Apply
          </button>
        </div>
      </form>

      <ActiveFilters searchParams={params} />

      {games.length === 0 ? (
        <EmptyState
          icon={<SearchIcon size={40} />}
          title="No games found"
          description="Try adjusting your search or filters."
          action={{ label: "Clear filters", href: "/games" }}
        />
      ) : (
        <MotionReveal>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {games.map((game) => (
              <GameCard
                key={game.id}
                id={game.id}
                title={game.name}
                genre={game.genre || undefined}
                platform={game.platform || undefined}
                year={game.release_year}
                artwork_url={game.cover_art_url}
              />
            ))}
          </div>
        </MotionReveal>
      )}
    </div>
  );
}
