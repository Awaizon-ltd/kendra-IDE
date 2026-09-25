'use client';

import { useEffect, useMemo, useState } from 'react';
import { toEventSignature, type AbiEvent, type Log } from 'viem';
import { stringify } from '@/lib/abi';
import { explainError, recentLogs, watchEvent, type Target } from '@/lib/contract';
import { explorerUrl } from '@/lib/chains';
import { Button, Empty } from '../ui/primitives';

type Row = Log & { args?: unknown; eventName?: string };

export default function EventsPanel({ events, target }: { events: AbiEvent[]; target: Target | null }) {
  const [sig, setSig] = useState<string>('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [range, setRange] = useState('5000');

  const event = useMemo(() => events.find((e) => toEventSignature(e) === sig) ?? events[0], [events, sig]);

  useEffect(() => { setRows([]); setError(null); setLive(false); }, [event, target?.address, target?.chain.id]);

  useEffect(() => {
    if (!live || !event || !target) return;
    return watchEvent(target, event, (logs) => setRows((r) => [...(logs as Row[]).reverse(), ...r].slice(0, 300)), (e) => setError(explainError(e).title));
  }, [live, event, target]);

  async function load() {
    if (!event || !target) return;
    setLoading(true);
    setError(null);
    try {
      setRows((await recentLogs(target, event, BigInt(range))) as Row[]);
    } catch (e) {
      setError(`${explainError(e).title} — try a smaller block range or a custom RPC`);
    } finally {
      setLoading(false);
    }
  }

  if (!target) return <Empty title="No contract loaded">Add a valid address, chain and ABI.</Empty>;
  if (!events.length) return <Empty title="No events">This ABI doesn't declare any events.</Empty>;

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div className="min-w-[220px] flex-1">
          <label className="label">Event</label>
          <select className="field" value={event ? toEventSignature(event) : ''} onChange={(e) => setSig(e.target.value)}>
            {events.map((e) => <option key={toEventSignature(e)} value={toEventSignature(e)}>{toEventSignature(e)}</option>)}
          </select>
        </div>
        <div className="w-36">
          <label className="label">Last blocks</label>
          <select className="field" value={range} onChange={(e) => setRange(e.target.value)}>
            {['1000', '5000', '20000', '100000'].map((r) => <option key={r} value={r}>{Number(r).toLocaleString()}</option>)}
          </select>
        </div>
        <Button variant="primary" onClick={() => void load()} loading={loading}>Fetch</Button>
        <Button variant={live ? 'danger' : 'ghost'} onClick={() => setLive((l) => !l)}>
          {live ? '■ Stop' : '● Watch live'}
        </Button>
      </div>

      {error && <p className="font-mono text-[12px] text-bad mb-4">{error}</p>}
      {live && <p className="font-mono text-[10px] tracking-widest uppercase text-ok mb-3">Watching for new {event?.name} events…</p>}

      {rows.length === 0 ? (
        <p className="font-body text-sm text-dim">No events loaded yet. Fetch recent history or watch live.</p>
      ) : (
        <div className="border border-line divide-y divide-line">
          {rows.map((r, i) => {
            const link = r.transactionHash ? explorerUrl(target.chain, 'tx', r.transactionHash) : undefined;
            return (
              <div key={`${r.transactionHash}-${r.logIndex}-${i}`} className="px-4 py-3 bg-panel">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="font-mono text-[11px] text-read">{r.eventName ?? event?.name}</span>
                  <span className="font-mono text-[10px] text-dim">
                    block {r.blockNumber?.toString()}
                    {link && <> · <a href={link} target="_blank" rel="noreferrer" className="text-accent hover:text-white">tx ↗</a></>}
                  </span>
                </div>
                <pre className="font-mono text-[12px] text-muted whitespace-pre-wrap break-all">{stringify(r.args ?? r.data)}</pre>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
