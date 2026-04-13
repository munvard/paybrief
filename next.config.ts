import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(process.cwd()),
    resolveAlias: {
      tailwindcss: path.join(process.cwd(), "node_modules/tailwindcss"),
    },
  },
};

export default nextConfig;
