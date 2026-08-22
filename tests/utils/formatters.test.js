import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, toLocalISODate, getTodayISO, addDaysISO } from '../../src/utils/formatters';

describe('formatCurrency', () => {
  it('formats Indian number style with a ₹ prefix', () => {
    expect(formatCurrency(153000)).toBe('₹1,53,000');
    expect(formatCurrency(0)).toBe('₹0');
    expect(formatCurrency(-30000)).toBe('-₹30,000');
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

describe('toLocalISODate / getTodayISO', () => {
  it('formats a Date using local calendar getters, not UTC conversion', () => {
    // A local time very early in the morning - toISOString() would incorrectly
    // roll this back to the previous day for any timezone ahead of UTC.
    const earlyMorning = new Date(2026, 7, 21, 1, 30, 0); // Aug 21 2026, 1:30 AM local
    expect(toLocalISODate(earlyMorning)).toBe('2026-08-21');
  });

  it('getTodayISO matches the local calendar date components', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(getTodayISO()).toBe(expected);
  });
});

describe('addDaysISO', () => {
  it('adds days while staying in local-calendar-day arithmetic', () => {
    expect(addDaysISO('2026-08-21', 20)).toBe('2026-09-10');
  });

  it('handles month and year rollovers', () => {
    expect(addDaysISO('2026-12-25', 10)).toBe('2027-01-04');
  });

  it('handles negative days (subtraction)', () => {
    expect(addDaysISO('2026-08-05', -10)).toBe('2026-07-26');
  });
});
