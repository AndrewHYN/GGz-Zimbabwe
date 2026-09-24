const API_BASE = process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8000";

import Link from "next/link";
import { TrophyIcon } from "@/components/icons";
import { TournamentCard } from "@/components/cards";
import { EmptyState } from "@/components/ui/EmptyState";
import { MotionReveal } from "@/components/motion/MotionReveal";

const STATUS_OPTIONS = ["all", "registration", "live", "completed"] as const;

interface Tournament {
  id: number;
  slug: string;
  name: string;
  game_name: string | null;
  format: string;
  status: string;
  start_date: string | null;
  location: string | null;
  mode: string;
  max_participants: number;
  participant_count?: number;
  prize_description?: string | null;
}

export const metadata = {
  title: "Tournaments | GGz",
  description: "Browse and join gaming tournaments.",
};

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const statusFilter = (STATUS_OPTIONS as readonly string[]).includes(params.status as string)
    ? (params.status as typeof STATUS_OPTIONS[number])
    : "all";

  let tournaments: Tournament[] = [];
  try {
    const res = await fetch(`${API_BASE}/api/tournaments/`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      tournaments = data.results ?? data;
    }
  } catch {
    // Render an empty state when the Django API is unavailable.
  }

  if (statusFilter !== "all") {
    tournaments = tournaments.filter((t: Tournament) => {
      if (statusFilter === "registration") return t.status === "Registration Open";
      if (statusFilter === "live") return t.status === "Live";
      return t.status === "Completed";
    });
  }

  return (
    <div className="mx-auto max-w-[1536px] px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ggz-text-primary">Compete</h1>
        <p className="mt-1 text-ggz-text-secondary">Tournaments and competitions</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => (
          <Link
            key={s}
            href={s === "all" ? "/tournaments" : `/tournaments?status=${s}`}
            className={`rounded-[var(--radius-lg)] px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === s
                ? "bg-ggz-amber text-black"
                : "border border-ggz-border bg-ggz-bg-1 text-ggz-text-muted hover:text-ggz-text-primary"
            }`}
          >
            {s === "registration" ? "Registration Open" : s.charAt(0).toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </div>

      {tournaments.length === 0 ? (
        <EmptyState
          icon={<TrophyIcon size={40} />}
          title="No tournaments found"
          description={
            statusFilter === "all"
              ? "When organizers announce brackets, they will appear here."
              : "No tournaments match this filter right now."
          }
          action={{ label: "View all tournaments", href: "/tournaments" }}
        />
      ) : (
        <MotionReveal>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((t) => (
              <TournamentCard
                key={t.id}
                id={t.id}
                slug={t.slug}
                name={t.name}
                game_name={t.game_name || "Unknown game"}
                format={t.format}
                status={t.status}
                start_date={t.start_date}
                participant_count={t.participant_count ?? 0}
                location={t.location}
                prize_description={t.prize_description ?? null}
              />
            ))}
          </div>
        </MotionReveal>
      )}
    </div>
  );
}
