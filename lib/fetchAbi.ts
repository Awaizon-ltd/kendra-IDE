import { getAddress, isAddress, type Abi, type AbiParameter, type Chain } from 'viem';
import { publicClient } from './contract';

export interface FetchedAbi {
  abi: Abi;
  name?: string;
  source: 'Sourcify' | 'Blockscout' | 'Etherscan';
  /** Set when the address is a proxy: the implementation whose functions were merged in. */
  implementation?: { address: string; name?: string };
}

// EIP-1967 storage slots (keccak256('eip1967.proxy.implementation') - 1, and the beacon slot)
const IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const BEACON_SLOT = '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50';

type Found = { abi: Abi; name?: string; implementation?: string; implementationName?: string };

async function getJson(url: string, signal?: AbortSignal): Promise<any | null> {
  try {
    const res = await fetch(url, { signal, headers: { accept: 'application/json' } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function fromSourcify(chainId: number, address: string, signal?: AbortSignal): Promise<Found | null> {
  const j = await getJson(`https://sourcify.dev/server/v2/contract/${chainId}/${address}?fields=abi,compilation,proxyResolution`, signal);
  if (!j?.match || !Array.isArray(j.abi)) return null;
  const impl = j.proxyResolution?.isProxy ? j.proxyResolution.implementations?.[0] : undefined;
  return { abi: j.abi, name: j.compilation?.name, implementation: impl?.address, implementationName: impl?.name };
}

async function fromBlockscout(chain: Chain, address: string, signal?: AbortSignal): Promise<Found | null> {
  const base = chain.blockExplorers?.default.url;
  if (!base || !/blockscout/i.test(base)) return null;
  const j = await getJson(`${base.replace(/\/$/, '')}/api/v2/smart-contracts/${address}`, signal);
  if (!Array.isArray(j?.abi)) return null;
  const impl = j.implementations?.[0];
  return { abi: j.abi, name: j.name, implementation: impl?.address, implementationName: impl?.name };
}

async function fromEtherscan(chainId: number, address: string, signal?: AbortSignal): Promise<Found | null> {
  const key = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY;
  if (!key) return null;
  const j = await getJson(`https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getsourcecode&address=${address}&apikey=${key}`, signal);
  const r = j?.result?.[0];
  if (!r?.ABI || r.ABI.startsWith('Contract source code not verified')) return null;
  try {
    return { abi: JSON.parse(r.ABI), name: r.ContractName || undefined, implementation: r.Implementation || undefined };
  } catch {
    return null;
  }
}

/** On-chain fallback for proxies the source provider didn't flag. */
async function detectImplementation(chain: Chain, address: `0x${string}`, rpcUrl?: string): Promise<string | undefined> {
  const client = publicClient(chain, rpcUrl);
  const slotAddr = (v?: string) => (v && BigInt(v) !== 0n ? getAddress(`0x${v.slice(-40)}`) : undefined);
  try {
    const impl = slotAddr(await client.getStorageAt({ address, slot: IMPL_SLOT }));
    if (impl) return impl;
    const beacon = slotAddr(await client.getStorageAt({ address, slot: BEACON_SLOT }));
    if (beacon) {
      return await client.readContract({
        address: beacon,
        abi: [{ type: 'function', name: 'implementation', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }],
        functionName: 'implementation',
      });
    }
  } catch { /* not a standard proxy */ }
  return undefined;
}

async function lookup(chain: Chain, address: string, signal?: AbortSignal): Promise<(Found & { source: FetchedAbi['source'] }) | null> {
  const s = await fromSourcify(chain.id, address, signal);
  if (s) return { ...s, source: 'Sourcify' };
  const b = await fromBlockscout(chain, address, signal);
  if (b) return { ...b, source: 'Blockscout' };
  const e = await fromEtherscan(chain.id, address, signal);
  if (e) return { ...e, source: 'Etherscan' };
  return null;
}

/** Proxy + implementation ABIs, deduped by signature (implementation wins). */
function mergeAbis(proxy: Abi, impl: Abi): Abi {
  const types = (ps: readonly AbiParameter[]): string =>
    ps.map((p) => (p.type.startsWith('tuple') ? `(${types((p as { components?: readonly AbiParameter[] }).components ?? [])})${p.type.slice(5)}` : p.type)).join(',');
  const key = (i: Abi[number]) =>
    'name' in i ? `${i.type}:${i.name}(${types(i.inputs ?? [])})` : i.type;
  const out = new Map<string, Abi[number]>();
  for (const i of proxy) if (i.type !== 'constructor') out.set(key(i), i);
  for (const i of impl) if (i.type !== 'constructor') out.set(key(i), i);
  return [...out.values()];
}

/**
 * Find a verified ABI for `address` on `chain`, resolving proxies to their implementation.
 * Returns null when the contract isn't verified on any supported source.
 */
export async function fetchVerifiedAbi(chain: Chain, rawAddress: string, rpcUrl?: string, signal?: AbortSignal): Promise<FetchedAbi | null> {
  if (!isAddress(rawAddress, { strict: false })) return null;
  const address = getAddress(rawAddress);
  const found = await lookup(chain, address, signal);
  if (!found) return null;

  const implAddress = found.implementation ?? (await detectImplementation(chain, address, rpcUrl));
  if (!implAddress || implAddress.toLowerCase() === address.toLowerCase()) {
    return { abi: found.abi, name: found.name, source: found.source };
  }
  const impl = await lookup(chain, implAddress, signal);
  if (!impl) return { abi: found.abi, name: found.name, source: found.source, implementation: { address: implAddress } };
  return {
    abi: mergeAbis(found.abi, impl.abi),
    // Name the contract after what it does (the implementation), not the proxy shell
    name: impl.name ?? found.implementationName ?? found.name,
    source: found.source,
    implementation: { address: implAddress, name: impl.name ?? found.implementationName },
  };
}
