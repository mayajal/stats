const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ['genkit'],
  webpack: (config) => {
    config.externals.push({
      'genkit': 'commonjs genkit',
    });
    return config;
  },
  env: {
    NEXT_PUBLIC_SPATIAL_SERVICE_URL: 'http://localhost:8080/spatial',
  },
};

module.exports = nextConfig;