import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@routie/db", "@routie/domain", "@routie/providers", "@routie/publishers", "@routie/security"],
  experimental: { optimizePackageImports: ["lucide-react"] }
};

export default nextConfig;
