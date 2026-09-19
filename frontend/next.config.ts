import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8000";
    return [
      { source: "/api/:path*", destination: backendUrl + "/api/:path*" },
    ];
  },
};

export default nextConfig;
