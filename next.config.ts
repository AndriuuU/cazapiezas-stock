import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite conexiones desde tu red local (el móvil)
  allowedDevOrigins: [
    "192.168.1.35",
    "localhost"
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "d1mhieb01d7dro.cloudfront.net",
      },
    ],
  },
};

export default nextConfig;
