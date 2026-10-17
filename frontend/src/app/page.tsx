import { serverFetch } from "@/lib/server/fetch";
import Link from "next/link";
import {
  GamepadIcon,
  TrophyIcon,
  UsersIcon,
  StoreIcon,
  CalendarIcon,
} from "@/components/icons";
import { EventCard, GameCard, TournamentCard } from "@/components/cards";
import { TwitchStreamCard } from "@/components/live/TwitchStreamCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LiveIndicator } from "@/components/ui/StatusPill";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { MotionReveal } from "@/components/motion/MotionReveal";
import type { LivePayload } from "@/lib/live";

const API_BASE = "http://ggz.internal";

interface HomeGame {
  id: number;
  name: string;
  genre?: string | null;
  platform?: string | null;
  release_year?: number | null;
  cover_art_url?: string | null;
}

interface HomeTournament {
  id: number;
  name: string;
  slug: string;
  game_name?: string | null;
  status?: string | null;
  format?: string | null;
  start_date?: string | null;
  participant_count?: number;
  location?: string | null;
  prize_description?: string | null;
}

interface HomeEvent {
  id: number;
  name: string;
  start_date?: string | null;
  location?: string | null;
  mode?: string | null;
  status?: string | null;
  banner?: string | null;
  game_name?: string | null;
  organization_name?: string | null;
  organizer_name?: string | null;
  rsvp_count?: number;
}

async function fetchList<T>(path: string): Promise<T[]> {
  try {
    const res = await serverFetch(`${API_BASE}${path}`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (Array.isArray(data) ? data : data.results ?? []) as T[];
  } catch (error) { throw error; }
}

async function fetchLive(): Promise<LivePayload | null> {
  try {
    const res = await serverFetch(`${API_BASE}/api/live/`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as LivePayload;
  } catch {
    return null;
  }
}

const quickLinks = [
  {
    href: "/games",
    icon: GamepadIcon,
    label: "Discover Games",
    description: "Browse the game catalogue.",
  },
  {
    href: "/tournaments",
    icon: TrophyIcon,
    label: "Compete",
    description: "Join tournaments and climb the ranks.",
  },
  {
    href: "/gamers",
    icon: UsersIcon,
    label: "Find Players",
    description: "Connect with gamers across Zimbabwe.",
  },
  {
    href: "/events",
    icon: CalendarIcon,
    label: "Events",
    description: "LANs, meetups, and online nights.",
  },
  {
    href: "/marketplace",
    icon: StoreIcon,
    label: "Marketplace",
    description: "Trade gear and in-game items.",
  },
  {
    href: "/feed",
    icon: UsersIcon,
    label: "Community",
    description: "Share clips, builds, and banter.",
  },
];

export default async function Home() {
  const [games, tournaments, events, live] = await Promise.all([
    fetchList<HomeGame>("/api/games/"),
    fetchList<HomeTournament>("/api/tournaments/"),
    fetchList<HomeEvent>("/api/events/"),
    fetchLive(),
  ]);

  const featuredGames = games.slice(0, 6);
  const upcomingTournaments = tournaments
    .filter((t) => !["Completed", "Cancelled", "Draft"].includes(t.status || ""))
    .slice(0, 4);
  const upcomingEvents = events.slice(0, 3);
  const liveCount = tournaments.filter((t) => t.status === "Live").length;
  const liveStreams = live?.available ? (live.streams ?? []).slice(0, 3) : [];

  return (
    <div className="animate-page-enter">
      <div className="mx-auto max-w-[1536px] px-4">
        <section className="ggz-home-hero">
          <div className="relative z-10">
            <p className="ggz-eyebrow mb-5">Zimbabwe. Logged in.</p>
            <h1 className="ggz-hero-heading">Your people.<br/>Your game.<br/><span>Good games.</span></h1>
            <p className="mt-6 max-w-md text-base leading-7 text-ggz-text-secondary">From the first friendly to the final round. Find your squad, run a tournament, and make your mark on Zimbabwe’s gaming scene.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link href="/gamers" className="ggz-primary">Find your players <span aria-hidden="true" className="ml-5">↗</span></Link><Link href="/tournaments" className="rounded-xl border border-ggz-border-strong px-5 py-3 font-semibold transition hover:bg-ggz-bg-2">Enter the arena</Link></div>
            <div className="mt-9 flex flex-wrap gap-6 text-xs text-ggz-text-secondary"><span><strong className="mr-2 text-base text-ggz-text-primary">{games.length}</strong>games to explore</span><span><strong className="mr-2 text-base text-ggz-text-primary">{tournaments.length}</strong>community tournaments</span>{liveCount>0 && <LiveIndicator label={`${liveCount} live now`}/>}</div>
          </div>
          <div className="ggz-arena" aria-hidden="true">
            <div className="ggz-arena-top"><span>GGz / PLAYER NETWORK</span><span className="text-ggz-amber">ZWE · +263</span></div>
            <div className="ggz-arena-word">PLAY<br/><span>LOCAL.</span></div>
            <GamepadIcon size={200} className="ggz-arena-controller"/>
            <div className="ggz-arena-bottom"><span>FIND YOUR NEXT GG.</span><span>01 — ∞</span></div>
          </div>
        </section>

        <section className="pb-14">
          <MotionReveal>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {quickLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 p-4 text-center transition-all hover:border-ggz-border-strong hover:bg-ggz-bg-2"
                  >
                    <Icon className="text-ggz-amber transition-transform group-hover:scale-110" size={24} />
                    <span className="font-medium text-ggz-text-primary group-hover:text-ggz-amber">
                      {link.label}
                    </span>
                    <span className="text-xs leading-snug text-ggz-text-muted">
                      {link.description}
                    </span>
                  </Link>
                );
              })}
            </div>
          </MotionReveal>
        </section>

        {liveStreams.length > 0 && (
          <section className="pb-14" data-testid="home-live-section">
            <MotionReveal>
              <SectionHeader
                title="Live Now"
                description="GGz gamers streaming right now."
                href="/live"
                actionLabel="GGz Live"
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {liveStreams.map((stream) => (
                  <TwitchStreamCard key={stream.id || stream.broadcaster_login} stream={stream} />
                ))}
              </div>
            </MotionReveal>
          </section>
        )}

        <section className="pb-14">
          <MotionReveal>
            <SectionHeader
              title="Featured Games"
              description="What the community is playing right now."
              href="/games"
              actionLabel="View all"
            />
            {featuredGames.length === 0 ? (
              <EmptyState
                icon={<GamepadIcon size={40} />}
                title="No games yet"
                description="The catalogue is warming up. Check back soon."
                action={{ label: "Explore games", href: "/games" }}
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featuredGames.map((game) => (
                  <GameCard
                    key={game.id}
                    id={game.id}
                    title={game.name}
                    genre={game.genre ?? undefined}
                    platform={game.platform ?? undefined}
                    year={game.release_year ?? null}
                    artwork_url={game.cover_art_url ?? null}
                  />
                ))}
              </div>
            )}
          </MotionReveal>
        </section>

        <section className="pb-14">
          <MotionReveal>
            <SectionHeader
              title="Compete"
              description="Tournaments open for registration and live brackets."
              href="/tournaments"
              actionLabel="View all"
            />
            {upcomingTournaments.length === 0 ? (
              <EmptyState
                icon={<TrophyIcon size={40} />}
                title="No tournaments right now"
                description="New brackets are announced regularly — check back soon."
                action={{ label: "Browse tournaments", href: "/tournaments" }}
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {upcomingTournaments.map((tournament) => (
                  <TournamentCard
                    key={tournament.id}
                    id={tournament.id}
                    slug={tournament.slug}
                    name={tournament.name}
                    game_name={tournament.game_name || "Unknown game"}
                    format={tournament.format || ""}
                    status={tournament.status || ""}
                    start_date={tournament.start_date ?? null}
                    participant_count={tournament.participant_count ?? 0}
                    location={tournament.location ?? null}
                    prize_description={tournament.prize_description ?? null}
                  />
                ))}
              </div>
            )}
          </MotionReveal>
        </section>

        <section className="pb-24">
          <MotionReveal>
            <SectionHeader
              title="Upcoming Events"
              description="LANs, meetups, and community nights."
              href="/events"
              actionLabel="View all"
            />
            {upcomingEvents.length === 0 ? (
              <EmptyState
                icon={<CalendarIcon size={40} />}
                title="No upcoming events"
                description="When the community plans something, it lands here."
                action={{ label: "Browse events", href: "/events" }}
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {upcomingEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    id={event.id}
                    name={event.name}
                    date={event.start_date ?? null}
                    location={event.location ?? undefined}
                    mode={event.mode || "offline"}
                    banner_image={event.banner ?? null}
                    organizer_name={event.organization_name ?? event.organizer_name ?? undefined}
                    game_name={event.game_name ?? undefined}
                    rsvp_count={event.rsvp_count ?? null}
                    status={event.status ?? null}
                  />
                ))}
              </div>
            )}
          </MotionReveal>
        </section>
      </div>
    </div>
  );
}
