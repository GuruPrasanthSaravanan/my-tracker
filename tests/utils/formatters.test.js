import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate } from '../../src/utils/formatters';

describe('formatCurrency', () => {
  it('formats Indian number style', () => {
    expect(formatCurrency(153000)).toBe('1,53,000');
    expect(formatCurrency(0)).toBe('0');
    expect(formatCurrency(-30000)).toBe('-30,000');
  });
});

describe('formatDate', () => {
  it('formats date for display', () => {
    expect(formatDate('2026-09-01')).toBe('1 Sep');
    expect(formatDate('2026-12-25')).toBe('25 Dec');
  });
});
