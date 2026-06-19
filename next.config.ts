import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns']
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dgwenszuvjhslfgquraz.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
