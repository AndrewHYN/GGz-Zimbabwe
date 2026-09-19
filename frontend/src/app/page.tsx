import Link from "next/link";
import Image from "next/image";
import {
  GamepadIcon,
  TrophyIcon,
  UsersIcon,
  StoreIcon,
  CalendarIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8000";

interface HomeGame {
  id: number;
  name: string;
  genre?: string;
  platform?: string;
  cover_image?: string;
  slug?: string;
}

interface HomeTournament {
  id: number;
  name: string;
  slug?: string;
  game_name?: string;
  status?: string;
  format?: string;
  start_date?: string;
}

async function getGames(): Promise<HomeGame[]> {
  try {
    const res = await fetch(`${API_BASE}/games/?format=json`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.games || [];
  } catch {
    return [];
  }
}

async function getTournaments(): Promise<HomeTournament[]> {
  try {
    const res = await fetch(`${API_BASE}/tournaments/?format=json`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.tournaments || [];
  } catch {
    return [];
  }
}

const quickLinks = [
  {
    href: "/games",
    icon: GamepadIcon,
    label: "Games",
    description: "Browse our collection of competitive games.",
  },
  {
    href: "/tournaments",
    icon: TrophyIcon,
    label: "Compete",
    description: "Join tournaments and prove your skills.",
  },
  {
    href: "/gamers",
    icon: UsersIcon,
    label: "Find Players",
    description: "Connect with other gamers and form teams.",
  },
  {
    href: "/marketplace",
    icon: StoreIcon,
    label: "Marketplace",
    description: "Trade in-game items and gear.",
  },
  {
    href: "/events",
    icon: CalendarIcon,
    label: "Events",
    description: "Stay up to date with upcoming events.",
  },
  {
    href: "/feed",
    icon: UsersIcon,
    label: "Community",
    description: "Join the conversation and share content.",
  },
];

export default async function Home() {
  const [games, tournaments] = await Promise.all([getGames(), getTournaments()]);

  const featuredGames = Array.isArray(games) ? games.slice(0, 6) : [];
  const upcomingTournaments = Array.isArray(tournaments) ? tournaments.slice(0, 4) : [];

  return (
    <div className="animate-page-enter">
      <div className="max-w-[1536px] mx-auto px-4">
        <section className="py-16 md:py-24 text-center">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-ggz-text-primary">
            GGz<span className="text-ggz-amber">.</span>
          </h1>
          <p className="mt-4 text-lg md:text-xl text-ggz-text-secondary max-w-2xl mx-auto">
            Discover, compete, and build reputation.
          </p>
        </section>

        <section className="pb-16">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex flex-col items-center gap-3 p-6 bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] hover:border-ggz-border-strong transition-all text-center"
                >
                  <Icon className="text-ggz-amber" size={28} />
                  <span className="font-medium text-ggz-text-primary">
                    {link.label}
                  </span>
                  <span className="text-sm text-ggz-text-muted leading-snug">
                    {link.description}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="pb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-ggz-text-primary">
              Featured Games
            </h2>
            <Link
              href="/games"
              className="text-sm text-ggz-amber hover:underline"
            >
              View all
            </Link>
          </div>
          {featuredGames.length === 0 ? (
            <p className="text-ggz-text-muted py-12 text-center">
              No games available yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredGames.map((game) => (
                <Link
                  key={game.id}
                  href={`/games/${game.id}`}
                  className="group block bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] overflow-hidden hover:border-ggz-border-strong transition-all"
                >
                  <div className="relative aspect-[16/9] bg-ggz-bg-2">
                    {game.cover_image ? (
                      <Image
                        src={game.cover_image}
                        alt={game.name}
                        className="w-full h-full object-cover"
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full">
                        <GamepadIcon
                          className="text-ggz-text-muted"
                          size={48}
                        />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-ggz-text-primary group-hover:text-ggz-amber transition-colors">
                      {game.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 text-sm text-ggz-text-muted">
                      {game.genre && <span>{game.genre}</span>}
                      {game.genre && game.platform && <span>&middot;</span>}
                      {game.platform && <span>{game.platform}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="pb-24">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-ggz-text-primary">
              Upcoming Tournaments
            </h2>
            <Link
              href="/tournaments"
              className="text-sm text-ggz-amber hover:underline"
            >
              View all
            </Link>
          </div>
          {upcomingTournaments.length === 0 ? (
            <p className="text-ggz-text-muted py-12 text-center">
              No upcoming tournaments.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {upcomingTournaments.map(
                (tournament) => (
                  <Link
                    key={tournament.id}
                    href={`/tournaments/${tournament.slug || tournament.id}`}
                    className="group block bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] p-5 hover:border-ggz-border-strong transition-all"
                  >
                    <div className="flex items-center gap-2 text-sm text-ggz-text-muted mb-2">
                      <TrophyIcon size={14} />
                      <span>{tournament.game_name || "Unknown Game"}</span>
                    </div>
                    <h3 className="font-medium text-ggz-text-primary group-hover:text-ggz-amber transition-colors">
                      {tournament.name}
                    </h3>
                    <div className="mt-3 flex items-center gap-2 text-sm text-ggz-text-muted">
                      <CalendarIcon size={14} />
                      <span>
                        {tournament.start_date
                          ? new Date(tournament.start_date).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )
                          : "TBD"}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      {tournament.status && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-ggz-amber/10 text-ggz-amber">
                          {tournament.status}
                        </span>
                      )}
                      {tournament.format && (
                        <span className="text-xs text-ggz-text-muted">
                          {tournament.format}
                        </span>
                      )}
                    </div>
                  </Link>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
