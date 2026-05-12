import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Monorepo: Turbopack Next.js paketini to'g'ri topsin
  outputFileTracingRoot: path.join(__dirname, "../"),
};

export default nextConfig;
