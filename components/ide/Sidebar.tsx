'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isAddress } from 'viem';
import { json } from '@codemirror/lang-json';
import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night';
import { EXAMPLE, useKendra } from '@/lib/store';
import { getChain } from '@/lib/chains';
import { fetchVerifiedAbi } from '@/lib/fetchAbi';
import type { FnKind } from '@/lib/abi';
import ChainSelect from '../ChainSelect';
import { Button, KindBadge } from '../ui/primitives';

const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false, loading: () => <div className="h-[200px] bg-panel-2" /> });

export default function Sidebar() {
  const { ws, update, setAbiText, abi, grouped, abiError, selectedId, select, load, recents, forget } = useKendra();
  const [setupOpen, setSetupOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | FnKind>('all');
  const [showRpc, setShowRpc] = useState(!!ws.rpcUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  const addressBad = ws.address.trim() !== '' && !isAddress(ws.address.trim(), { strict: false });
  const ready = !!abi && !!ws.address && !addressBad;

  const fns = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (grouped?.functions ?? []).filter(
      (f) => (filter === 'all' || f.kind === filter) && (!q || f.name.toLowerCase().includes(q)),
    );
  }, [grouped, query, filter]);

  const counts = useMemo(() => {
    const c = { read: 0, write: 0, payable: 0 };
    grouped?.functions.forEach((f) => { c[f.kind]++; });
    return c;
  }, [grouped]);

  // ── Verified ABI lookup (Sourcify → Blockscout → Etherscan), proxies resolved ──
  const [lookup, setLookup] = useState<{ state: 'idle' | 'loading' | 'ok' | 'none'; msg?: string }>({ state: 'idle' });
  const fetchAbi = useCallback(async (signal?: AbortSignal) => {
    const chain = getChain(ws.chainId);
    const address = ws.address.trim();
    if (!chain || !isAddress(address, { strict: false })) return;
    setLookup({ state: 'loading' });
    const r = await fetchVerifiedAbi(chain, address, ws.rpcUrl.trim() || undefined, signal).catch(() => null);
    if (signal?.aborted) return;
    if (!r) {
      setLookup({ state: 'none', msg: `Not verified on ${chain.name} — paste the ABI below` });
      return;
    }
    setAbiText(JSON.stringify(r.abi, null, 2));
    if (!useKendra.getState().ws.name && r.name) update({ name: r.name });
    const proxy = r.implementation ? ` · proxy → ${r.implementation.name ?? r.implementation.address.slice(0, 10) + '…'}` : '';
    setLookup({ state: 'ok', msg: `Verified on ${r.source}${proxy}` });
  }, [ws.address, ws.chainId, ws.rpcUrl, setAbiText, update]);

  // Auto-fetch once a valid address is entered and no ABI has been provided yet
  useEffect(() => {
    if (ws.abiText.trim() || !isAddress(ws.address.trim(), { strict: false })) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => void fetchAbi(ctrl.signal), 500);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [ws.address, ws.chainId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setLookup({ state: 'idle' }); }, [ws.address, ws.chainId]);

  async function onFile(file: File) {
    const text = await file.text();
    setAbiText(text);
    if (!ws.name) update({ name: file.name.replace(/\.json$/i, '') });
  }

  return (
    <aside className="h-full flex flex-col bg-panel border-r border-line min-h-0">
      {/* ── Contract setup ── */}
      <div className="border-b border-line">
        <button onClick={() => setSetupOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-panel-2">
          <span className="pane-title">Contract</span>
          <span className="font-mono text-[10px] text-dim truncate max-w-[200px]">
            {!setupOpen && ready ? `${ws.name || 'Untitled'} · ${getChain(ws.chainId)?.name}` : setupOpen ? '−' : '+'}
          </span>
        </button>

        {setupOpen && (
          <div className="px-4 pb-4 space-y-3">
            <div>
              <label className="label">Name</label>
              <input className="field" placeholder="MyToken" value={ws.name} onChange={(e) => update({ name: e.target.value })} />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label">Address</label>
                <button
                  onClick={() => void fetchAbi()}
                  disabled={addressBad || !ws.address.trim() || lookup.state === 'loading'}
                  title="Look up the verified ABI (resolves proxies)"
                  className="font-mono text-[9px] tracking-widest uppercase text-dim hover:text-accent disabled:opacity-40 disabled:hover:text-dim mb-1.5"
                >
                  {lookup.state === 'loading' ? 'Fetching…' : 'Fetch ABI'}
                </button>
              </div>
              <input
                className={`field ${addressBad ? 'field-error' : ''}`}
                placeholder="0x… (verified ABIs load automatically)"
                value={ws.address}
                onChange={(e) => update({ address: e.target.value })}
                spellCheck={false}
              />
              {addressBad && <p className="font-mono text-[11px] text-bad mt-1">Not a valid address</p>}
              {!addressBad && lookup.msg && (
                <p className={`font-mono text-[10px] mt-1 ${lookup.state === 'ok' ? 'text-ok' : 'text-dim'}`}>
                  {lookup.state === 'ok' ? '✓ ' : ''}{lookup.msg}
                </p>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label">Chain</label>
                <button onClick={() => setShowRpc((s) => !s)} className="font-mono text-[9px] tracking-widest uppercase text-dim hover:text-accent mb-1.5">
                  {showRpc ? 'Hide RPC' : 'Custom RPC'}
                </button>
              </div>
              <ChainSelect value={ws.chainId} onChange={(chainId) => update({ chainId })} />
              {showRpc && (
                <input
                  className="field mt-2"
                  placeholder={getChain(ws.chainId)?.rpcUrls.default.http[0] ?? 'https://…'}
                  value={ws.rpcUrl}
                  onChange={(e) => update({ rpcUrl: e.target.value })}
                  spellCheck={false}
                />
              )}
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label">ABI</label>
                <div className="flex gap-3 mb-1.5">
                  <button onClick={() => fileRef.current?.click()} className="font-mono text-[9px] tracking-widest uppercase text-dim hover:text-accent">Upload</button>
                  <button onClick={() => load(EXAMPLE)} className="font-mono text-[9px] tracking-widest uppercase text-dim hover:text-accent">Example</button>
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ''; }}
              />
              <div className={`border ${abiError ? 'border-bad/60' : 'border-line'} bg-panel-2`}>
                <CodeMirror
                  value={ws.abiText}
                  height="200px"
                  theme={tokyoNight}
                  extensions={[json()]}
                  placeholder={'Paste ABI JSON, a Hardhat/Foundry artifact,\nor human-readable lines:\nfunction balanceOf(address) view returns (uint256)'}
                  basicSetup={{ foldGutter: false, highlightActiveLine: false }}
                  onChange={setAbiText}
                />
              </div>
              {abiError ? (
                <p className="font-mono text-[11px] text-bad mt-1">{abiError}</p>
              ) : grouped ? (
                <p className="font-mono text-[10px] text-dim mt-1">
                  {grouped.functions.length} functions · {grouped.events.length} events · {grouped.errors.length} errors
                </p>
              ) : null}
            </div>

            {recents.length > 0 && (
              <details className="group">
                <summary className="pane-title cursor-pointer list-none flex items-center justify-between py-1 hover:text-white">
                  Recent contracts <span className="group-open:rotate-90 transition-transform">›</span>
                </summary>
                <ul className="mt-2 space-y-1">
                  {recents.map((r) => (
                    <li key={`${r.chainId}:${r.address}`} className="flex items-center gap-2">
                      <button onClick={() => load(r)} className="flex-1 text-left px-2 py-1.5 hover:bg-panel-3 min-w-0">
                        <span className="block font-body text-sm text-white truncate">{r.name || 'Untitled'}</span>
                        <span className="block font-mono text-[10px] text-dim truncate">{getChain(r.chainId)?.name} · {r.address.slice(0, 10)}…</span>
                      </button>
                      <button onClick={() => forget(r.address, r.chainId)} aria-label="Remove" className="text-dim hover:text-bad px-1">×</button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {/* ── Function explorer ── */}
      <div className="px-4 pt-3 pb-2 border-b border-line space-y-2">
        <input className="field py-1.5" placeholder="Search functions…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="flex gap-1">
          {(['all', 'read', 'write', 'payable'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`font-mono text-[9px] tracking-widest uppercase px-2 py-1 border transition-colors ${
                filter === k ? 'border-accent text-accent' : 'border-line text-dim hover:text-white'
              }`}
            >
              {k}{k !== 'all' && ` ${counts[k]}`}
            </button>
          ))}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto min-h-0 py-1" aria-label="Contract functions">
        {!grouped && (
          <div className="px-4 py-8 text-center">
            <p className="font-body text-sm text-dim mb-4">Add an ABI to list the contract's functions.</p>
            <Button size="sm" variant="ghost" onClick={() => load(EXAMPLE)}>Load USDC example</Button>
          </div>
        )}
        {grouped && fns.length === 0 && <p className="font-body text-sm text-dim px-4 py-6">No functions match.</p>}
        {fns.map((f) => (
          <button
            key={f.id}
            onClick={() => select(f.id)}
            className={`w-full flex items-center gap-2.5 px-4 py-2 text-left border-l-2 transition-colors ${
              selectedId === f.id ? 'bg-panel-3 border-accent' : 'border-transparent hover:bg-panel-2'
            }`}
          >
            <KindBadge kind={f.kind} className="w-[58px] justify-center shrink-0" />
            <span className="font-mono text-[12.5px] text-white truncate">{f.name}</span>
            {(f.item.inputs?.length ?? 0) > 0 && (
              <span className="font-mono text-[10px] text-dim ml-auto shrink-0">{f.overloaded ? f.id.slice(f.name.length) : `(${f.item.inputs!.length})`}</span>
            )}
          </button>
        ))}
      </nav>
    </aside>
  );
}
