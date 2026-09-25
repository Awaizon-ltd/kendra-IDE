'use client';

import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { FnKind } from '@/lib/abi';

type Variant = 'primary' | 'ghost' | 'subtle' | 'danger';

export function Button({
  variant = 'ghost',
  size = 'md',
  loading,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean }) {
  const v: Record<Variant, string> = {
    primary: 'bg-accent text-black hover:bg-white font-semibold',
    ghost: 'border border-line-bright text-muted hover:text-white hover:border-white/30',
    subtle: 'text-dim hover:text-white hover:bg-panel-3',
    danger: 'border border-bad/40 text-bad hover:bg-bad/10',
  };
  const s = size === 'sm' ? 'px-2.5 py-1.5 text-[10px]' : 'px-4 py-2.5 text-[11px]';
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-mono tracking-widest uppercase transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${v[variant]} ${s} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`inline-block w-3 h-3 rounded-full border-2 border-current border-r-transparent animate-spin ${className}`} />;
}

const KIND_STYLE: Record<FnKind, string> = {
  read: 'text-read border-read/30 bg-read/10',
  write: 'text-write border-write/30 bg-write/10',
  payable: 'text-pay border-pay/30 bg-pay/10',
};

export function KindBadge({ kind, className = '' }: { kind: FnKind; className?: string }) {
  return (
    <span className={`inline-flex items-center font-mono text-[9px] tracking-widest uppercase px-1.5 py-0.5 border ${KIND_STYLE[kind]} ${className}`}>
      {kind}
    </span>
  );
}

export function CopyButton({ value, label = 'Copy', className = '' }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`font-mono text-[10px] tracking-widest uppercase text-dim hover:text-accent transition-colors ${className}`}
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1200); } catch {}
      }}
    >
      {done ? 'Copied' : label}
    </button>
  );
}

export function Tabs<T extends string>({ value, onChange, items, className = '' }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode }[]; className?: string }) {
  return (
    <div role="tablist" className={`flex border-b border-line ${className}`}>
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={`font-mono text-[10px] tracking-widest uppercase whitespace-nowrap shrink-0 px-4 py-3 border-b-2 -mb-px transition-colors ${
            value === it.id ? 'border-accent text-white' : 'border-transparent text-dim hover:text-white'
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center px-8">
      <p className="font-display font-bold text-xl text-white mb-2">{title}</p>
      {children && <div className="font-body text-sm text-dim max-w-sm">{children}</div>}
    </div>
  );
}

export function KendraMark({ className = '' }: { className?: string }) {
  // Hook-and-contract glyph: a bracket closing around a node
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" fill="#C8F13F" />
      <path d="M11 8v16M11 16l9-8M11 16l9 8" stroke="#000" strokeWidth="3" strokeLinecap="square" fill="none" />
      <circle cx="22.5" cy="16" r="2.5" fill="#000" />
    </svg>
  );
}
