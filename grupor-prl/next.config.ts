// grupor-prl/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/generar-documento": ["./docs/documentos/**/*"],
  },
};

export default nextConfig;