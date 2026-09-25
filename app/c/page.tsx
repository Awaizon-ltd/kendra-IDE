'use client';

import { useEffect, useMemo, useState } from 'react';
import { getAddress } from 'viem';
import { groupAbi } from '@/lib/abi';
import { decodeShare, encodeShare, type SharedContract } from '@/lib/share';
import { explorerUrl, getChain } from '@/lib/chains';
import type { Target } from '@/lib/contract';
import FunctionForm from '@/components/FunctionForm';
import StatePanel from '@/components/ide/StatePanel';
import WalletButton from '@/components/WalletButton';
import { CopyButton, KendraMark } from '@/components/ui/primitives';

/** Published dApp UI — the contract definition is read from the URL fragment, nothing from a server. */
export default function PublishedDapp() {
  const [data, setData] = useState<SharedContract | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      try { setData(decodeShare(window.location.hash)); setError(null); } catch (e) { setError((e as Error).message); }
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  useEffect(() => { if (data) document.title = `${data.name} | Kendra`; }, [data]);

  const chain = data ? getChain(data.chainId) : undefined;
  const target: Target | null = useMemo(
    () => (data && chain ? { chain, rpcUrl: data.rpc, address: getAddress(data.address), abi: data.abi } : null),
    [data, chain],
  );
  const grouped = useMemo(() => (data ? groupAbi(data.abi) : null), [data]);

  if (error || (data && !chain)) {
    return (
      <Shell>
        <div className="max-w-md mx-auto text-center py-32">
          <p className="font-display font-bold text-2xl text-white mb-2">Can't open this contract</p>
          <p className="font-body text-dim">{error ?? `Chain ${data?.chainId} isn't supported yet.`}</p>
        </div>
      </Shell>
    );
  }
  if (!data || !target || !grouped) return <Shell><div className="py-32" /></Shell>;

  const readsWithArgs = grouped.functions.filter((f) => f.kind === 'read' && (f.item.inputs?.length ?? 0) > 0);
  const writes = grouped.functions.filter((f) => f.kind !== 'read');
  const addressLink = explorerUrl(chain, 'address', target.address);

  return (
    <Shell right={<WalletButton chain={chain} />}>
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-10 md:py-14">
        <header className="mb-10">
          <span className="inline-flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-accent border border-accent/30 px-2 py-1 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" /> {chain!.name}
          </span>
          <h1 className="font-display font-extrabold text-4xl md:text-5xl text-white mb-3">{data.name}</h1>
          {data.about && <p className="font-body text-lg text-muted mb-4 max-w-2xl">{data.about}</p>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="font-mono text-[12px] text-dim break-all">{target.address}</span>
            <CopyButton value={target.address} />
            {addressLink && <a href={addressLink} target="_blank" rel="noreferrer" className="font-mono text-[10px] tracking-widest uppercase text-dim hover:text-accent">Explorer ↗</a>}
          </div>
        </header>

        <section className="mb-12">
          <h2 className="font-display font-bold text-xl text-white mb-4">Overview</h2>
          <StatePanel fns={grouped.functions} target={target} compact />
        </section>

        {readsWithArgs.length > 0 && (
          <section className="mb-12">
            <h2 className="font-display font-bold text-xl text-white mb-4">Look up</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {readsWithArgs.map((f) => <FunctionForm key={f.id} fn={f} target={target} variant="dapp" />)}
            </div>
          </section>
        )}

        {writes.length > 0 && (
          <section className="mb-12">
            <h2 className="font-display font-bold text-xl text-white mb-1">Actions</h2>
            <p className="font-body text-sm text-dim mb-4">These send a transaction from your connected wallet.</p>
            <div className="grid md:grid-cols-2 gap-4">
              {writes.map((f) => <FunctionForm key={f.id} fn={f} target={target} variant="dapp" />)}
            </div>
          </section>
        )}

        <footer className="pt-8 border-t border-line flex flex-wrap items-center justify-between gap-4">
          <p className="font-mono text-[10px] tracking-widest uppercase text-dim">Unaudited interface · always check what you sign</p>
          <a href={`/#k=${encodeShare(data)}`} className="font-mono text-[10px] tracking-widest uppercase text-dim hover:text-accent">Open in Kendra ↗</a>
        </footer>
      </div>
    </Shell>
  );
}

function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="h-14 flex items-center justify-between px-5 md:px-8 border-b border-line bg-panel">
        <a href="/" className="flex items-center gap-2">
          <KendraMark className="w-6 h-6" />
          <span className="font-mono text-[10px] tracking-widest uppercase text-dim">Built with Kendra</span>
        </a>
        {right}
      </header>
      {children}
    </div>
  );
}
