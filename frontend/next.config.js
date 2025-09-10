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
  
};

module.exports = nextConfig;