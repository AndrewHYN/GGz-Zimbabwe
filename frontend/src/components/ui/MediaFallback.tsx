import { CalendarIcon, GamepadIcon, StoreIcon } from "@/components/icons";

type MediaKind = "game" | "event" | "listing" | "generic";

interface MediaFallbackProps {
  kind?: MediaKind;
  label?: string;
  className?: string;
}

const KIND_ICONS: Record<MediaKind, React.ComponentType<{ className?: string; size?: number }>> = {
  game: GamepadIcon,
  event: CalendarIcon,
  listing: StoreIcon,
  generic: GamepadIcon,
};

export function MediaFallback({ kind = "generic", label, className = "" }: MediaFallbackProps) {
  const Icon = KIND_ICONS[kind];
  return (
    <div
      className={`flex items-center justify-center bg-[linear-gradient(135deg,var(--color-ggz-bg-3),var(--color-ggz-bg-1))] ${className}`}
      role="img"
      aria-label={label || "Media unavailable"}
    >
      <Icon className="text-ggz-text-muted opacity-40" size={28} />
    </div>
  );
}
