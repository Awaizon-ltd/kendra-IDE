'use client';

import { CHAINS } from '@/lib/chains';

export default function ChainSelect({ value, onChange, className = '' }: { value: number; onChange: (id: number) => void; className?: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`field appearance-none cursor-pointer bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23A0A0A0%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-no-repeat bg-[length:14px] bg-[right_10px_center] pr-8 ${className}`}
    >
      <optgroup label="Mainnets">
        {CHAINS.filter((c) => !c.testnet).map(({ chain }) => (
          <option key={chain.id} value={chain.id}>{chain.name}</option>
        ))}
      </optgroup>
      <optgroup label="Testnets & local">
        {CHAINS.filter((c) => c.testnet).map(({ chain }) => (
          <option key={chain.id} value={chain.id}>{chain.name}</option>
        ))}
      </optgroup>
    </select>
  );
}
