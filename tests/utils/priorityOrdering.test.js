import { describe, it, expect } from 'vitest';
import { collectPriorityItems, suggestNextPriority, resolvePriorityShifts } from '../../src/utils/priorityOrdering';

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
