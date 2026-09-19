import Image from "next/image";

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
    <div className={`${sizes[size]} relative rounded-full overflow-hidden flex-shrink-0 ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        sizes="80px"
        unoptimized
      />
    </div>
  );
}
