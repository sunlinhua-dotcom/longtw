import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow large request bodies for file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
