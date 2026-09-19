import Link from "next/link";
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
    <Link
      href={`/profiles/${gamer_tag}`}
      className="group block rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 p-4 transition-all hover:border-ggz-amber hover:bg-ggz-bg-2"
    >
      <div className="flex items-center gap-3 mb-3">
        <Avatar src={avatar} alt={gamer_tag} size="md" />
        <span className="text-ggz-text-primary font-semibold group-hover:text-ggz-amber transition-colors">
          {gamer_tag}
        </span>
      </div>
      {location && <p className="text-sm text-ggz-text-secondary">{location}</p>}
      {platform && <p className="text-sm text-ggz-text-tertiary">{platform}</p>}
      {bio && (
        <p className="text-sm text-ggz-text-muted mt-2 line-clamp-2">{bio}</p>
      )}
    </Link>
  );
}
