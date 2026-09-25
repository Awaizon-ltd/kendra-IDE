'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { isAddress, type Abi } from 'viem';
import { groupAbi, parseContractInput, type GroupedAbi } from './abi';
import { DEFAULT_CHAIN_ID, getChain } from './chains';

export interface Workspace {
  name: string;
  address: string;
  chainId: number;
  rpcUrl: string;
  abiText: string;
}

export type ConsoleKind = 'read' | 'simulate' | 'tx' | 'error' | 'info';

export interface ConsoleEntry {
  id: string;
  time: number;
  kind: ConsoleKind;
  title: string;
  detail?: string;
  hash?: string;
  status?: 'pending' | 'success' | 'reverted';
}

export type CenterTab = 'playground' | 'state' | 'events' | 'code';

interface KendraState {
  ws: Workspace;
  abi: Abi | null;
  grouped: GroupedAbi | null;
  abiError: string | null;
  selectedId: string | null;
  tab: CenterTab;
  console: ConsoleEntry[];
  recents: Workspace[];

  update(patch: Partial<Workspace>): void;
  setAbiText(text: string): void;
  load(ws: Workspace): void;
  select(id: string | null): void;
  setTab(t: CenterTab): void;
  log(e: Omit<ConsoleEntry, 'id' | 'time'>): string;
  patchLog(id: string, patch: Partial<ConsoleEntry>): void;
  clearConsole(): void;
  remember(): void;
  forget(address: string, chainId: number): void;
}

const EMPTY: Workspace = { name: '', address: '', chainId: DEFAULT_CHAIN_ID, rpcUrl: '', abiText: '' };

function parse(text: string) {
  if (!text.trim()) return { abi: null, grouped: null, abiError: null };
  try {
    const { abi } = parseContractInput(text);
    return { abi, grouped: groupAbi(abi), abiError: null };
  } catch (e) {
    return { abi: null, grouped: null, abiError: (e as Error).message };
  }
}

export const useKendra = create<KendraState>()(
  persist(
    (set, get) => ({
      ws: EMPTY,
      abi: null,
      grouped: null,
      abiError: null,
      selectedId: null,
      tab: 'playground',
      console: [],
      recents: [],

      update: (patch) => set((s) => ({ ws: { ...s.ws, ...patch } })),

      setAbiText(text) {
        const parsed = parse(text);
        const name = !get().ws.name && parsed.abi ? (() => { try { return parseContractInput(text).name; } catch { return undefined; } })() : undefined;
        set((s) => ({
          ws: { ...s.ws, abiText: text, ...(name ? { name } : {}) },
          ...parsed,
          selectedId: parsed.grouped?.functions.some((f) => f.id === s.selectedId) ? s.selectedId : parsed.grouped?.functions[0]?.id ?? null,
        }));
      },

      load(ws) {
        // Saved workspaces may point at a chain Kendra no longer lists
        if (!getChain(ws.chainId)) ws = { ...ws, chainId: DEFAULT_CHAIN_ID };
        const parsed = parse(ws.abiText);
        set({ ws, ...parsed, selectedId: parsed.grouped?.functions[0]?.id ?? null, tab: 'playground' });
      },

      select: (id) => set({ selectedId: id, tab: 'playground' }),
      setTab: (tab) => set({ tab }),

      log(e) {
        const id = Math.random().toString(36).slice(2, 10);
        set((s) => ({ console: [...s.console.slice(-199), { ...e, id, time: Date.now() }] }));
        return id;
      },
      patchLog: (id, patch) => set((s) => ({ console: s.console.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      clearConsole: () => set({ console: [] }),

      // Keep the last 12 contracts the user worked with (browser-only — nothing leaves the machine)
      remember() {
        const { ws, abi } = get();
        if (!abi || !isAddress(ws.address)) return;
        set((s) => ({
          recents: [ws, ...s.recents.filter((r) => !(r.address.toLowerCase() === ws.address.toLowerCase() && r.chainId === ws.chainId))].slice(0, 12),
        }));
      },
      forget: (address, chainId) =>
        set((s) => ({ recents: s.recents.filter((r) => !(r.address.toLowerCase() === address.toLowerCase() && r.chainId === chainId)) })),
    }),
    {
      name: 'kendra:v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ ws: s.ws, recents: s.recents }),
      // Restored after mount (see useRehydrate) so the first client render matches the server HTML
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        if (state?.ws.abiText) state.load(state.ws);
      },
    },
  ),
);

/** Ready-made example so first-time visitors can try Kendra without an ABI of their own. */
export const EXAMPLE: Workspace = {
  name: 'USDC',
  address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  chainId: 42161,
  rpcUrl: '',
  abiText: `function name() view returns (string)
function symbol() view returns (string)
function decimals() view returns (uint8)
function totalSupply() view returns (uint256)
function balanceOf(address account) view returns (uint256)
function allowance(address owner, address spender) view returns (uint256)
function transfer(address to, uint256 amount) returns (bool)
function approve(address spender, uint256 amount) returns (bool)
function transferFrom(address from, address to, uint256 amount) returns (bool)
event Transfer(address indexed from, address indexed to, uint256 value)
event Approval(address indexed owner, address indexed spender, uint256 value)`,
};

/** Call once in each page that uses the store. */
export function useRehydrate() {
  useEffect(() => { void useKendra.persist.rehydrate(); }, []);
}
