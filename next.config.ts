import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // See https://github.com/SheetJS/sheetjs/issues/2977
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias['./cptable'] = false;
    config.externals = config.externals || [];
    config.externals.push({
      './cptable': 'var cptable',
    });

    return config;
  },
};

export default nextConfig;
