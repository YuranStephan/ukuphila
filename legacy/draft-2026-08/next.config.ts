import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/auth/:path*", destination: "/api/auth/:path*" },
      { source: "/users/:path*", destination: "/api/users/:path*" },
      { source: "/pockets/:path*", destination: "/api/pockets/:path*" },
      { source: "/pockets", destination: "/api/pockets" },
      { source: "/transactions", destination: "/api/transactions" },
      { source: "/inventory/:path*", destination: "/api/inventory/:path*" },
      { source: "/inventory", destination: "/api/inventory" },
      { source: "/xitique/:path*", destination: "/api/xitique/:path*" },
      { source: "/agents/:path*", destination: "/api/agents/:path*" },
      { source: "/sync/:path*", destination: "/api/sync/:path*" },
    ];
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ],
};

export default nextConfig;
