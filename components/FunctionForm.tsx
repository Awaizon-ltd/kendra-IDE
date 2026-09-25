'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatUnits, parseEther, type AbiParameter } from 'viem';
import { namedOutputs, parseArgs, placeholderFor, stringify, type ContractFn, type NamedOutput } from '@/lib/abi';
import { explainError, readFn, sendFn, simulateFn, waitForReceipt, type Target } from '@/lib/contract';
import { explorerUrl } from '@/lib/chains';
import { useWallet } from '@/lib/wallet';
import type { ConsoleEntry } from '@/lib/store';
import { Button, CopyButton, KindBadge } from './ui/primitives';

type Logger = {
  log(e: Omit<ConsoleEntry, 'id' | 'time'>): string;
  patchLog(id: string, patch: Partial<ConsoleEntry>): void;
};

type Outcome =
  | { kind: 'read'; outputs: NamedOutput[] }
  | { kind: 'simulate'; outputs: NamedOutput[]; gas?: bigint }
  | { kind: 'tx'; hash: string; status: 'pending' | 'success' | 'reverted'; gasUsed?: bigint; events?: { name: string; args: unknown }[] }
  | { kind: 'error'; title: string; detail?: string };

interface Props {
  fn: ContractFn;
  target: Target | null;
  variant?: 'ide' | 'dapp';
  logger?: Logger;
  /** Run zero-argument reads as soon as the form mounts. */
  autoRead?: boolean;
}

export default function FunctionForm({ fn, target, variant = 'ide', logger, autoRead }: Props) {
  const inputs = fn.item.inputs ?? [];
  const [raws, setRaws] = useState<string[]>(() => inputs.map(() => ''));
  const [value, setValue] = useState('');
  const [errors, setErrors] = useState<(string | null)[]>([]);
  const [busy, setBusy] = useState<null | 'read' | 'simulate' | 'send'>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const wallet = useWallet();

  // Reset when switching functions
  useEffect(() => {
    setRaws(inputs.map(() => ''));
    setValue('');
    setErrors([]);
    setOutcome(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn.id]);

  const parsed = () => {
    const r = parseArgs(inputs, raws);
    setErrors(r.errors);
    return r.errors.some(Boolean) ? null : r.args;
  };

  const parsedValue = (): bigint | undefined | null => {
    if (fn.kind !== 'payable' || !value.trim()) return undefined;
    try { return parseEther(value.trim()); } catch { setOutcome({ kind: 'error', title: 'Value must be an ETH amount, e.g. 0.01' }); return null; }
  };

  const title = `${fn.name}(${raws.map((r) => r || '…').join(', ')})`;

  async function doRead() {
    if (!target) return;
    const args = parsed();
    if (!args) return;
    setBusy('read');
    try {
      const res = await readFn(target, fn.item, args);
      const outputs = namedOutputs(fn.item, res);
      setOutcome({ kind: 'read', outputs });
      logger?.log({ kind: 'read', title, detail: outputs.map((o) => `${o.name ? o.name + ': ' : ''}${stringify(o.value)}`).join('\n') });
    } catch (e) {
      const x = explainError(e);
      setOutcome({ kind: 'error', ...x });
      logger?.log({ kind: 'error', title: `${fn.name}: ${x.title}`, detail: x.detail });
    } finally {
      setBusy(null);
    }
  }

  async function doSimulate(quiet = false) {
    if (!target) return null;
    if (!wallet.address) { setOutcome({ kind: 'error', title: 'Connect a wallet to simulate as your account' }); return null; }
    const args = parsed();
    const val = parsedValue();
    if (!args || val === null) return null;
    if (!quiet) setBusy('simulate');
    try {
      const sim = await simulateFn(target, fn.item, args, wallet.address, val);
      const outputs = namedOutputs(fn.item, sim.result);
      if (!quiet) {
        setOutcome({ kind: 'simulate', outputs, gas: sim.gas });
        logger?.log({ kind: 'simulate', title, detail: `ok${sim.gas ? ` · gas ≈ ${sim.gas}` : ''}` });
      }
      return { args, val };
    } catch (e) {
      const x = explainError(e);
      setOutcome({ kind: 'error', ...x });
      logger?.log({ kind: 'error', title: `simulate ${fn.name}: ${x.title}`, detail: x.detail });
      return null;
    } finally {
      if (!quiet) setBusy(null);
    }
  }

  async function doSend() {
    if (!target || !wallet.active || !wallet.address) { setOutcome({ kind: 'error', title: 'Connect a wallet to send transactions' }); return; }
    setBusy('send');
    // Simulate first so reverts surface with a reason instead of a failed tx
    const ok = await doSimulate(true);
    if (!ok) { setBusy(null); return; }
    let logId: string | undefined;
    try {
      const hash = await sendFn(target, fn.item, ok.args, { provider: wallet.active.provider, address: wallet.address, chainId: wallet.chainId }, ok.val);
      setOutcome({ kind: 'tx', hash, status: 'pending' });
      logId = logger?.log({ kind: 'tx', title, hash, status: 'pending' });
      const { receipt, events } = await waitForReceipt(target, hash);
      const status = receipt.status === 'success' ? 'success' : 'reverted';
      const evs = events.map((ev) => ({ name: (ev as { eventName?: string }).eventName ?? 'Unknown', args: (ev as { args?: unknown }).args }));
      setOutcome({ kind: 'tx', hash, status, gasUsed: receipt.gasUsed, events: evs });
      if (logId) logger?.patchLog(logId, { status, detail: [`gas used ${receipt.gasUsed}`, ...evs.map((e) => `${e.name} ${stringify(e.args)}`)].join('\n') });
    } catch (e) {
      const x = explainError(e);
      setOutcome({ kind: 'error', ...x });
      if (logId) logger?.patchLog(logId, { status: 'reverted', detail: x.title });
      else if (!x.rejected) logger?.log({ kind: 'error', title: `${fn.name}: ${x.title}`, detail: x.detail });
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (autoRead && fn.kind === 'read' && inputs.length === 0 && target) void doRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRead, fn.id, target?.address, target?.chain.id]);

  const dapp = variant === 'dapp';

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); fn.kind === 'read' ? void doRead() : void doSend(); }}
      className={dapp ? 'border border-line bg-panel p-5' : ''}
    >
      {dapp ? (
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="font-display font-bold text-lg text-white">{humanize(fn.name)}</h3>
          {fn.kind !== 'read' && <KindBadge kind={fn.kind} />}
        </div>
      ) : (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <KindBadge kind={fn.kind} />
            {fn.overloaded && <span className="font-mono text-[10px] text-dim">overloaded</span>}
          </div>
          <h2 className="font-mono text-xl text-white break-all">{fn.name}</h2>
          <p className="font-mono text-[12px] text-dim mt-1 break-all">
            {fn.id}{fn.item.outputs?.length ? ` → (${fn.item.outputs.map((o) => o.type + (o.name ? ' ' + o.name : '')).join(', ')})` : ''}
          </p>
        </div>
      )}

      {inputs.length > 0 && (
        <div className="space-y-4 mb-5">
          {inputs.map((p, i) => (
            <ParamField
              key={i}
              param={p}
              index={i}
              value={raws[i] ?? ''}
              error={errors[i]}
              onChange={(v) => setRaws((r) => r.map((x, j) => (j === i ? v : x)))}
            />
          ))}
        </div>
      )}

      {fn.kind === 'payable' && (
        <div className="mb-5">
          <label className="label">Value <span className="normal-case tracking-normal text-dim/70">({target?.chain.nativeCurrency.symbol ?? 'ETH'})</span></label>
          <input className="field" placeholder="0.0" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {fn.kind === 'read' ? (
          <Button type="submit" variant="primary" loading={busy === 'read'} disabled={!target}>
            {dapp ? 'Get' : 'Call'}
          </Button>
        ) : (
          <>
            <Button type="submit" variant="primary" loading={busy === 'send'} disabled={!target || !!busy}>
              {dapp ? 'Submit' : 'Send transaction'}
            </Button>
            {!dapp && (
              <Button type="button" variant="ghost" loading={busy === 'simulate'} disabled={!target || !!busy} onClick={() => void doSimulate()}>
                Simulate
              </Button>
            )}
          </>
        )}
      </div>

      {outcome && <OutcomeView outcome={outcome} target={target} dapp={dapp} />}
    </form>
  );
}

// ─── Parameter input ──────────────────────────────────────────────────────────

function ParamField({ param, index, value, error, onChange }: { param: AbiParameter; index: number; value: string; error?: string | null; onChange: (v: string) => void }) {
  const complex = param.type.endsWith(']') || param.type === 'tuple';
  const isInt = /^u?int\d*$/.test(param.type);
  const label = (
    <label className="label">
      {param.name || `arg${index}`} <span className="normal-case tracking-normal text-dim/70">{param.type}</span>
    </label>
  );

  if (param.type === 'bool') {
    return (
      <div>
        {label}
        <div className="flex gap-2">
          {['true', 'false'].map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => onChange(b)}
              className={`font-mono text-[12px] px-4 py-2 border transition-colors ${value === b ? 'border-accent text-accent' : 'border-line text-dim hover:text-white'}`}
            >
              {b}
            </button>
          ))}
        </div>
        {error && <p className="font-mono text-[11px] text-bad mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      {label}
      {complex ? (
        <textarea
          className={`field min-h-[84px] resize-y ${error ? 'field-error' : ''}`}
          placeholder={placeholderFor(param)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      ) : (
        <div className="relative">
          <input
            className={`field ${isInt ? 'pr-28' : ''} ${error ? 'field-error' : ''}`}
            placeholder={placeholderFor(param)}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          {isInt && (
            // Quick unit helpers: append 18 or 6 decimal zeros to the typed amount
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
              {[['×1e18', 'ether'], ['×1e6', '1e6']].map(([lbl, unit]) => (
                <button
                  key={lbl}
                  type="button"
                  title={unit === 'ether' ? 'Treat as whole tokens with 18 decimals' : 'Treat as whole tokens with 6 decimals'}
                  onClick={() => {
                    const n = value.trim().replace(/\s*(ether|eth|gwei|wei)$/i, '');
                    if (!n) return;
                    onChange(unit === 'ether' ? `${n} ether` : `${n}e6`);
                  }}
                  className="font-mono text-[9px] px-1.5 py-1 text-dim border border-line hover:text-accent hover:border-accent/40"
                >
                  {lbl}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {error && <p className="font-mono text-[11px] text-bad mt-1">{error}</p>}
    </div>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────

function OutcomeView({ outcome, target, dapp }: { outcome: Outcome; target: Target | null; dapp: boolean }) {
  if (outcome.kind === 'error') {
    return (
      <div className="mt-5 border border-bad/30 bg-bad/5 px-4 py-3">
        <p className="font-mono text-[12px] text-bad break-words">{outcome.title}</p>
        {outcome.detail && !dapp && <p className="font-mono text-[11px] text-dim mt-1 break-words">{outcome.detail}</p>}
      </div>
    );
  }

  if (outcome.kind === 'tx') {
    const link = explorerUrl(target?.chain, 'tx', outcome.hash);
    const color = outcome.status === 'success' ? 'text-ok' : outcome.status === 'reverted' ? 'text-bad' : 'text-write';
    return (
      <div className="mt-5 border border-line bg-panel-2 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className={`font-mono text-[11px] uppercase tracking-widest ${color}`}>
            {outcome.status === 'pending' ? 'Confirming…' : outcome.status === 'success' ? 'Confirmed' : 'Reverted'}
          </span>
          {link && <a href={link} target="_blank" rel="noreferrer" className="font-mono text-[10px] tracking-widest uppercase text-accent hover:text-white">View on explorer ↗</a>}
        </div>
        <p className="font-mono text-[11px] text-dim break-all">{outcome.hash}</p>
        {outcome.gasUsed !== undefined && !dapp && <p className="font-mono text-[11px] text-dim">gas used {outcome.gasUsed.toString()}</p>}
        {!!outcome.events?.length && !dapp && (
          <div className="pt-2 border-t border-line space-y-1.5">
            {outcome.events.map((e, i) => (
              <div key={i}>
                <span className="font-mono text-[11px] text-read">{e.name}</span>
                <pre className="font-mono text-[11px] text-muted whitespace-pre-wrap break-all">{stringify(e.args)}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-5 border border-line bg-panel-2">
      {outcome.kind === 'simulate' && (
        <div className="px-4 py-2 border-b border-line flex justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ok">Simulation passed</span>
          {outcome.gas !== undefined && <span className="font-mono text-[10px] text-dim">gas ≈ {outcome.gas.toString()}</span>}
        </div>
      )}
      {outcome.outputs.map((o, i) => <OutputRow key={i} out={o} />)}
    </div>
  );
}

function OutputRow({ out }: { out: NamedOutput }) {
  const text = stringify(out.value);
  const hint = useMemo(() => {
    if (typeof out.value !== 'bigint' || !/^u?int/.test(out.type)) return null;
    const v = out.value < 0n ? -out.value : out.value;
    if (v < 10n ** 6n) return null;
    return [formatUnits(out.value, 18) + ' (18 dp)', formatUnits(out.value, 6) + ' (6 dp)'];
  }, [out]);
  return (
    <div className="px-4 py-3 border-b border-line last:border-0">
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="font-mono text-[10px] text-dim">{out.name ? `${out.name} · ` : ''}{out.type}</span>
        <CopyButton value={text} />
      </div>
      <pre className="font-mono text-[13px] text-white whitespace-pre-wrap break-all">{text === '' ? '""' : text}</pre>
      {hint && <p className="font-mono text-[10px] text-dim mt-1">= {hint.join('  ·  ')}</p>}
    </div>
  );
}

/** balanceOf → "Balance of", setApprovalForAll → "Set approval for all" */
export function humanize(name: string) {
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
