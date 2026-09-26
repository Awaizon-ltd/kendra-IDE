'use client';

import { useCallback, useEffect, useState } from 'react';
import { namedOutputs, stringify, type ContractFn } from '@/lib/abi';
import { explainError, readFn, type Target } from '@/lib/contract';
import { formatTokenAmount, isAmountType, type TokenInfo } from '@/lib/useToken';
import { Button, CopyButton, Empty } from '../ui/primitives';

type Cell = { status: 'loading' } | { status: 'ok'; text: string; hint?: string } | { status: 'error'; text: string };

/** Every zero-argument view function, read in one go — a live snapshot of contract state. */
export default function StatePanel({ fns, target, compact = false, token }: { fns: ContractFn[]; target: Target | null; compact?: boolean; token?: TokenInfo | null }) {
  const readable = fns.filter((f) => f.kind === 'read' && (f.item.inputs?.length ?? 0) === 0);
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [auto, setAuto] = useState(false);

  const refresh = useCallback(async () => {
    if (!target) return;
    setCells(Object.fromEntries(readable.map((f) => [f.id, { status: 'loading' } as Cell])));
    await Promise.all(
      readable.map(async (f) => {
        try {
          const res = await readFn(target, f.item, []);
          const outs = namedOutputs(f.item, res);
          const text = outs.length === 1 ? stringify(outs[0].value) : outs.map((o) => `${o.name}: ${stringify(o.value)}`).join('\n');
          // Amounts on token contracts also show in whole-token units
          const one = outs.length === 1 ? outs[0] : null;
          const hint = token && one && typeof one.value === 'bigint' && isAmountType(one.type)
            ? `${formatTokenAmount(one.value, token.decimals)} ${token.symbol ?? ''}`.trim()
            : undefined;
          setCells((c) => ({ ...c, [f.id]: { status: 'ok', text, hint } }));
        } catch (e) {
          setCells((c) => ({ ...c, [f.id]: { status: 'error', text: explainError(e).title } }));
        }
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, token, readable.map((f) => f.id).join()]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => void refresh(), 10_000);
    return () => clearInterval(t);
  }, [auto, refresh]);

  if (!target) return <Empty title="Nothing to read yet">Add a valid address, chain and ABI.</Empty>;
  if (!readable.length) return <Empty title="No state to show">This contract has no view functions without arguments.</Empty>;

  return (
    <div className={compact ? '' : 'p-6'}>
      {!compact && (
        <div className="flex items-center justify-between mb-5">
          <p className="font-body text-sm text-dim">{readable.length} values read directly from the chain.</p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-dim cursor-pointer">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-[#C8F13F]" />
              Auto 10s
            </label>
            <Button size="sm" onClick={() => void refresh()}>Refresh</Button>
          </div>
        </div>
      )}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-px bg-line border border-line">
        {readable.map((f) => {
          const c = cells[f.id];
          return (
            <div key={f.id} className="bg-panel p-4 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-mono text-[11px] text-dim truncate">{f.name}</span>
                {c?.status === 'ok' && <CopyButton value={c.text} />}
              </div>
              {!c || c.status === 'loading' ? (
                <span className="inline-block h-4 w-24 bg-panel-3 animate-pulse" />
              ) : (
                <>
                  <pre className={`font-mono text-[13px] whitespace-pre-wrap break-all ${c.status === 'error' ? 'text-bad text-[11px]' : 'text-white'}`}>{c.text || '""'}</pre>
                  {c.status === 'ok' && c.hint && <p className="font-mono text-[11px] text-accent/80 mt-1">= {c.hint}</p>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
