'use client';

import { useEffect, useRef, useState } from 'react';
import type { Chain } from 'viem';
import { ensureChain, shortAddress, useWallet } from '@/lib/wallet';
import { getChain } from '@/lib/chains';
import { Button, CopyButton } from './ui/primitives';

/** Connect / account button. When `chain` is given, flags and fixes a network mismatch. */
export default function WalletButton({ chain, rpcUrl }: { chain?: Chain; rpcUrl?: string }) {
  const { available, active, address, chainId, connecting, error, discover, connect, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { discover(); }, [discover]);

  // Reconnect silently to the wallet used last time, if it's still authorised
  useEffect(() => {
    if (active || !available.length) return;
    let last: string | null = null;
    try { last = localStorage.getItem('kendra:wallet'); } catch {}
    const w = available.find((x) => (x.rdns ?? x.uuid) === last);
    if (!w) return;
    w.provider.request({ method: 'eth_accounts' }).then((a: string[]) => { if (a?.length) void connect(w); }).catch(() => {});
  }, [available, active, connect]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const wrongChain = !!(active && chain && chainId !== chain.id);

  return (
    <div className="relative" ref={ref}>
      {!active ? (
        <Button variant="ghost" size="sm" loading={connecting} onClick={() => setOpen((o) => !o)}>Connect wallet</Button>
      ) : wrongChain ? (
        <Button variant="danger" size="sm" onClick={() => ensureChain(active.provider, chain!, rpcUrl).catch(() => {})}>
          Switch to {chain!.name}
        </Button>
      ) : (
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 border border-line-bright px-3 py-1.5 hover:border-white/30 transition-colors"
        >
          {active.icon && <img src={active.icon} alt="" className="w-4 h-4" />}
          <span className="w-1.5 h-1.5 rounded-full bg-ok" />
          <span className="font-mono text-[11px] text-white">{shortAddress(address)}</span>
        </button>
      )}

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-panel border border-line-bright z-50 shadow-2xl">
          {!active ? (
            <div className="p-2">
              <p className="pane-title px-2 py-2">Choose a wallet</p>
              {available.length === 0 && (
                <p className="font-body text-sm text-dim px-2 py-3">No browser wallet found. Install MetaMask, Rabby, Coinbase Wallet or another EVM wallet.</p>
              )}
              {available.map((w) => (
                <button
                  key={w.uuid}
                  onClick={() => { void connect(w); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-2 py-2.5 hover:bg-panel-3 text-left"
                >
                  {w.icon ? <img src={w.icon} alt="" className="w-6 h-6" /> : <span className="w-6 h-6 bg-panel-3" />}
                  <span className="font-body text-sm text-white">{w.name}</span>
                </button>
              ))}
              {error && <p className="font-mono text-[11px] text-bad px-2 py-2">{error}</p>}
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <div>
                <p className="pane-title mb-1">Connected · {active.name}</p>
                <p className="font-mono text-[12px] text-white break-all">{address}</p>
                <p className="font-mono text-[10px] text-dim mt-1">{getChain(chainId ?? 0)?.name ?? `Chain ${chainId}`}</p>
              </div>
              <div className="flex items-center justify-between">
                <CopyButton value={address ?? ''} label="Copy address" />
                <button onClick={() => { disconnect(); setOpen(false); }} className="font-mono text-[10px] tracking-widest uppercase text-bad hover:text-white">
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
