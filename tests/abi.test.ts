import { describe, expect, it } from 'vitest';
import { erc20Abi, type AbiParameter } from 'viem';
import { groupAbi, namedOutputs, parseArg, parseContractInput, stringify } from '@/lib/abi';
import { decodeShare, encodeShare } from '@/lib/share';

const p = (type: string, extra: Partial<AbiParameter> = {}) => ({ name: 'x', type, ...extra }) as AbiParameter;

describe('parseContractInput', () => {
  it('accepts a plain ABI array', () => {
    expect(parseContractInput(JSON.stringify(erc20Abi)).abi).toHaveLength(erc20Abi.length);
  });
  it('accepts a Hardhat artifact and keeps the name', () => {
    const r = parseContractInput(JSON.stringify({ contractName: 'Token', abi: erc20Abi, bytecode: '0x00' }));
    expect(r.name).toBe('Token');
  });
  it('accepts human-readable signatures', () => {
    const r = parseContractInput('function balanceOf(address owner) view returns (uint256)\nevent Ping(uint256 n);');
    expect(r.abi.map((i) => i.type)).toEqual(['function', 'event']);
  });
  it('rejects junk with a useful message', () => {
    expect(() => parseContractInput('{"foo":1}')).toThrow(/No ABI array/);
    expect(() => parseContractInput('[{"type":"nope"}]')).toThrow(/not a valid/);
  });
});

describe('groupAbi', () => {
  it('separates reads/writes and keeps overloads distinct', () => {
    const abi = parseContractInput(`function f(uint256) view returns (uint256)
function f(address) view returns (uint256)
function pay() payable
function set(uint8 v)`).abi;
    const g = groupAbi(abi);
    expect(g.functions.map((f) => f.kind)).toEqual(['read', 'read', 'write', 'payable']);
    expect(g.functions.filter((f) => f.overloaded)).toHaveLength(2);
    expect(new Set(g.functions.map((f) => f.id)).size).toBe(4);
  });
});

describe('parseArg', () => {
  it('parses integers in every common notation', () => {
    expect(parseArg(p('uint256'), '42')).toBe(42n);
    expect(parseArg(p('uint256'), '0x2a')).toBe(42n);
    expect(parseArg(p('uint256'), '1e18')).toBe(10n ** 18n);
    expect(parseArg(p('uint256'), '1.5 ether')).toBe(15n * 10n ** 17n);
    expect(parseArg(p('uint256'), '2 gwei')).toBe(2_000_000_000n);
    expect(parseArg(p('int8'), '-128')).toBe(-128n);
  });
  it('enforces integer ranges', () => {
    expect(() => parseArg(p('uint8'), '256')).toThrow(/Too large/);
    expect(() => parseArg(p('uint256'), '-1')).toThrow(/negative/);
    expect(() => parseArg(p('int8'), '128')).toThrow(/Out of range/);
    expect(() => parseArg(p('uint256'), 'abc')).toThrow(/whole number/);
  });
  it('checksums addresses and validates bytes', () => {
    expect(parseArg(p('address'), '0xd8da6bf26964af9d7eed9e03e53415d37aa96045')).toBe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    expect(() => parseArg(p('address'), '0x123')).toThrow(/address/);
    expect(() => parseArg(p('bytes4'), '0x1234')).toThrow(/exactly 4 bytes/);
    expect(parseArg(p('bytes4'), '0x12345678')).toBe('0x12345678');
  });
  it('parses arrays from JSON or comma lists', () => {
    expect(parseArg(p('uint256[]'), '1, 2, 3')).toEqual([1n, 2n, 3n]);
    expect(parseArg(p('uint256[2]'), '["1","2"]')).toEqual([1n, 2n]);
    expect(() => parseArg(p('uint256[2]'), '1')).toThrow(/exactly 2/);
  });
  it('parses tuples from JSON objects', () => {
    const t = p('tuple', { components: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }] } as never);
    expect(parseArg(t, '{"to":"0xd8da6bf26964af9d7eed9e03e53415d37aa96045","amount":"1 ether"}')).toEqual({
      to: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      amount: 10n ** 18n,
    });
  });
});

describe('outputs', () => {
  it('names multi-value outputs and stringifies bigints', () => {
    const fn = parseContractInput('function r() view returns (uint112 reserve0, uint112 reserve1)').abi[0] as never;
    const out = namedOutputs(fn, [1n, 2n]);
    expect(out.map((o) => o.name)).toEqual(['reserve0', 'reserve1']);
    expect(stringify({ a: 1n, b: [2n] })).toContain('"a": "1"');
  });
});

describe('share links', () => {
  it('round-trips a contract and strips compiler noise', () => {
    // Compilers attach internalType to each parameter
    const abi = erc20Abi.map((i) => ({ ...i, inputs: i.inputs.map((x) => ({ ...x, internalType: x.type })) })) as never;
    const frag = encodeShare({ name: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', chainId: 8453, abi });
    const back = decodeShare('#' + frag);
    expect(back.name).toBe('USDC');
    expect(back.abi).toHaveLength(erc20Abi.length);
    expect(JSON.stringify(back.abi)).not.toContain('internalType');
  });
  it('rejects tampered links', () => {
    expect(() => decodeShare('#garbage')).toThrow();
  });
});
