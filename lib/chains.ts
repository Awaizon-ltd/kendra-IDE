import * as all from 'viem/chains';
import { defineChain, type Chain } from 'viem';

export interface ChainOption {
  chain: Chain;
  testnet: boolean;
}

// Local dev chains (Anvil / Hardhat) — default RPC is localhost:8545.
const local = defineChain({
  id: 31337,
  name: 'Localhost 8545',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
});

// Keys are viem/chains export names; any missing from the installed viem version are skipped.
const MAINNETS = ['mainnet', 'base', 'arbitrum', 'optimism', 'polygon', 'bsc', 'avalanche', 'unichain', 'linea', 'scroll', 'zksync', 'blast', 'mantle', 'celo', 'gnosis', 'zora', 'monad', 'sonic', 'berachain', 'worldchain'];
const TESTNETS = ['sepolia', 'baseSepolia', 'arbitrumSepolia', 'optimismSepolia', 'polygonAmoy', 'bscTestnet', 'avalancheFuji', 'lineaSepolia', 'scrollSepolia', 'zksyncSepoliaTestnet', 'unichainSepolia', 'monadTestnet'];

const pick = (keys: string[], testnet: boolean): ChainOption[] =>
  keys
    .map((k) => (all as unknown as Record<string, Chain | undefined>)[k])
    .filter((c): c is Chain => !!c)
    .map((chain) => ({ chain, testnet }));

export const CHAINS: ChainOption[] = [...pick(MAINNETS, false), ...pick(TESTNETS, true), { chain: local, testnet: true }];

export function getChain(id: number): Chain | undefined {
  return CHAINS.find((c) => c.chain.id === id)?.chain;
}

export function explorerUrl(chain: Chain | undefined, kind: 'address' | 'tx', value: string): string | undefined {
  const base = chain?.blockExplorers?.default.url;
  return base ? `${base.replace(/\/$/, '')}/${kind}/${value}` : undefined;
}
