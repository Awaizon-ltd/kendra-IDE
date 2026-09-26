'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useKendra, useRehydrate, EXAMPLE } from '@/lib/store';
import { useTarget } from '@/lib/useTarget';
import { useTokenInfo } from '@/lib/useToken';
import { getAddress, isAddress } from 'viem';
import { publicClient } from '@/lib/contract';
import { decodeShare } from '@/lib/share';
import { explorerUrl } from '@/lib/chains';
import Sidebar from '@/components/ide/Sidebar';
import StatePanel from '@/components/ide/StatePanel';
import EventsPanel from '@/components/ide/EventsPanel';
import CodePanel from '@/components/ide/CodePanel';
import ConsolePanel from '@/components/ide/ConsolePanel';
import PublishDialog from '@/components/ide/PublishDialog';
import FunctionForm from '@/components/FunctionForm';
import WalletButton from '@/components/WalletButton';
import { Button, Empty, KendraMark, Tabs } from '@/components/ui/primitives';

type MobilePane = 'setup' | 'work' | 'console';

export default function IdePage() {
  useRehydrate();
  const store = useKendra();
  const { ws, grouped, selectedId, tab, setTab, log, patchLog, remember, load, simulateAs, setSimulateAs, prefill } = store;
  const target = useTarget();
  const token = useTokenInfo(target, grouped);
  const simulateAsValid = isAddress(simulateAs.trim(), { strict: false }) ? getAddress(simulateAs.trim()) : undefined;
  const [publishing, setPublishing] = useState(false);
  const [pane, setPane] = useState<MobilePane>('work');
  const [block, setBlock] = useState<{ n?: bigint; error?: boolean }>({});

  // "Open in Kendra" from a published page: #k=<payload>
  useEffect(() => {
    const h = window.location.hash;
    if (!h.startsWith('#k=')) return;
    try {
      const s = decodeShare(h.slice(3));
      load({ name: s.name, address: s.address, chainId: s.chainId, rpcUrl: s.rpc ?? '', abiText: JSON.stringify(s.abi, null, 2) });
    } catch { /* ignore malformed links */ }
    history.replaceState(null, '', window.location.pathname);
  }, [load]);

  // Remember working contracts (browser only)
  useEffect(() => {
    if (!target) return;
    const t = setTimeout(remember, 800);
    return () => clearTimeout(t);
  }, [target, ws.name, remember]);

  // Live block number doubles as an RPC health check
  useEffect(() => {
    if (!target) { setBlock({}); return; }
    let live = true;
    const tick = () => publicClient(target.chain, target.rpcUrl).getBlockNumber()
      .then((n) => live && setBlock({ n }))
      .catch(() => live && setBlock({ error: true }));
    void tick();
    const t = setInterval(tick, 12_000);
    return () => { live = false; clearInterval(t); };
  }, [target]);

  const selected = grouped?.functions.find((f) => f.id === selectedId) ?? null;
  const addressLink = target ? explorerUrl(target.chain, 'address', target.address) : undefined;

  return (
    <div className="h-dvh flex flex-col bg-bg">
      {/* ── Top bar ── */}
      <header className="h-14 shrink-0 flex items-center gap-4 px-4 border-b border-line bg-panel">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <KendraMark className="w-7 h-7" />
          <span className="font-display font-extrabold text-lg text-white tracking-tight">Kendra</span>
          <span className="hidden md:inline font-mono text-[9px] tracking-widest uppercase text-dim">by Awarizon</span>
        </Link>

        <div className="hidden md:flex items-center gap-3 min-w-0 flex-1 justify-center">
          {target ? (
            <div className="flex items-center gap-2 border border-line px-3 py-1.5 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${block.error ? 'bg-bad' : block.n ? 'bg-ok animate-pulse' : 'bg-dim'}`} />
              <span className="font-body text-sm text-white truncate">{ws.name || 'Untitled'}</span>
              <span className="font-mono text-[10px] text-dim shrink-0">{target.chain.name}</span>
              {addressLink && (
                <a href={addressLink} target="_blank" rel="noreferrer" className="font-mono text-[10px] text-dim hover:text-accent shrink-0">
                  {target.address.slice(0, 6)}…{target.address.slice(-4)} ↗
                </a>
              )}
              <span className={`font-mono text-[10px] shrink-0 ${block.error ? 'text-bad' : 'text-dim/70'}`}>
                {block.error ? 'RPC unreachable' : block.n ? `#${block.n.toString()}` : '…'}
              </span>
            </div>
          ) : (
            <span className="font-mono text-[10px] tracking-widest uppercase text-dim">No contract loaded</span>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="primary" size="sm" disabled={!target} onClick={() => setPublishing(true)} title={target ? 'Publish a shareable dApp UI' : 'Load a contract first'}>
            Publish UI
          </Button>
          <WalletButton chain={target?.chain} />
        </div>
      </header>

      {/* ── Panes ── */}
      <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)_360px]">
        <div className={`${pane === 'setup' ? 'block' : 'hidden'} lg:block min-h-0`}>
          <Sidebar />
        </div>

        <main className={`${pane === 'work' ? 'flex' : 'hidden'} lg:flex flex-col min-h-0 min-w-0`}>
          <Tabs
            value={tab}
            onChange={setTab}
            className="px-4 bg-panel shrink-0 overflow-x-auto"
            items={[
              { id: 'playground', label: 'Playground' },
              { id: 'state', label: 'State' },
              { id: 'events', label: `Events${grouped?.events.length ? ` ${grouped.events.length}` : ''}` },
              { id: 'code', label: 'Hooks & code' },
            ]}
          />
          <div className="flex-1 min-h-0 overflow-y-auto">
            {tab === 'playground' &&
              (selected ? (
                <div className="max-w-2xl p-6">
                  {!target && (
                    <p className="mb-5 font-mono text-[11px] text-write border border-write/30 bg-write/5 px-3 py-2">
                      Add a valid contract address to run calls.
                    </p>
                  )}
                  <SimulateAsBar value={simulateAs} valid={!!simulateAsValid} onChange={setSimulateAs} />
                  <FunctionForm
                    key={selected.id}
                    fn={selected}
                    target={target}
                    logger={{ log, patchLog }}
                    token={token}
                    simulateAs={simulateAsValid}
                    prefill={prefill}
                  />
                </div>
              ) : (
                <Welcome onExample={() => load(EXAMPLE)} />
              ))}
            {tab === 'state' && <StatePanel fns={grouped?.functions ?? []} target={target} token={token} />}
            {tab === 'events' && <EventsPanel events={grouped?.events ?? []} target={target} />}
            {tab === 'code' && <CodePanel name={ws.name} address={ws.address} abi={store.abi} />}
          </div>
        </main>

        <div className={`${pane === 'console' ? 'block' : 'hidden'} lg:block min-h-0`}>
          <ConsolePanel chain={target?.chain} />
        </div>
      </div>

      {/* ── Mobile pane switcher ── */}
      <nav className="lg:hidden shrink-0 grid grid-cols-3 border-t border-line bg-panel">
        {(['setup', 'work', 'console'] as const).map((p) => (
          <button key={p} onClick={() => setPane(p)} className={`py-3 font-mono text-[10px] tracking-widest uppercase ${pane === p ? 'text-accent' : 'text-dim'}`}>
            {p === 'setup' ? 'Contract' : p === 'work' ? 'Workbench' : 'Console'}
          </button>
        ))}
      </nav>

      {publishing && target && <PublishDialog target={target} name={ws.name} onClose={() => setPublishing(false)} />}
    </div>
  );
}

/** Fork mode: run reads and simulations as any address — no wallet needed, nothing is sent. */
function SimulateAsBar({ value, valid, onChange }: { value: string; valid: boolean; onChange: (v: string) => void }) {
  const bad = value.trim() !== '' && !valid;
  return (
    <div className={`mb-6 flex flex-wrap items-center gap-3 border px-3 py-2 ${value.trim() && valid ? 'border-accent/40 bg-accent/5' : 'border-line'}`}>
      <span className="font-mono text-[10px] tracking-widest uppercase text-dim shrink-0" title="Reads and simulations use this address as msg.sender. Transactions are always sent from your wallet.">
        Simulate as
      </span>
      <input
        className={`flex-1 min-w-[180px] bg-transparent font-mono text-[12px] text-white outline-none placeholder:text-dim/60 ${bad ? 'text-bad' : ''}`}
        placeholder="connected wallet  (paste any address to test as it)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
      {value && (
        <button onClick={() => onChange('')} className="font-mono text-[10px] tracking-widest uppercase text-dim hover:text-white">Clear</button>
      )}
      {bad && <span className="w-full font-mono text-[10px] text-bad">Not a valid address</span>}
    </div>
  );
}

function Welcome({ onExample }: { onExample: () => void }) {
  return (
    <Empty title="Test any smart contract">
      <p className="mb-6">
        Paste an ABI, enter the address and pick a chain. Kendra lists every function with typed inputs, simulates writes
        before you sign, generates React hooks, and publishes a simple dApp UI you can share.
      </p>
      <ol className="text-left font-mono text-[12px] text-muted space-y-2 mb-6 mx-auto w-fit">
        <li><span className="text-accent">1</span>  Paste ABI or upload an artifact</li>
        <li><span className="text-accent">2</span>  Enter the contract address + chain</li>
        <li><span className="text-accent">3</span>  Pick a function and run it</li>
      </ol>
      <Button variant="primary" onClick={onExample}>Try the USDC example</Button>
    </Empty>
  );
}
