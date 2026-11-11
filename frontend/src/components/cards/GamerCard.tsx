import { HoverCard } from "@/components/motion/HoverCard";
import { Avatar } from "@/components/ui/Avatar";

export interface GamerCardProps {
  gamer_tag: string;
  avatar?: string | null;
  location?: string | null;
  platform?: string | null;
  bio?: string | null;
  rank?: string;
  availability?: string;
  respect_points?: number;
  presence?: string;
  game_count?: number;
  matches_played?: number;
  win_percentage?: number;
}

export function GamerCard(gamer: GamerCardProps) {
  const details = [gamer.platform, gamer.location].filter(Boolean).join(" · ");
  const stats = [
    gamer.game_count != null && gamer.game_count + (gamer.game_count === 1 ? " game" : " games"),
    gamer.respect_points != null && gamer.respect_points + " respect",
    Boolean(gamer.matches_played) && gamer.win_percentage != null && gamer.win_percentage + "% wins",
  ].filter(Boolean).join(" · ");

  return (
    <HoverCard href={"/profiles/" + encodeURIComponent(gamer.gamer_tag) + "/"}
      className="group block min-w-0 rounded-xl border border-ggz-border bg-ggz-bg-1 p-3 transition-colors hover:border-ggz-amber focus-visible:outline-2 focus-visible:outline-ggz-amber">
      <div className="flex items-center gap-2.5">
        <Avatar src={gamer.avatar} alt="" fallback={gamer.gamer_tag[0]?.toUpperCase()} />
        <div className="min-w-0">
          <h2 className="truncate font-semibold group-hover:text-ggz-amber">{gamer.gamer_tag}</h2>
          {details && <p className="truncate text-xs text-ggz-text-secondary">{details}</p>}
        </div>
        {gamer.presence === "online" && (
          <span className="ml-auto shrink-0 rounded-full bg-emerald-400/10 px-2 py-1 text-[11px] text-emerald-400">Online</span>
        )}
      </div>
      {(gamer.rank || gamer.availability) && (
        <p className="mt-2 text-xs font-medium text-ggz-amber">{[gamer.rank, gamer.availability].filter(Boolean).join(" · ")}</p>
      )}
      {stats && <p className="mt-1 text-xs text-ggz-text-muted">{stats}</p>}
      {gamer.bio && <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-ggz-text-secondary">{gamer.bio}</p>}
    </HoverCard>
  );
}
