const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Empty turbopack config to silence the warning
  turbopack: {},
  // Use webpack for builds (required for PWA plugin)
  experimental: {
    forceSwcTransforms: true,
  },
};

module.exports = withPWA(nextConfig);
