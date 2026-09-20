import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  upcoming: "bg-ggz-amber/20 text-ggz-amber",
  active: "bg-emerald-500/20 text-emerald-400",
  completed: "bg-zinc-500/20 text-zinc-400",
};

const FORMAT_COLORS: Record<string, string> = {
  single_elimination: "bg-purple-500/15 text-purple-400",
  double_elimination: "bg-purple-500/15 text-purple-400",
  round_robin: "bg-blue-500/15 text-blue-400",
  swiss: "bg-teal-500/15 text-teal-400",
  free_for_all: "bg-orange-500/15 text-orange-400",
};

const FORMAT_LABELS: Record<string, string> = {
  single_elimination: "Single Elimination",
  double_elimination: "Double Elimination",
  round_robin: "Round Robin",
  swiss: "Swiss",
  free_for_all: "Free for All",
};

interface TournamentCardProps {
  id: number;
  slug: string;
  name: string;
  game_name: string;
  format: string;
  status: string;
  start_date: string;
  participant_count: number;
  prize_pool?: string | null;
  prize_currency?: string | null;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TournamentCard({
  slug,
  name,
  game_name,
  format,
  status,
  start_date,
  participant_count,
  prize_pool,
  prize_currency,
}: TournamentCardProps) {
  return (
    <Link
      href={`/tournaments/${slug}`}
      className="group block rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 p-5 transition-colors hover:border-ggz-amber/40"
    >
      <p className="text-xs text-ggz-text-muted uppercase tracking-wide">
        {game_name}
      </p>
      <h2 className="mt-1 font-semibold text-ggz-text-primary group-hover:text-ggz-amber transition-colors">
        {name}
      </h2>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
            FORMAT_COLORS[format] ?? "bg-zinc-500/15 text-zinc-400"
          }`}
        >
          {FORMAT_LABELS[format] ?? format}
        </span>
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
            STATUS_COLORS[status] ?? "bg-zinc-500/15 text-zinc-400"
          }`}
        >
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>

      <div className="mt-4 space-y-1 text-sm text-ggz-text-secondary">
        <p>{formatDate(start_date)}</p>
        <p>{participant_count} participants</p>
        {prize_pool && (
          <p className="text-ggz-amber">
            Prize: {prize_currency} {prize_pool}
          </p>
        )}
      </div>
    </Link>
  );
}
