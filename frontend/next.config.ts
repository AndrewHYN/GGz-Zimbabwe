import type { NextConfig } from "next";

const backendUrl = process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8000";
const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
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

try {
  const parsedBackend = new URL(backendUrl);
  if (parsedBackend.hostname !== "localhost") {
    remotePatterns.push({
      protocol: parsedBackend.protocol === "https:" ? "https" : "http",
      hostname: parsedBackend.hostname,
      port: parsedBackend.port,
      pathname: "/**",
    });
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/accounts/:path*",
        destination: `${backendUrl}/accounts/:path*`,
      },
      {
        source: "/profiles/signup/",
        destination: `${backendUrl}/profiles/signup/`,
      },
      {
        source: "/media/:path*",
        destination: `${backendUrl}/media/:path*`,
      },
      {
        source: "/static/:path*",
        destination: `${backendUrl}/static/:path*`,
      },
      {
        source: "/privacy",
        destination: `${backendUrl}/privacy/`,
      },
      {
        source: "/terms",
        destination: `${backendUrl}/terms/`,
      },
      {
        source: "/cookies",
        destination: `${backendUrl}/cookies/`,
      },
      {
        source: "/refund",
        destination: `${backendUrl}/refund/`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Requested-With", value: "XMLHttpRequest" },
        ],
      },
    ];
  },
};

export default nextConfig;
