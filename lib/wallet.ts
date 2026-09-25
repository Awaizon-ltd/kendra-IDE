'use client';

import { create } from 'zustand';
import { createWalletClient, custom, numberToHex, type Chain, type WalletClient } from 'viem';

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<any>;
  on?(event: string, fn: (...a: any[]) => void): void;
  removeListener?(event: string, fn: (...a: any[]) => void): void;
}

export interface WalletInfo {
  uuid: string;
  name: string;
  icon?: string;
  rdns?: string;
  provider: Eip1193Provider;
}

interface WalletState {
  available: WalletInfo[];
  active: WalletInfo | null;
  address: `0x${string}` | null;
  chainId: number | null;
  connecting: boolean;
  error: string | null;
  discover(): void;
  connect(w: WalletInfo): Promise<void>;
  disconnect(): void;
}

let listenersBound: Eip1193Provider | null = null;

export const useWallet = create<WalletState>((set, get) => ({
  available: [],
  active: null,
  address: null,
  chainId: null,
  connecting: false,
  error: null,

  // EIP-6963: every installed wallet announces itself; fall back to window.ethereum.
  discover() {
    if (typeof window === 'undefined') return;
    const add = (w: WalletInfo) =>
      set((s) => (s.available.some((x) => x.uuid === w.uuid || (w.rdns && x.rdns === w.rdns)) ? s : { available: [...s.available, w] }));
    window.addEventListener('eip6963:announceProvider', ((e: CustomEvent) => {
      const { info, provider } = e.detail;
      add({ uuid: info.uuid, name: info.name, icon: info.icon, rdns: info.rdns, provider });
    }) as EventListener);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    setTimeout(() => {
      const eth = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
      if (eth && get().available.length === 0) add({ uuid: 'injected', name: 'Browser wallet', provider: eth });
    }, 300);
  },

  async connect(w) {
    set({ connecting: true, error: null });
    try {
      const accounts: string[] = await w.provider.request({ method: 'eth_requestAccounts' });
      const chainId = Number(await w.provider.request({ method: 'eth_chainId' }));
      if (listenersBound && listenersBound !== w.provider) unbind(listenersBound);
      bind(w.provider);
      set({ active: w, address: (accounts[0] as `0x${string}`) ?? null, chainId, connecting: false });
      try { localStorage.setItem('kendra:wallet', w.rdns ?? w.uuid); } catch {}
    } catch (e) {
      set({ connecting: false, error: (e as { message?: string }).message ?? 'Connection rejected' });
    }
  },

  disconnect() {
    const w = get().active;
    if (w) unbind(w.provider);
    set({ active: null, address: null, chainId: null });
    try { localStorage.removeItem('kendra:wallet'); } catch {}
  },
}));

const onAccounts = (a: string[]) => useWallet.setState({ address: (a[0] as `0x${string}`) ?? null });
const onChain = (id: string) => useWallet.setState({ chainId: Number(id) });

function bind(p: Eip1193Provider) {
  p.on?.('accountsChanged', onAccounts);
  p.on?.('chainChanged', onChain);
  listenersBound = p;
}
function unbind(p: Eip1193Provider) {
  p.removeListener?.('accountsChanged', onAccounts);
  p.removeListener?.('chainChanged', onChain);
  listenersBound = null;
}

/** Ask the wallet to switch networks, adding the chain first if it doesn't know it. */
export async function ensureChain(p: Eip1193Provider, chain: Chain, rpcUrl?: string) {
  try {
    await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: numberToHex(chain.id) }] });
  } catch (err) {
    const code = (err as { code?: number; data?: { originalError?: { code?: number } } }).code;
    if (code !== 4902 && (err as { data?: { originalError?: { code?: number } } }).data?.originalError?.code !== 4902) throw err;
    await p.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: numberToHex(chain.id),
        chainName: chain.name,
        nativeCurrency: chain.nativeCurrency,
        rpcUrls: [rpcUrl || chain.rpcUrls.default.http[0]],
        blockExplorerUrls: chain.blockExplorers ? [chain.blockExplorers.default.url] : undefined,
      }],
    });
  }
}

export function walletClientFor(p: Eip1193Provider, chain: Chain, account: `0x${string}`): WalletClient {
  return createWalletClient({ chain, account, transport: custom(p) });
}

export const shortAddress = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
