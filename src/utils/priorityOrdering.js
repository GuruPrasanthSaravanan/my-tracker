/**
 * Payoff Priority is one shared ordering across three different tabs (Hand
 * Loans, EMI Loans, Projects) - see debtAvalancheProjection.js. Set via a
 * single reorderable list on the Projections page (PriorityOrderManager),
 * not typed as a number on each item's own form - the number itself is
 * just position-in-list + 1, an implementation detail the user never sees.
 * See bugs-and-lessons.md for why a typed-number UI (with auto-suggest and
 * auto-shift-on-collision) was replaced with this - it was hard to update
 * because the same shared ordering was scattered across three unrelated
 * forms on two different pages.
 */

/**
 * Parses a raw Payoff Priority cell value into a plain integer or null.
 * `readSheet` returns Google Sheets' *formatted* display value, not the
 * raw number - if this column ever inherits number/currency/percentage
 * formatting from an adjacent cell (a common Sheets quirk), a stored "1"
 * can come back as something like "₹1.00" or "1.00%", which `parseInt`
 * alone would silently turn into `NaN` (poisoning every sort/comparison
 * downstream) instead of a clean value.
 * Strips currency symbols/percent signs/thousands-separator commas but
 * keeps the decimal point (stripping *all* non-digits, including the
 * decimal point, would corrupt "₹1.00" into 100 instead of 1), then
 * rounds to the nearest integer.
 * @param {string|number|null|undefined} raw
 * @returns {number|null}
 */
export function parsePayoffPriority(raw) {
  if (raw == null || raw === '') return null;
  const cleaned = String(raw).replace(/,/g, '').replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : Math.round(parsed);
}

/**
 * Splits every currently-eligible Hand Loan/EMI Loan/Project into two
 * ordered lists for the Priority Order Manager: `included` (already has a
 * Payoff Priority, sorted by it ascending - the order the projection
 * currently uses) and `excluded` (no priority yet - not part of the
 * projection). Callers pass already-filtered "eligible" arrays (active
 * status, Owe-direction only for Hand Loans, etc.) - this function only
 * cares about grouping/ordering by priority, not eligibility rules.
 * @param {{ handLoans?: object[], emiLoans?: object[], projects?: object[] }} sources
 * @returns {{
 *   included: { kind: 'hand'|'emi'|'project', rowIndex: number, name: string, priority: number, data: object }[],
 *   excluded: { kind: 'hand'|'emi'|'project', rowIndex: number, name: string, priority: null, data: object }[],
 * }}
 */
export function buildPriorityOrderItems({ handLoans = [], emiLoans = [], projects = [] } = {}) {
  const items = [
    ...handLoans.map((l) => ({ kind: 'hand', rowIndex: l._rowIndex, name: l.name, priority: l.payoffPriority, data: l })),
    ...emiLoans.map((l) => ({ kind: 'emi', rowIndex: l._rowIndex, name: l.name, priority: l.payoffPriority, data: l })),
    ...projects.map((p) => ({ kind: 'project', rowIndex: p._rowIndex, name: p.name || p.code, priority: p.payoffPriority, data: p })),
  ];
  return {
    included: items.filter((i) => i.priority != null).sort((a, b) => a.priority - b.priority),
    excluded: items.filter((i) => i.priority == null),
  };
}

/**
 * Persists a full reordering: every item in `included` gets its Payoff
 * Priority set to its position (1-based), every item in `excluded` that
 * previously had one gets it cleared. Not a pure function (does real
 * writes) - deliberately kept separate from the pure functions above,
 * same distinction this app draws everywhere else between pure utils/*.js
 * and hook/page-level I/O.
 * @param {{ kind: string, rowIndex: number, priority: number|null, data: object }[]} included
 * @param {{ kind: string, rowIndex: number, priority: number|null, data: object }[]} excluded
 * @param {{ handLoans: object, emiLoans: object, projects: object }} hooks - the useAppData() hook objects
 */
export async function savePriorityOrder(included, excluded, { handLoans, emiLoans, projects }) {
  // Every write below passes skipRefresh - without it, each hook's own
  // editLoan/editProject triggers a full-tab refetch immediately, so
  // reordering N items would refetch N times in a row, each one causing
  // an intermediate re-render (visible as UI flicker) before things
  // settle. Doing all the writes first and refreshing once at the end
  // instead means exactly one re-render once everything is consistent.
  const writeOne = async (kind, rowIndex, data, priority) => {
    const entry = { ...data, payoffPriority: priority };
    if (kind === 'hand') await handLoans.editLoan(rowIndex, entry, { skipRefresh: true });
    else if (kind === 'emi') await emiLoans.editLoan(rowIndex, entry, { skipRefresh: true });
    else if (kind === 'project') await projects.editProject(rowIndex, entry, { skipRefresh: true });
  };
  for (const [index, item] of included.entries()) {
    await writeOne(item.kind, item.rowIndex, item.data, index + 1);
  }
  for (const item of excluded) {
    if (item.priority != null) await writeOne(item.kind, item.rowIndex, item.data, null);
  }
  await Promise.all([handLoans.refresh(), emiLoans.refresh(), projects.refresh()]);
}
