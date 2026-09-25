/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Lets a verification build run alongside `next dev` without both writing to .next
  distDir: process.env.NEXT_DIST_DIR || '.next',
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    // Optional deps of WalletConnect's logger / storage — not needed in the browser (per RainbowKit's Next.js guide)
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    // RainbowKit → Base Account → Coinbase CDP SDK imports x402 payment helpers that aren't
    // installed and that Kendra never calls. Resolve them to empty modules.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@x402/core/client': false,
      '@x402/evm': false,
      '@x402/evm/exact/client': false,
      '@x402/evm/upto/client': false,
      '@x402/svm/exact/client': false,
      // MetaMask SDK's React Native storage — unused on the web
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
};
