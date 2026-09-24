import { HoverCard } from "@/components/motion/HoverCard";
import { Avatar } from "@/components/ui/Avatar";

interface GamerCardProps {
  gamer_tag: string;
  avatar?: string | null;
  location?: string;
  platform?: string;
  bio?: string;
}

export function GamerCard({ gamer_tag, avatar, location, platform, bio }: GamerCardProps) {
  return (
    <HoverCard
      href={`/profiles/${gamer_tag}`}
      className="group block rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 p-4 transition-colors hover:border-ggz-amber hover:bg-ggz-bg-2"
    >
      <div className="mb-3 flex items-center gap-3">
        <Avatar src={avatar} alt={gamer_tag} size="md" />
        <span className="font-semibold text-ggz-text-primary transition-colors group-hover:text-ggz-amber">
          {gamer_tag}
        </span>
      </div>
      {location && <p className="text-sm text-ggz-text-secondary">{location}</p>}
      {platform && <p className="text-sm text-ggz-text-tertiary">{platform}</p>}
      {bio && <p className="mt-2 line-clamp-2 text-sm text-ggz-text-muted">{bio}</p>}
    </HoverCard>
  );
}
