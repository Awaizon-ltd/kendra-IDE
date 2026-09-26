import { describe, expect, it } from 'vitest';
import { arbitrum, mainnet } from 'viem/chains';
import { fetchVerifiedAbi } from '@/lib/fetchAbi';

// Hits Sourcify + public RPCs. Run with: LIVE=1 npm test
describe.runIf(process.env.LIVE)('fetchVerifiedAbi (live)', () => {
  it('resolves a proxy to its implementation and merges both ABIs', async () => {
    const r = await fetchVerifiedAbi(arbitrum, '0xaf88d065e77c8cC2239327C5EDb3A432268e5831');
    expect(r?.source).toBe('Sourcify');
    expect(r?.implementation?.name).toBe('FiatTokenV2_2');
    const names = r!.abi.filter((i) => i.type === 'function').map((i) => (i as { name: string }).name);
    expect(names).toContain('transferWithAuthorization'); // implementation
    expect(names).toContain('upgradeTo'); // proxy admin
  }, 30_000);

  it('returns a plain verified contract as-is', async () => {
    const r = await fetchVerifiedAbi(mainnet, '0xdAC17F958D2ee523a2206206994597C13D831ec7');
    expect(r?.name).toBe('TetherToken');
    expect(r?.implementation).toBeUndefined();
  }, 30_000);

  it('returns null for unverified addresses', async () => {
    expect(await fetchVerifiedAbi(arbitrum, '0x000000000000000000000000000000000000dEaD')).toBeNull();
  }, 30_000);
});
