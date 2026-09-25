import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { isAddress, type Abi } from 'viem';
import { minifyAbi } from './abi';

/**
 * A published contract UI lives entirely in the URL fragment: nothing is stored
 * server-side, and fragments are never sent to the server, so ABIs stay private
 * to whoever holds the link.
 */
export interface SharedContract {
  v: 1;
  name: string;
  address: `0x${string}`;
  chainId: number;
  abi: Abi;
  /** Optional custom RPC (e.g. for chains without a good public endpoint). */
  rpc?: string;
  /** Optional one-line description shown on the published page. */
  about?: string;
}

export function encodeShare(data: Omit<SharedContract, 'v' | 'abi'> & { abi: Abi }): string {
  const payload: SharedContract = { v: 1, ...data, abi: minifyAbi(data.abi) };
  return compressToEncodedURIComponent(JSON.stringify(payload));
}

export function decodeShare(fragment: string): SharedContract {
  const raw = fragment.replace(/^#/, '');
  const json = decompressFromEncodedURIComponent(raw);
  if (!json) throw new Error('This link is incomplete or corrupted');
  const data = JSON.parse(json) as SharedContract;
  if (data.v !== 1 || !Array.isArray(data.abi) || !isAddress(data.address) || !Number.isInteger(data.chainId))
    throw new Error('This link is not a valid Kendra contract');
  return data;
}

export function shareUrl(origin: string, data: Parameters<typeof encodeShare>[0]): string {
  return `${origin}/c#${encodeShare(data)}`;
}
