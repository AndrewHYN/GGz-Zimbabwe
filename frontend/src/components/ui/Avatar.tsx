import { SafeImage } from "@/components/ui/SafeImage";

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

  return (
    <div className={sizes[size] + " relative shrink-0 overflow-hidden rounded-full bg-ggz-surface " + className}>
      <SafeImage key={src} src={src} alt={alt} fill sizes="80px" unoptimized className="object-cover"
        fallback={<span aria-hidden="true" className="flex h-full w-full items-center justify-center font-bold text-ggz-amber">
          {fallback || alt.charAt(0).toUpperCase()}
        </span>} />
    </div>
  );
}
