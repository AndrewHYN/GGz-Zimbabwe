import Image from "next/image";

interface GameArtworkProps {
  src: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
}

export function GameArtwork({ src, alt, className = "", priority = false }: GameArtworkProps) {
  if (!src) {
    return (
      <div className={`bg-ggz-bg-2 flex items-center justify-center ${className}`}>
        <span className="text-ggz-text-muted text-sm font-medium">No artwork</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        priority={priority}
        unoptimized
      />
    </div>
  );
}
