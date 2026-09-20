const API_BASE = process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8000";

import Link from "next/link";

const STATUS_OPTIONS = ["all", "registration", "live", "completed"] as const;

const STATUS_COLORS: Record<string, string> = {
  "Registration Open": "bg-ggz-amber/20 text-ggz-amber",
  Live: "bg-emerald-500/20 text-emerald-400",
  Completed: "bg-zinc-500/20 text-zinc-400",
};

const FORMAT_COLORS: Record<string, string> = {
  "1v1": "bg-purple-500/15 text-purple-400",
  "2v2": "bg-purple-500/15 text-purple-400",
  "3v3": "bg-blue-500/15 text-blue-400",
  "4v4": "bg-teal-500/15 text-teal-400",
  "5v5": "bg-orange-500/15 text-orange-400",
  "Free For All": "bg-red-500/15 text-red-400",
};

const FORMAT_LABELS: Record<string, string> = {
  "1v1": "1v1",
  "2v2": "2v2",
  "3v3": "3v3",
  "4v4": "4v4",
  "5v5": "5v5",
  "Free For All": "Free for All",
};

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
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const dynamic = "force-dynamic";

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
    <div className="max-w-[1536px] mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ggz-text-primary">Compete</h1>
        <p className="mt-1 text-ggz-text-secondary">
          Tournaments and competitions
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => (
          <Link
            key={s}
            href={s === "all" ? "/tournaments" : `/tournaments?status=${s}`}
            className={`rounded-[var(--radius-lg)] px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === s
                ? "bg-ggz-amber text-black"
                : "bg-ggz-bg-1 text-ggz-text-muted hover:text-ggz-text-primary border border-ggz-border"
            }`}
          >
            {s === "registration" ? "Registration Open" : s.charAt(0).toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </div>

      {tournaments.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 p-12 text-center">
          <p className="text-ggz-text-muted">No tournaments found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => (
            <Link
              key={t.id}
              href={`/tournaments/${t.slug}`}
              className="group rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 p-5 transition-colors hover:border-ggz-amber/40"
            >
              <p className="text-xs text-ggz-text-muted uppercase tracking-wide">
                {t.game_name || "Unknown game"}
              </p>
              <h2 className="mt-1 font-semibold text-ggz-text-primary group-hover:text-ggz-amber transition-colors">
                {t.name}
              </h2>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    FORMAT_COLORS[t.format] ?? "bg-zinc-500/15 text-zinc-400"
                  }`}
                >
                  {FORMAT_LABELS[t.format] ?? t.format}
                </span>
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    STATUS_COLORS[t.status] ?? "bg-zinc-500/15 text-zinc-400"
                  }`}
                >
                  {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                </span>
              </div>

              <div className="mt-4 space-y-1 text-sm text-ggz-text-secondary">
                <p>{t.start_date ? formatDate(t.start_date) : "Date TBD"}</p>
                <p>Up to {t.max_participants} participants</p>
                {t.location && <p>{t.location}</p>}
                {t.mode && <p className="capitalize">{t.mode} tournament</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
