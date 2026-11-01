import type { NextConfig } from "next";

/**
 * The Next.js server proxies `/api/*` to the PHP backend so that the browser
 * only ever talks to one origin. This keeps the httpOnly session cookie and
 * the double-submit CSRF cookie first-party in development and production.
 */
const backendUrl = (process.env.PHP_API_URL || "http://127.0.0.1:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${backendUrl}/health`,
      },
    ];
  },
};

export default nextConfig;
