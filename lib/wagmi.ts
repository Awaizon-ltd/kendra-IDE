import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http, type Chain } from 'viem';
import { CHAINS } from './chains';

// WalletConnect project IDs are public client-side identifiers (they ship in every bundle).
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (!projectId) throw new Error('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set');

export const wagmiConfig = getDefaultConfig({
  appName: 'Kendra by Awarizon',
  appDescription: 'Smart contract playground',
  appUrl: 'https://kendra.awarizon.com',
  appIcon: 'https://kendra.awarizon.com/logo.png',
  projectId,
  // Every chain Kendra can target, so wallets can be switched (or have the chain added) on demand
  chains: CHAINS.map((c) => c.chain) as [Chain, ...Chain[]],
  // wagmi's own reads use the private RPCs; the chain objects keep public RPCs,
  // which is what wallets receive if a chain has to be added.
  transports: Object.fromEntries(CHAINS.map((c) => [c.chain.id, http(c.rpc)])),
  ssr: true,
});
