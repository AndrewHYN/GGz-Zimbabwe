import { LiveIndicator } from "./LiveIndicator";

export type StatusTone =
  | "live"
  | "open"
  | "scheduled"
  | "closed"
  | "completed"
  | "cancelled"
  | "online"
  | "offline"
  | "hybrid"
  | "neutral";

const TONES: Record<StatusTone, string> = {
  live: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  open: "bg-ggz-amber/15 text-ggz-amber border-ggz-amber/30",
  scheduled: "bg-ggz-info/15 text-ggz-info border-ggz-info/30",
  closed: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  completed: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  cancelled: "bg-ggz-danger/15 text-ggz-danger border-ggz-danger/30",
  online: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  offline: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  hybrid: "bg-ggz-purple/15 text-ggz-purple-light border-ggz-purple/30",
  neutral: "bg-ggz-surface text-ggz-text-secondary border-ggz-border",
};

interface StatusPillProps {
  label: string;
  tone?: StatusTone;
  className?: string;
}

export function StatusPill({ label, tone = "neutral", className = "" }: StatusPillProps) {
  if (tone === "live") {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES.live} ${className}`}
      >
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span className="live-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
        {label}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {label}
    </span>
  );
}

export function tournamentTone(status: string | null | undefined): StatusTone {
  const value = (status || "").toLowerCase();
  if (value.includes("live") || value === "active") return "live";
  if (value.includes("registration open") || value === "upcoming" || value === "open" || value.includes("registration open")) return "open";
  if (value.includes("closed") || value.includes("full")) return "closed";
  if (value.includes("cancel")) return "cancelled";
  if (value.includes("complete") || value.includes("finished")) return "completed";
  return "neutral";
}

export function tournamentStatusLabel(status: string | null | undefined): string {
  if (!status) return "Tournament";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function eventModeTone(mode: string | null | undefined): StatusTone {
  const value = (mode || "").toLowerCase();
  if (value === "online") return "online";
  if (value === "offline") return "offline";
  if (value === "hybrid") return "hybrid";
  return "neutral";
}

export function eventStatusTone(status: string | null | undefined): StatusTone {
  const value = (status || "").toLowerCase();
  if (value.includes("live") || value === "ongoing") return "live";
  if (value.includes("cancel")) return "cancelled";
  if (value.includes("complete") || value === "ended") return "completed";
  if (value.includes("upcoming") || value === "scheduled" || value === "published") return "scheduled";
  return "neutral";
}

export function presenceTone(presence: string | null | undefined): StatusTone {
  if (presence === "online") return "online";
  if (presence === "in_game") return "live";
  return "offline";
}

export { LiveIndicator };
