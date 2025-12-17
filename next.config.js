const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable SSR for this app since it uses IndexedDB (browser-only)
  // All pages will be client-side rendered
};

module.exports = withPWA(nextConfig);
