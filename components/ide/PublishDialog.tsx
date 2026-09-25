'use client';

import { useEffect, useMemo, useState } from 'react';
import { shareUrl } from '@/lib/share';
import type { Target } from '@/lib/contract';
import { Button, CopyButton } from '../ui/primitives';

/** "Deploy" a simple dApp UI: the whole contract definition is packed into the link — no server, no database. */
export default function PublishDialog({ target, name, onClose }: { target: Target; name: string; onClose: () => void }) {
  const [title, setTitle] = useState(name || 'My contract');
  const [about, setAbout] = useState('');
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const url = useMemo(
    () => (origin ? shareUrl(origin, { name: title.trim() || 'Contract', about: about.trim() || undefined, address: target.address, chainId: target.chain.id, abi: target.abi, rpc: target.rpcUrl }) : ''),
    [origin, title, about, target],
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label="Publish dApp UI" className="w-full max-w-lg bg-panel border border-line-bright">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-display font-bold text-xl text-white">Publish a dApp UI</h2>
          <button onClick={onClose} aria-label="Close" className="text-dim hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          <p className="font-body text-sm text-dim">
            Get a clean page anyone can open to connect a wallet, read values and call functions on this contract.
            Everything lives in the link, so nothing is stored on a server.
          </p>
          <div>
            <label className="label">Title</label>
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
          </div>
          <div>
            <label className="label">Description <span className="normal-case tracking-normal text-dim/70">(optional)</span></label>
            <input className="field" value={about} onChange={(e) => setAbout(e.target.value)} maxLength={140} placeholder="What this contract does" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label">Link</label>
              <span className="font-mono text-[10px] text-dim mb-1.5">{url.length.toLocaleString()} chars</span>
            </div>
            <div className="field text-[11px] text-dim break-all max-h-24 overflow-y-auto">{url}</div>
            {url.length > 8000 && <p className="font-mono text-[11px] text-write mt-1">Long link — some chat apps may truncate it. Trim unused functions from the ABI to shorten it.</p>}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase px-4 py-2.5 bg-accent text-black font-semibold hover:bg-white">
              Open dApp ↗
            </a>
            <CopyButton value={url} label="Copy link" className="px-4 py-2.5 border border-line-bright" />
            <Button variant="subtle" onClick={onClose}>Done</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
