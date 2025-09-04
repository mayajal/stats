/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['genkit'],
  webpack: (config) => {
    config.externals.push({
      'genkit': 'commonjs genkit',
    });
    return config;
  },
  
};

module.exports = nextConfig;