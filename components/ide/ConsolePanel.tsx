'use client';

import { useEffect, useRef } from 'react';
import { explorerUrl } from '@/lib/chains';
import { useKendra, type ConsoleEntry } from '@/lib/store';
import type { Chain } from 'viem';

const KIND: Record<ConsoleEntry['kind'], { label: string; color: string }> = {
  read: { label: 'CALL', color: 'text-read' },
  simulate: { label: 'SIM', color: 'text-accent' },
  tx: { label: 'TX', color: 'text-write' },
  error: { label: 'ERR', color: 'text-bad' },
  info: { label: 'INFO', color: 'text-dim' },
};

export default function ConsolePanel({ chain }: { chain?: Chain }) {
  const { console: entries, clearConsole } = useKendra();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [entries.length]);

  return (
    <aside className="h-full flex flex-col bg-panel border-l border-line min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <span className="pane-title">Console</span>
        {entries.length > 0 && (
          <button onClick={clearConsole} className="font-mono text-[10px] tracking-widest uppercase text-dim hover:text-white">Clear</button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 font-mono text-[12px]" aria-live="polite">
        {entries.length === 0 && <p className="px-4 py-6 text-dim font-body text-sm">Calls, simulations and transactions show up here.</p>}
        {entries.map((e) => {
          const k = KIND[e.kind];
          const link = e.hash ? explorerUrl(chain, 'tx', e.hash) : undefined;
          return (
            <div key={e.id} className="px-4 py-2.5 border-b border-line/60">
              <div className="flex items-baseline gap-2">
                <span className={`text-[9px] tracking-widest ${k.color}`}>{k.label}</span>
                <span className="text-[10px] text-dim/70">{new Date(e.time).toLocaleTimeString()}</span>
                {e.status && (
                  <span className={`ml-auto text-[9px] tracking-widest uppercase ${e.status === 'success' ? 'text-ok' : e.status === 'reverted' ? 'text-bad' : 'text-write'}`}>
                    {e.status}
                  </span>
                )}
              </div>
              <p className="text-white break-all mt-0.5">{e.title}</p>
              {e.hash && (
                <p className="text-[11px] text-dim break-all">
                  {link ? <a href={link} target="_blank" rel="noreferrer" className="hover:text-accent">{e.hash} ↗</a> : e.hash}
                </p>
              )}
              {e.detail && <pre className="text-[11px] text-muted whitespace-pre-wrap break-all mt-1">{e.detail}</pre>}
            </div>
          );
        })}
        <div ref={end} />
      </div>
    </aside>
  );
}
