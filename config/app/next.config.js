const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    appDir: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@components': path.join(__dirname, '../../src/components'),
      '@lib': path.join(__dirname, '../../src/lib'),
      '@utils': path.join(__dirname, '../../src/utils'),
      '@styles': path.join(__dirname, '../../src/styles'),
      '@context': path.join(__dirname, '../../src/context'),
      '@types': path.join(__dirname, '../../src/types'),
      '@services': path.join(__dirname, '../../src/services'),
    }
    return config
  },
}

module.exports = nextConfig 