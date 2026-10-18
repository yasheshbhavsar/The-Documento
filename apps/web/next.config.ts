import type { NextConfig } from "next";

const backendBaseUrl =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

const targetDestination = backendBaseUrl.includes("/api/v1")
  ? `${backendBaseUrl.replace(/\/+$/, "")}/:path*`
  : `${backendBaseUrl.replace(/\/+$/, "")}/api/v1/:path*`;

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: targetDestination,
      },
    ];
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
