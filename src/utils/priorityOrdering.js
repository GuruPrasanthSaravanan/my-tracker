/**
 * Payoff Priority is one shared ordering across three different tabs (Hand
 * Loans, EMI Loans, Projects) - see debtAvalancheProjection.js. These
 * helpers keep that shared numbering easy to work with from any of the
 * three pages that let a user set/change it (ObligationsPage.jsx for Hand
 * Loans/EMI Loans, ProjectsPage.jsx for Projects), without duplicating the
 * "collect everything with a priority" logic three times.
 */

/**
 * Builds one combined, unique-keyed list of every item that currently has
 * a Payoff Priority set, across all three sources.
 * @param {{ handLoans?: object[], emiLoans?: object[], projects?: object[] }} sources
 * @returns {{ kind: 'hand'|'emi'|'project', key: string, rowIndex: number, priority: number, data: object }[]}
 */
export function collectPriorityItems({ handLoans = [], emiLoans = [], projects = [] } = {}) {
  const items = [];
  for (const l of handLoans) {
    if (l.payoffPriority != null) {
      items.push({ kind: 'hand', key: `hand:${l._rowIndex}`, rowIndex: l._rowIndex, priority: l.payoffPriority, data: l });
    }
  }
  for (const l of emiLoans) {
    if (l.payoffPriority != null) {
      items.push({ kind: 'emi', key: `emi:${l._rowIndex}`, rowIndex: l._rowIndex, priority: l.payoffPriority, data: l });
    }
  }
  for (const p of projects) {
    if (p.payoffPriority != null) {
      items.push({ kind: 'project', key: `project:${p._rowIndex}`, rowIndex: p._rowIndex, priority: p.payoffPriority, data: p });
    }
  }
  return items;
}

/**
 * The next unassigned priority number - one past the highest currently in
 * use across every item (Hand Loan, EMI Loan, or Project) that has one,
 * or 1 if nothing does yet. Used to default a new item's Payoff Priority
 * field instead of leaving it blank.
 * @param {{ priority: number }[]} items - from collectPriorityItems
 */
export function suggestNextPriority(items) {
  if (items.length === 0) return 1;
  return Math.max(...items.map((i) => i.priority)) + 1;
}

/**
 * Given the full set of priority items and a newly-chosen priority for one
 * of them (identified by `excludeKey` - its own key if it already had a
 * priority, or null for a brand-new item), returns every *other* item that
 * needs to shift up by 1 to make room, so two items never end up sharing
 * the same priority. A single uniform +1 shift across everything at or
 * above the new value is sufficient in one pass - it can't introduce a new
 * collision, since every one of those items moves together and their
 * relative order/uniqueness is preserved.
 * @param {{ key: string, priority: number }[]} items - from collectPriorityItems
 * @param {number} newPriority
 * @param {string|null} excludeKey
 * @returns {{ kind: string, key: string, rowIndex: number, priority: number, data: object }[]} items needing an update, with their new (shifted) priority
 */
export function resolvePriorityShifts(items, newPriority, excludeKey) {
  return items
    .filter((i) => i.key !== excludeKey && i.priority >= newPriority)
    .map((i) => ({ ...i, priority: i.priority + 1 }));
}

/**
 * Applies a set of priority shifts (from resolvePriorityShifts) by calling
 * the appropriate hook's edit function for each affected item's kind.
 * Not a pure function (does real writes) - deliberately kept out of the
 * pure-function unit tests above, same distinction this app draws
 * everywhere else between pure utils/*.js and hook/page-level I/O.
 * @param {{kind: string, rowIndex: number, priority: number, data: object}[]} shifts
 * @param {{ handLoans: object, emiLoans: object, projects: object }} hooks - the useAppData() hook objects
 */
export async function applyPriorityShifts(shifts, { handLoans, emiLoans, projects }) {
  for (const s of shifts) {
    if (s.kind === 'hand') {
      await handLoans.editLoan(s.rowIndex, { ...s.data, payoffPriority: s.priority });
    } else if (s.kind === 'emi') {
      await emiLoans.editLoan(s.rowIndex, { ...s.data, payoffPriority: s.priority });
    } else if (s.kind === 'project') {
      await projects.editProject(s.rowIndex, { ...s.data, payoffPriority: s.priority });
    }
  }
}
