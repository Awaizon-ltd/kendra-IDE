import {
  arbitrum,
  arbitrumSepolia,
  berachain,
  linea,
  mainnet,
  mantle,
  optimism,
  optimismSepolia,
  polygon,
  robinhood,
  sepolia,
  worldchain,
  zksync,
} from 'viem/chains';
import type { Chain } from 'viem';

export interface ChainOption {
  chain: Chain;
  testnet: boolean;
  /** Private RPC from env (Alchemy). Undefined → the chain's public RPC is used. */
  rpc?: string;
}

// NEXT_PUBLIC_* values must be referenced literally for Next.js to inline them in the browser bundle.
export const CHAINS: ChainOption[] = [
  { chain: mainnet, testnet: false, rpc: process.env.NEXT_PUBLIC_RPC_ETHEREUM },
  { chain: arbitrum, testnet: false, rpc: process.env.NEXT_PUBLIC_RPC_ARBITRUM },
  { chain: optimism, testnet: false, rpc: process.env.NEXT_PUBLIC_RPC_OPTIMISM },
  { chain: polygon, testnet: false, rpc: process.env.NEXT_PUBLIC_RPC_POLYGON },
  { chain: zksync, testnet: false, rpc: process.env.NEXT_PUBLIC_RPC_ZKSYNC },
  { chain: linea, testnet: false, rpc: process.env.NEXT_PUBLIC_RPC_LINEA },
  { chain: worldchain, testnet: false, rpc: process.env.NEXT_PUBLIC_RPC_WORLDCHAIN },
  { chain: robinhood, testnet: false, rpc: process.env.NEXT_PUBLIC_RPC_ROBINHOOD },
  { chain: mantle, testnet: false, rpc: process.env.NEXT_PUBLIC_RPC_MANTLE },
  { chain: berachain, testnet: false, rpc: process.env.NEXT_PUBLIC_RPC_BERACHAIN },
  { chain: sepolia, testnet: true, rpc: process.env.NEXT_PUBLIC_RPC_SEPOLIA },
  { chain: arbitrumSepolia, testnet: true, rpc: process.env.NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA },
  { chain: optimismSepolia, testnet: true, rpc: process.env.NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA },
].map((c) => ({ ...c, rpc: c.rpc?.trim() || undefined }));

export const DEFAULT_CHAIN_ID = mainnet.id;

export function getChain(id: number): Chain | undefined {
  return CHAINS.find((c) => c.chain.id === id)?.chain;
}

/** Configured private RPC for a chain, if any. Never handed to wallets — they get the public RPC. */
export function privateRpc(id: number): string | undefined {
  return CHAINS.find((c) => c.chain.id === id)?.rpc;
}

export function explorerUrl(chain: Chain | undefined, kind: 'address' | 'tx', value: string): string | undefined {
  const base = chain?.blockExplorers?.default.url;
  return base ? `${base.replace(/\/$/, '')}/${kind}/${value}` : undefined;
}
