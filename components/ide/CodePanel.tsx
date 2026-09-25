'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { javascript } from '@codemirror/lang-javascript';
import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night';
import type { Abi } from 'viem';
import { generateContractClient, generateReactHooks, type AbiItem, type OutputLang } from '@/lib/codegen';
import { toIdentifier } from '@/lib/useTarget';
import { Button, CopyButton, Empty, Tabs } from '../ui/primitives';

const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false });

/** Same output as `npx @awarizon/cli generate` — typed client + React hooks. */
export default function CodePanel({ name, address, abi }: { name: string; address: string; abi: Abi | null }) {
  const [lang, setLang] = useState<OutputLang>('ts');
  const [file, setFile] = useState<'client' | 'hooks'>('hooks');
  const id = toIdentifier(name || 'Contract');

  const code = useMemo(() => {
    if (!abi) return '';
    const a = abi as unknown as AbiItem[];
    const addr = address.trim() || '0x0000000000000000000000000000000000000000';
    return file === 'client' ? generateContractClient(id, addr, a, lang) : generateReactHooks(id, addr, a, lang);
  }, [abi, address, id, lang, file]);

  if (!abi) return <Empty title="No ABI yet">Paste an ABI to generate a typed client and React hooks.</Empty>;

  const filename = file === 'client' ? `${id}Client.${lang}` : `use${id}.${lang === 'ts' ? 'ts' : 'js'}`;

  const download = () => {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-4">
        <Tabs value={file} onChange={setFile} items={[{ id: 'hooks', label: 'React hooks' }, { id: 'client', label: 'Contract client' }]} className="border-0" />
        <div className="flex items-center gap-3">
          <div className="flex border border-line">
            {(['ts', 'js'] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 ${lang === l ? 'bg-accent text-black' : 'text-dim hover:text-white'}`}>
                {l === 'ts' ? 'TypeScript' : 'JavaScript'}
              </button>
            ))}
          </div>
          <CopyButton value={code} />
          <Button size="sm" onClick={download}>Download</Button>
        </div>
      </div>
      <p className="px-6 pt-3 font-mono text-[11px] text-dim">
        {filename} · uses <span className="text-accent">@awarizon/react</span> — same as <span className="text-white">npx @awarizon/cli generate</span>
      </p>
      <div className="flex-1 min-h-0 m-6 mt-3 border border-line bg-panel-2 overflow-auto">
        <CodeMirror value={code} theme={tokyoNight} extensions={[javascript({ typescript: lang === 'ts' })]} editable={false} basicSetup={{ foldGutter: true, highlightActiveLine: false }} />
      </div>
    </div>
  );
}
