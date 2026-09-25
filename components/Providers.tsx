'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { wagmiConfig } from '@/lib/wagmi';

// RainbowKit styled to Kendra: lime accent, black text on accent, square corners.
const theme = darkTheme({
  accentColor: '#C8F13F',
  accentColorForeground: '#000000',
  borderRadius: 'none',
  overlayBlur: 'small',
});

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} modalSize="compact" appInfo={{ appName: 'Kendra', learnMoreUrl: 'https://awarizon.com' }}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
