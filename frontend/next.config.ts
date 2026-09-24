import type { NextConfig } from "next";

const backendUrl = process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8000";
const remotePatterns: NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> = [
  {
    protocol: "https",
    hostname: "*.supabase.co",
    pathname: "/storage/v1/object/public/**",
  },
  {
    protocol: "https",
    hostname: "images.igdb.com",
  },
  {
    protocol: "https",
    hostname: "static-cdn.jtvnw.net",
  },
  {
    protocol: "https",
    hostname: "cdn.discordapp.com",
  },
  {
    protocol: "https",
    hostname: "*.googleapis.com",
  },
  {
    protocol: "https",
    hostname: "*.googleusercontent.com",
  },
  {
    protocol: "http",
    hostname: "localhost",
  },
];

let parsedBackend: URL | undefined;
try {
  parsedBackend = new URL(backendUrl);
} catch {
  parsedBackend = undefined;
}

if (parsedBackend && parsedBackend.hostname !== "localhost") {
  remotePatterns.push({
    protocol: parsedBackend.protocol === "https:" ? "https" : "http",
    hostname: parsedBackend.hostname,
    port: parsedBackend.port || undefined,
    pathname: "/**",
  });
}

if (process.env.VERCEL_ENV === "production" && !process.env.NEXT_PUBLIC_DJANGO_URL) {
  throw new Error(
    "[ggz] NEXT_PUBLIC_DJANGO_URL is required for production builds."
  );
}

const nextConfig: NextConfig = {
  // Django requires trailing slashes (APPEND_SLASH). Without this, Next.js
  // 308-redirects slashed API/proxy paths to slashless ones while Django
  // 301-redirects them back, producing an infinite redirect loop that breaks
  // every browser-initiated /api/*, /accounts/* and /media/* request.
  trailingSlash: true,
  images: {
    remotePatterns,
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8000";
    return [
      // NOTE: the trailing "/" in these destinations is load-bearing. Next.js
      // captures :path* without a trailing slash, so without it Django receives
      // slashless paths and APPEND_SLASH 301-redirects back, producing an
      // infinite redirect loop for every browser-initiated backend call.
      // (Media/static file paths are intentionally left untouched.)
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*/`,
      },
      {
        source: "/accounts/:path*",
        destination: `${backendUrl}/accounts/:path*/`,
      },
      {
        source: "/media/:path*",
        destination: `${backendUrl}/media/:path*`,
      },
      {
        source: "/static/:path*",
        destination: `${backendUrl}/static/:path*`,
      },
    ];
  },
  async headers() {
    // Narrow CSP for the public Next.js site (Django already ships its own
    // CSP for legacy/API responses). Twitch additions are explicit only:
    // thumbnails (static-cdn.jtvnw.net) and the player iframe
    // (player.twitch.tv) — no wildcards.
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://images.igdb.com https://static-cdn.jtvnw.net https://cdn.discordapp.com https://*.supabase.co https://*.gstatic.com https://*.googleapis.com https://*.googleusercontent.com https://*.google.com https://tile.openstreetmap.org https://*.openstreetmap.org",
      "frame-src 'self' https://player.twitch.tv https://www.youtube.com https://www.youtube-nocookie.com https://www.openstreetmap.org https://maps.google.com https://www.google.com",
      "connect-src 'self' https://maps.googleapis.com https://*.googleapis.com https://*.gstatic.com",
      "media-src 'self' blob:",
    ].join("; ");
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Requested-With", value: "XMLHttpRequest" },
        ],
      },
      {
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: csp }],
      },
    ];
  },
};

export default nextConfig;
