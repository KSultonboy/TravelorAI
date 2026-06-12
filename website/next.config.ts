import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Monorepo: Turbopack Next.js paketini to'g'ri topsin
  outputFileTracingRoot: path.join(__dirname, "../"),
  experimental: {
    // Admin paneldan base64 rasm yuborilganda request body kesilib qolmasin
    proxyClientMaxBodySize: "16mb",
  },
};

export default nextConfig;
