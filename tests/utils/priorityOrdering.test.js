import { describe, it, expect } from 'vitest';
import { parsePayoffPriority, buildPriorityOrderItems } from '../../src/utils/priorityOrdering';

describe('parsePayoffPriority', () => {
  it('parses a plain numeric string', () => {
    expect(parsePayoffPriority('3')).toBe(3);
  });

  it('parses a real number value (not just a string)', () => {
    expect(parsePayoffPriority(5)).toBe(5);
  });

  it('strips stray formatting characters a Sheets cell might display (currency, decimals, percent, thousands separators)', () => {
    // readSheet returns the *formatted* display value, not the raw number -
    // if this column ever inherits number/currency formatting from an
    // adjacent cell (a real Sheets quirk when typed into directly, bypassing
    // the app's own form), a typed "1" can come back as "₹1.00" - this must
    // parse back to 1, not NaN and not 100 (stripping the decimal point too
    // would wrongly merge "1" and "00" together).
    expect(parsePayoffPriority('₹1.00')).toBe(1);
    expect(parsePayoffPriority('2.00%')).toBe(2);
    expect(parsePayoffPriority('1,234')).toBe(1234);
  });

  it('returns null for blank/missing/non-numeric input instead of NaN', () => {
    expect(parsePayoffPriority('')).toBeNull();
    expect(parsePayoffPriority(null)).toBeNull();
    expect(parsePayoffPriority(undefined)).toBeNull();
    expect(parsePayoffPriority('abc')).toBeNull();
  });
});

describe('buildPriorityOrderItems', () => {
  it('splits items into included (has a priority, sorted ascending) and excluded (no priority yet)', () => {
    const { included, excluded } = buildPriorityOrderItems({
      handLoans: [{ _rowIndex: 0, payoffPriority: 2, name: 'Gold Loan' }, { _rowIndex: 1, payoffPriority: null, name: 'No Priority' }],
      emiLoans: [{ _rowIndex: 0, payoffPriority: 1, name: 'Car EMI' }],
      projects: [{ _rowIndex: 0, payoffPriority: 3, name: 'Construction' }],
    });
    expect(included.map((i) => i.name)).toEqual(['Car EMI', 'Gold Loan', 'Construction']);
    expect(excluded.map((i) => i.name)).toEqual(['No Priority']);
  });

  it('falls back to a Project\'s code when it has no name', () => {
    const { included } = buildPriorityOrderItems({ projects: [{ _rowIndex: 0, payoffPriority: 1, code: 'CONSTR', name: '' }] });
    expect(included[0].name).toBe('CONSTR');
  });

  it('returns empty lists when nothing is eligible', () => {
    expect(buildPriorityOrderItems({})).toEqual({ included: [], excluded: [] });
    expect(buildPriorityOrderItems()).toEqual({ included: [], excluded: [] });
  });

  it('everything with no priority set lands in excluded, in original order', () => {
    const { included, excluded } = buildPriorityOrderItems({
      handLoans: [{ _rowIndex: 0, payoffPriority: null, name: 'A' }, { _rowIndex: 1, payoffPriority: null, name: 'B' }],
    });
    expect(included).toEqual([]);
    expect(excluded.map((i) => i.name)).toEqual(['A', 'B']);
  });
});
