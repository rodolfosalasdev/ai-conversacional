import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Há um package-lock.json no diretório pai; sem isso o Turbopack elege a
  // pasta errada como raiz do workspace.
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
