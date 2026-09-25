'use client';

import { useMemo } from 'react';
import { getAddress, isAddress } from 'viem';
import { getChain } from './chains';
import type { Target } from './contract';
import { useKendra } from './store';

/** The contract the IDE is pointed at — null until address, chain and ABI are all valid. */
export function useTarget(): Target | null {
  const { ws, abi } = useKendra();
  return useMemo(() => {
    const chain = getChain(ws.chainId);
    if (!abi || !chain || !isAddress(ws.address.trim(), { strict: false })) return null;
    return { chain, rpcUrl: ws.rpcUrl.trim() || undefined, address: getAddress(ws.address.trim()), abi };
  }, [abi, ws.address, ws.chainId, ws.rpcUrl]);
}

/** PascalCase identifier for generated code (e.g. "my token" → "MyToken"). */
export function toIdentifier(name: string): string {
  const pascal = name
    .replace(/[^a-zA-Z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ''))
    .replace(/^./, (c) => c.toUpperCase());
  if (!pascal) return 'Contract';
  return /^[0-9]/.test(pascal) ? `Contract${pascal}` : pascal;
}
