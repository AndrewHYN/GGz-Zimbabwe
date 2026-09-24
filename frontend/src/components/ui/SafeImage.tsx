"use client";

import Image from "next/image";
import { useState } from "react";
import type { ImageProps } from "next/image";
import { MediaFallback } from "@/components/ui/MediaFallback";

interface SafeImageProps extends Omit<ImageProps, "src"> {
  src: string | null | undefined;
  fallback?: React.ReactNode;
}

export function SafeImage({ src, alt, className = "", fallback, ...props }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <>{fallback ?? <MediaFallback kind="game" label={alt} className={`absolute inset-0 h-full w-full ${className}`} />}</>;
  }

  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      {...props}
    />
  );
}
