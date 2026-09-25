import {
  getAddress,
  isAddress,
  isHex,
  parseAbi,
  parseUnits,
  size,
  toFunctionSignature,
  type Abi,
  type AbiEvent,
  type AbiFunction,
  type AbiParameter,
} from 'viem';

type AbiError = Extract<Abi[number], { type: 'error' }>;

// ─── ABI input ────────────────────────────────────────────────────────────────

export interface ParsedContractInput {
  abi: Abi;
  /** Contract name, when the input was a Hardhat/Foundry artifact. */
  name?: string;
}

/**
 * Accepts anything a developer is likely to paste:
 *   - a JSON ABI array
 *   - `{ "abi": [...] }` (Hardhat / Foundry artifacts, Etherscan responses)
 *   - a human-readable ABI: one `function …` / `event …` per line, or a JSON array of those strings
 */
export function parseContractInput(text: string): ParsedContractInput {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Paste an ABI or upload an artifact');

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    let json: unknown;
    try {
      json = JSON.parse(trimmed);
    } catch (e) {
      throw new Error(`Invalid JSON: ${(e as Error).message}`);
    }
    const artifact = json as { abi?: unknown; contractName?: string; sourceName?: string };
    let raw: unknown = Array.isArray(json) ? json : artifact.abi;
    // Etherscan returns the ABI as a JSON string inside `result`
    if (!raw && typeof (json as { result?: unknown }).result === 'string') raw = JSON.parse((json as { result: string }).result);
    if (!Array.isArray(raw)) throw new Error('No ABI array found — expected [...] or { "abi": [...] }');
    const abi = Array.isArray(raw) && raw.every((x) => typeof x === 'string') ? parseAbi(raw as string[]) : (raw as Abi);
    validateAbi(abi);
    return { abi, name: artifact.contractName };
  }

  // Human-readable, one signature per line
  const lines = trimmed.split('\n').map((l) => l.trim().replace(/[;,]$/, '')).filter((l) => l && !l.startsWith('//'));
  try {
    return { abi: parseAbi(lines) };
  } catch (e) {
    throw new Error(`Could not parse human-readable ABI: ${(e as Error).message.split('\n')[0]}`);
  }
}

function validateAbi(abi: Abi) {
  const known = new Set(['function', 'event', 'error', 'constructor', 'fallback', 'receive']);
  abi.forEach((item, i) => {
    if (!item || typeof item !== 'object' || !known.has((item as { type?: string }).type ?? '')) {
      throw new Error(`ABI item ${i} is not a valid function, event, error or constructor`);
    }
  });
}

/** Strip compiler metadata so share links stay short. */
export function minifyAbi(abi: Abi): Abi {
  const strip = (p: AbiParameter): AbiParameter => {
    const { internalType, ...rest } = p as AbiParameter & { internalType?: string };
    void internalType;
    return 'components' in rest && rest.components
      ? ({ ...rest, components: rest.components.map(strip) } as AbiParameter)
      : (rest as AbiParameter);
  };
  return abi
    .filter((i) => i.type === 'function' || i.type === 'event' || i.type === 'error')
    .map((i) => {
      const item = { ...i } as Record<string, unknown>;
      delete item.gas;
      delete item.constant;
      delete item.payable;
      if ('inputs' in i && i.inputs) item.inputs = i.inputs.map(strip);
      if ('outputs' in i && i.outputs) item.outputs = (i.outputs as AbiParameter[]).map(strip);
      return item;
    }) as unknown as Abi;
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

export type FnKind = 'read' | 'write' | 'payable';

export interface ContractFn {
  /** Unique id — the full signature, so overloads stay distinct. */
  id: string;
  name: string;
  kind: FnKind;
  item: AbiFunction;
  /** True when the name is overloaded in this ABI. */
  overloaded: boolean;
}

export interface GroupedAbi {
  functions: ContractFn[];
  events: AbiEvent[];
  errors: AbiError[];
}

export function kindOf(fn: AbiFunction): FnKind {
  if (fn.stateMutability === 'view' || fn.stateMutability === 'pure') return 'read';
  return fn.stateMutability === 'payable' ? 'payable' : 'write';
}

export function groupAbi(abi: Abi): GroupedAbi {
  const fns = abi.filter((i): i is AbiFunction => i.type === 'function');
  const counts = new Map<string, number>();
  for (const f of fns) counts.set(f.name, (counts.get(f.name) ?? 0) + 1);
  const order: Record<FnKind, number> = { read: 0, write: 1, payable: 2 };
  return {
    functions: fns
      .map((item) => ({
        id: toFunctionSignature(item),
        name: item.name,
        kind: kindOf(item),
        item,
        overloaded: (counts.get(item.name) ?? 0) > 1,
      }))
      .sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name)),
    events: abi.filter((i): i is AbiEvent => i.type === 'event').sort((a, b) => a.name.localeCompare(b.name)),
    errors: abi.filter((i): i is AbiError => i.type === 'error'),
  };
}

// ─── Argument parsing ─────────────────────────────────────────────────────────

export class ArgError extends Error {}

const UNIT_DECIMALS: Record<string, number> = { wei: 0, gwei: 9, ether: 18, eth: 18 };

function parseInteger(raw: string, type: string): bigint {
  const s = raw.trim().replace(/_/g, '').replace(/,/g, '');
  if (!s) throw new ArgError('Required');
  let value: bigint;
  const unit = s.match(/^(-?[\d.]+(?:e\d+)?)\s*(wei|gwei|ether|eth)$/i);
  try {
    if (unit) {
      value = parseUnits(unit[1], UNIT_DECIMALS[unit[2].toLowerCase()]);
    } else if (/^-?0x[0-9a-f]+$/i.test(s)) {
      value = s.startsWith('-') ? -BigInt(s.slice(1)) : BigInt(s);
    } else if (/^-?\d+(\.\d+)?e\d+$/i.test(s)) {
      // 1e18, 1.5e6
      const [mant, exp] = s.toLowerCase().split('e');
      value = parseUnits(mant, Number(exp));
    } else if (/^-?\d+$/.test(s)) {
      value = BigInt(s);
    } else {
      throw new Error();
    }
  } catch {
    throw new ArgError('Not a whole number — try 42, 0x2a, 1e18 or "1.5 ether"');
  }
  const bits = Number(type.replace(/^u?int/, '') || 256);
  if (type.startsWith('uint')) {
    if (value < 0n) throw new ArgError(`${type} can't be negative`);
    if (value >= 2n ** BigInt(bits)) throw new ArgError(`Too large for ${type}`);
  } else {
    const lim = 2n ** BigInt(bits - 1);
    if (value < -lim || value >= lim) throw new ArgError(`Out of range for ${type}`);
  }
  return value;
}

function parseScalar(type: string, raw: unknown): unknown {
  if (type === 'address') {
    const s = String(raw ?? '').trim();
    if (!isAddress(s, { strict: false })) throw new ArgError('Not a valid address');
    return getAddress(s);
  }
  if (type === 'bool') {
    if (typeof raw === 'boolean') return raw;
    const s = String(raw ?? '').trim().toLowerCase();
    if (['true', '1', 'yes'].includes(s)) return true;
    if (['false', '0', 'no', ''].includes(s)) return false;
    throw new ArgError('Use true or false');
  }
  if (type === 'string') return String(raw ?? '');
  if (/^u?int\d*$/.test(type)) return parseInteger(String(raw ?? ''), type);
  if (type === 'bytes' || /^bytes\d+$/.test(type)) {
    const s = String(raw ?? '').trim();
    if (!isHex(s)) throw new ArgError('Hex value required (0x…)');
    const n = type === 'bytes' ? null : Number(type.slice(5));
    if (n !== null && size(s) !== n) throw new ArgError(`${type} needs exactly ${n} bytes (${n * 2} hex chars)`);
    return s;
  }
  throw new ArgError(`Unsupported type ${type}`);
}

/** Parse user input (form string or already-structured JSON value) into a value viem can encode. */
export function parseArg(param: AbiParameter, raw: unknown): unknown {
  const arrayMatch = param.type.match(/^(.*)\[(\d*)\]$/);
  if (arrayMatch) {
    const [, inner, fixed] = arrayMatch;
    let list: unknown[];
    if (Array.isArray(raw)) list = raw;
    else {
      const s = String(raw ?? '').trim();
      if (!s) list = [];
      else if (s.startsWith('[')) {
        try { list = JSON.parse(s); } catch { throw new ArgError('Invalid JSON array'); }
      } else if (!inner.startsWith('tuple')) {
        list = s.split(',').map((x) => x.trim());
      } else throw new ArgError('Enter a JSON array of objects');
    }
    if (fixed && list.length !== Number(fixed)) throw new ArgError(`Expected exactly ${fixed} items`);
    const innerParam = { ...param, type: inner } as AbiParameter;
    return list.map((item, i) => {
      try { return parseArg(innerParam, item); } catch (e) { throw new ArgError(`[${i}] ${(e as Error).message}`); }
    });
  }

  if (param.type === 'tuple') {
    const components = (param as { components?: readonly AbiParameter[] }).components ?? [];
    let obj: unknown = raw;
    if (typeof raw === 'string') {
      try { obj = JSON.parse(raw); } catch { throw new ArgError('Enter a JSON object, e.g. {"to":"0x…","amount":"1"}'); }
    }
    if (!obj || typeof obj !== 'object') throw new ArgError('Expected an object or array');
    const values = Array.isArray(obj) ? obj : components.map((c, i) => (obj as Record<string, unknown>)[c.name ?? String(i)]);
    const out: Record<string, unknown> = {};
    const outArr: unknown[] = [];
    components.forEach((c, i) => {
      try {
        const v = parseArg(c, values[i]);
        outArr.push(v);
        if (c.name) out[c.name] = v;
      } catch (e) {
        throw new ArgError(`${c.name || `[${i}]`}: ${(e as Error).message}`);
      }
    });
    // viem accepts named objects when every component is named
    return components.every((c) => c.name) ? out : outArr;
  }

  return parseScalar(param.type, raw);
}

export function parseArgs(params: readonly AbiParameter[], raws: unknown[]): { args: unknown[]; errors: (string | null)[] } {
  const errors: (string | null)[] = [];
  const args = params.map((p, i) => {
    try {
      errors.push(null);
      return parseArg(p, raws[i]);
    } catch (e) {
      errors[i] = (e as Error).message;
      return undefined;
    }
  });
  return { args, errors };
}

export function placeholderFor(param: AbiParameter): string {
  const t = param.type;
  if (t.endsWith(']')) return t.startsWith('tuple') ? '[{…}, {…}]' : 'a, b, c   or   ["a","b"]';
  if (t === 'tuple') return '{ "field": value }';
  if (t === 'address') return '0x…';
  if (t === 'bool') return 'true / false';
  if (t.startsWith('uint') || t.startsWith('int')) return '42  ·  1e18  ·  1.5 ether';
  if (t.startsWith('bytes')) return '0x…';
  return t;
}

// ─── Output formatting ────────────────────────────────────────────────────────

/** JSON-safe clone: bigints → decimal strings. */
export function toPlain(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]));
  return value;
}

export function stringify(value: unknown): string {
  const plain = toPlain(value);
  return typeof plain === 'string' ? plain : JSON.stringify(plain, null, 2);
}

export interface NamedOutput {
  name: string;
  type: string;
  value: unknown;
}

/** Pair a readContract result with the function's output names/types. */
export function namedOutputs(fn: AbiFunction, result: unknown): NamedOutput[] {
  const outs = fn.outputs ?? [];
  if (outs.length <= 1) return [{ name: outs[0]?.name || '', type: outs[0]?.type ?? 'unknown', value: result }];
  const arr = Array.isArray(result) ? result : Object.values(result as object);
  return outs.map((o, i) => ({ name: o.name || `[${i}]`, type: o.type, value: arr[i] }));
}
