/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['genkit'],
  },
  webpack: (config) => {
    config.externals.push({
      'genkit': 'commonjs genkit',
    });
    return config;
  },
};

module.exports = nextConfig; 