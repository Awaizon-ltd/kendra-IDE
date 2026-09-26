import { describe, expect, it } from 'vitest';
import { formatTokenAmount, isAmountType } from '@/lib/useToken';

describe('formatTokenAmount', () => {
  it('groups thousands and trims trailing zeros', () => {
    expect(formatTokenAmount(4306161829228318n, 6)).toBe('4,306,161,829.228318');
    expect(formatTokenAmount(79178602637n, 6)).toBe('79,178.602637');
    expect(formatTokenAmount(12_500_000n, 6)).toBe('12.5');
    expect(formatTokenAmount(10n ** 18n, 18)).toBe('1');
  });
  it('caps fraction digits and handles negatives and dust', () => {
    expect(formatTokenAmount(1_234_567_890_123_456_789n, 18)).toBe('1.234567');
    expect(formatTokenAmount(-1_500_000n, 6)).toBe('-1.5');
    expect(formatTokenAmount(1n, 18)).toBe('0');
  });
});

describe('isAmountType', () => {
  it('treats wide integers as amounts, small ones as flags/decimals', () => {
    expect(isAmountType('uint256')).toBe(true);
    expect(isAmountType('uint8')).toBe(false);
  });
});
