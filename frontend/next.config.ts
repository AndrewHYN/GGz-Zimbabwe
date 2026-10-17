import type { NextConfig } from "next";
const mediaUrl = process.env.MEDIA_PUBLIC_URL ? new URL(process.env.MEDIA_PUBLIC_URL) : null;
const mediaOrigin = mediaUrl?.protocol === "https:" ? mediaUrl.origin : "";
const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pg",
    "kysely",
    "kysely-pglite",
    "@electric-sql/pglite",
  ],
  images: {
    remotePatterns: [
      ...(mediaOrigin && mediaUrl ? [{ protocol: "https" as const, hostname: mediaUrl.hostname, port: mediaUrl.port, pathname: "/**" }] : []),
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      { protocol: "https", hostname: "images.igdb.com" },
      { protocol: "https", hostname: "static-cdn.jtvnw.net" },
      { protocol: "https", hostname: "cdn.discordapp.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline' https://maps.googleapis.com" +
              (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "") +
              "; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https://*.supabase.co https://images.igdb.com https://static-cdn.jtvnw.net https://cdn.discordapp.com https://*.googleusercontent.com https://*.googleapis.com https://*.gstatic.com https://*.openstreetmap.org " + mediaOrigin + "; connect-src 'self' https://maps.googleapis.com https://*.googleapis.com https://*.gstatic.com; frame-src https://player.twitch.tv https://www.youtube.com https://www.youtube-nocookie.com https://www.openstreetmap.org https://maps.google.com https://www.google.com; media-src 'self' blob:",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
};
export default nextConfig;
