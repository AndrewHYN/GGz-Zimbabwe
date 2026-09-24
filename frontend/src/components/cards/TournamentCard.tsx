import { HoverCard } from "@/components/motion/HoverCard";
import { StatusPill, tournamentStatusLabel, tournamentTone } from "@/components/ui/StatusPill";

const FORMAT_COLORS: Record<string, string> = {
  "1v1": "bg-purple-500/15 text-purple-400",
  "2v2": "bg-purple-500/15 text-purple-400",
  "3v3": "bg-blue-500/15 text-blue-400",
  "4v4": "bg-teal-500/15 text-teal-400",
  "5v5": "bg-orange-500/15 text-orange-400",
  "Free For All": "bg-red-500/15 text-red-400",
};

const FORMAT_LABELS: Record<string, string> = {
  "Free For All": "Free for All",
};

interface TournamentCardProps {
  id: number;
  slug: string;
  name: string;
  game_name: string;
  format: string;
  status: string;
  start_date: string | null;
  participant_count: number;
  location?: string | null;
  prize_description?: string | null;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", {
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
  location,
  prize_description,
}: TournamentCardProps) {
  return (
    <HoverCard
      href={`/tournaments/${slug}`}
      className="group block rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 p-5 transition-colors hover:border-ggz-amber/40 hover:shadow-lg hover:shadow-black/20"
    >
      <p className="text-xs uppercase tracking-wide text-ggz-text-muted">{game_name}</p>
      <h2 className="mt-1 font-semibold text-ggz-text-primary transition-colors group-hover:text-ggz-amber">
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
        <StatusPill label={tournamentStatusLabel(status)} tone={tournamentTone(status)} />
      </div>

      <div className="mt-4 space-y-1 text-sm text-ggz-text-secondary">
        <p>{start_date ? formatDate(start_date) : "Date TBD"}</p>
        <p>{participant_count} participants</p>
        {location && <p>{location}</p>}
        {prize_description && <p className="text-ggz-amber">Prize: {prize_description}</p>}
      </div>
    </HoverCard>
  );
}
