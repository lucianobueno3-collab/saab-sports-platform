import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

// Versão da aplicação (package.json) + carimbo de data/hora do build (deploy).
// Ficam disponíveis no cliente via process.env.NEXT_PUBLIC_* (inlined no build).
const pkg = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
