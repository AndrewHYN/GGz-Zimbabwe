import { type ReactNode } from "react";

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg" | "xl";
  fallback?: string;
  className?: string;
}

export function Avatar({ src, alt, size = "md", fallback, className = "" }: AvatarProps) {
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-lg",
    xl: "h-20 w-20 text-xl",
  };

  const fallbackText = fallback || alt.charAt(0).toUpperCase();

  if (!src) {
    return (
      <div className={`${sizes[size]} rounded-full bg-ggz-surface flex items-center justify-center font-bold text-ggz-amber flex-shrink-0 ${className}`}>
        {fallbackText}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${sizes[size]} rounded-full object-cover flex-shrink-0 ${className}`}
      loading="lazy"
    />
  );
}

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
    <img
      src={src}
      alt={alt}
      className={`object-cover ${className}`}
      loading={priority ? "eager" : "lazy"}
    />
  );
}
