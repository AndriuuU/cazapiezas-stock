import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite conexiones desde tu red local (el móvil)
  allowedDevOrigins: [
    "192.168.1.35",
    "localhost"
  ],
};

export default nextConfig;