import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fixa a raiz do projeto nesta pasta (evita que o Next.js use um package-lock.json de diretórios acima)
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
