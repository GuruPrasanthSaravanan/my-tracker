import { describe, it, expect } from 'vitest';
import { collectPriorityItems, suggestNextPriority, resolvePriorityShifts, parsePayoffPriority } from '../../src/utils/priorityOrdering';

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

describe('collectPriorityItems', () => {
  it('collects only items that have a priority set, across all three sources', () => {
    const items = collectPriorityItems({
      handLoans: [{ _rowIndex: 0, payoffPriority: 2, name: 'Gold Loan' }, { _rowIndex: 1, payoffPriority: null, name: 'No Priority' }],
      emiLoans: [{ _rowIndex: 0, payoffPriority: 1, name: 'Car EMI' }],
      projects: [{ _rowIndex: 0, payoffPriority: 3, name: 'Construction' }],
    });
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.kind).sort()).toEqual(['emi', 'hand', 'project']);
  });

  it('returns an empty list when nothing has a priority', () => {
    expect(collectPriorityItems({ handLoans: [{ _rowIndex: 0, payoffPriority: null }] })).toEqual([]);
  });

  it('handles missing sources gracefully', () => {
    expect(collectPriorityItems({})).toEqual([]);
    expect(collectPriorityItems()).toEqual([]);
  });
});

describe('suggestNextPriority', () => {
  it('suggests one past the highest existing priority', () => {
    const items = collectPriorityItems({ handLoans: [{ _rowIndex: 0, payoffPriority: 5 }, { _rowIndex: 1, payoffPriority: 2 }] });
    expect(suggestNextPriority(items)).toBe(6);
  });

  it('suggests 1 when nothing has a priority yet', () => {
    expect(suggestNextPriority([])).toBe(1);
  });
});

describe('resolvePriorityShifts', () => {
  it('shifts every item at or above the new priority up by 1, leaving lower ones untouched', () => {
    const items = collectPriorityItems({
      handLoans: [{ _rowIndex: 0, payoffPriority: 1, name: 'A' }],
      emiLoans: [{ _rowIndex: 0, payoffPriority: 2, name: 'B' }],
      projects: [{ _rowIndex: 0, payoffPriority: 3, name: 'C' }],
    });
    // Inserting a new item at priority 1 should push A->2, B->3, C->4.
    const shifts = resolvePriorityShifts(items, 1, null);
    expect(shifts).toHaveLength(3);
    expect(shifts.find((s) => s.data.name === 'A').priority).toBe(2);
    expect(shifts.find((s) => s.data.name === 'B').priority).toBe(3);
    expect(shifts.find((s) => s.data.name === 'C').priority).toBe(4);
  });

  it('excludes the item being edited itself even if its own priority is at or above the new value', () => {
    const items = collectPriorityItems({
      handLoans: [{ _rowIndex: 0, payoffPriority: 1, name: 'A' }, { _rowIndex: 1, payoffPriority: 2, name: 'B' }],
    });
    // "A" is being edited to become priority 1 (unchanged) - it should not shift itself.
    const shifts = resolvePriorityShifts(items, 1, 'hand:0');
    expect(shifts.map((s) => s.data.name)).toEqual(['B']);
    expect(shifts[0].priority).toBe(3);
  });

  it('returns an empty list when the new priority is higher than everything else', () => {
    const items = collectPriorityItems({ handLoans: [{ _rowIndex: 0, payoffPriority: 1, name: 'A' }] });
    expect(resolvePriorityShifts(items, 5, null)).toEqual([]);
  });
});
