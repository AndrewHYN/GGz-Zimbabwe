import { MediaFallback } from "@/components/ui/MediaFallback";
import { SafeImage } from "@/components/ui/SafeImage";

interface GameArtworkProps {
  src: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
}

export function GameArtwork({ src, alt, className = "", priority = false }: GameArtworkProps) {
  if (!src) {
    return (
      <div className={`relative overflow-hidden bg-ggz-bg-2 ${className}`}>
        <MediaFallback kind="game" label={alt} className="absolute inset-0" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-ggz-bg-2 ${className}`}>
      <SafeImage
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        preload={priority}
        unoptimized
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        fallback={<MediaFallback kind="game" label={alt} className="absolute inset-0" />}
      />
    </div>
  );
}
