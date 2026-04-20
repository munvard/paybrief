import type { NextConfig } from "next";
import path from "node:path";

// Apply turbopack config only when we actually know we're running with turbopack
// (dev), so `next build` in Docker (BWL) falls back to webpack cleanly. Turbopack
// on BWL's cross-arch codebuild runner fails; webpack build works.
const useTurbopack = process.env.TURBOPACK_ENABLED === "1";

const nextConfig: NextConfig = {
  ...(useTurbopack
    ? {
        turbopack: {
          root: path.join(process.cwd()),
          resolveAlias: {
            tailwindcss: path.join(process.cwd(), "node_modules/tailwindcss"),
          },
        },
      }
    : {}),
};

export default nextConfig;
