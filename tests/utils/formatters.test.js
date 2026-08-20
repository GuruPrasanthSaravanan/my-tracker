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

  it('falls back to the raw string for unparseable dates instead of NaN', () => {
    expect(formatDate('not-a-real-date')).toBe('not-a-real-date');
    expect(formatDate('')).toBe('');
    expect(formatDate(undefined)).toBe('');
  });
});
