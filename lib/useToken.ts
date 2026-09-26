'use client';

import { useEffect, useState } from 'react';
import { formatUnits } from 'viem';
import type { GroupedAbi } from './abi';
import { readFn, type Target } from './contract';

export interface TokenInfo {
  decimals: number;
  symbol?: string;
}

const cache = new Map<string, TokenInfo | null>();

/**
 * If the contract exposes `decimals()` (ERC-20 style), read decimals + symbol once so
 * amounts can be shown and entered in whole-token units.
 */
export function useTokenInfo(target: Target | null, grouped: GroupedAbi | null): TokenInfo | null {
  const [info, setInfo] = useState<TokenInfo | null>(null);
  const key = target ? `${target.chain.id}:${target.address}` : '';

  useEffect(() => {
    setInfo(null);
    if (!target || !grouped) return;
    const find = (name: string) =>
      grouped.functions.find((f) => f.name === name && f.kind === 'read' && (f.item.inputs?.length ?? 0) === 0);
    const decimalsFn = find('decimals');
    if (!decimalsFn || !/^uint/.test(decimalsFn.item.outputs?.[0]?.type ?? '')) return;
    if (cache.has(key)) { setInfo(cache.get(key) ?? null); return; }

    let live = true;
    const symbolFn = find('symbol');
    Promise.all([
      readFn(target, decimalsFn.item, []),
      symbolFn ? readFn(target, symbolFn.item, []).catch(() => undefined) : Promise.resolve(undefined),
    ])
      .then(([d, sym]) => {
        const decimals = Number(d);
        const value = Number.isInteger(decimals) && decimals >= 0 && decimals <= 36
          ? { decimals, symbol: typeof sym === 'string' && sym ? sym : undefined }
          : null;
        cache.set(key, value);
        if (live) setInfo(value);
      })
      .catch(() => { cache.set(key, null); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, grouped]);

  return info;
}

/** 4306161829228318n, 6 → "4,306,161,829.228318" (trailing zeros trimmed). */
export function formatTokenAmount(value: bigint, decimals: number, maxFraction = 6): string {
  const [whole, frac = ''] = formatUnits(value, decimals).split('.');
  const neg = whole.startsWith('-');
  const digits = neg ? whole.slice(1) : whole;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const f = frac.slice(0, maxFraction).replace(/0+$/, '');
  return `${neg ? '-' : ''}${grouped}${f ? '.' + f : ''}`;
}

/** Amount-like integer types worth showing in token units (uint8 etc. are usually flags/decimals). */
export const isAmountType = (type: string) => type === 'uint256' || type === 'int256' || type === 'uint128' || type === 'uint112' || type === 'uint96';
