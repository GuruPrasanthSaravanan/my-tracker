/**
 * Simulates month-by-month payoff of every Payoff-Priority-tagged Hand
 * Loan, EMI Loan, and Project under a flat, user-declared monthly surplus -
 * a deterministic what-if schedule, not a prediction of an uncertain
 * external event (same category as loanCalculations.js's
 * buildAmortizationSchedule/projectCreditCardPayoff). See
 * docs/superpowers/specs/2026-08-22-debt-avalanche-projection-design.md.
 *
 * Ordering: one combined list of every item, sorted by `priority` ascending
 * (lower = attacked/funded first) - NOT "all Projects first, then all
 * Debts". EMI installments pay their normal schedule every month
 * regardless of priority; only *extra* payment is priority-driven.
 *
 * A Project's `endDatePlanned` is passed through and still shown elsewhere
 * in the app, but is deliberately NOT used to reorder the cascade here -
 * an earlier version bumped a Project ahead of lower-priority-number items
 * when its deadline was tight, but that made the resulting order diverge
 * from the priority numbers the user actually set, which was more
 * confusing than useful (see bugs-and-lessons.md for the removal). The
 * order shown always matches Payoff Priority, full stop.
 */
import { computeSimpleInterestAccrued } from './loanCalculations';

function addMonths(dateStr, n) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + n);
  return d;
}

/** Whole months between two dates, clamped to >= 0 (a date in the past counts as "this month"). */
function monthsFromStart(startDate, targetDate) {
  const start = new Date(startDate);
  const target = new Date(targetDate);
  return Math.max(0, (target.getFullYear() - start.getFullYear()) * 12 + (target.getMonth() - start.getMonth()));
}

/**
 * @param {Object} inputs
 * @param {{ name: string, priority: number, outstandingPrincipal: number, accruedInterestSoFar: number, annualRate: number }[]} inputs.handLoans
 * @param {{ name: string, priority: number, outstandingBalance: number, annualRate: number, emi: number, remainingMonths: number }[]} inputs.emiLoans
 * @param {{ name: string, priority: number, remainingBudget: number, endDatePlanned: string|null }[]} inputs.projects
 * @param {{ name: string, monthlyContribution: number, monthsRemaining: number }[]} [inputs.activeChits] - Chit
 *   Funds still paying a monthly contribution. `monthsRemaining` is the number of contributions left
 *   *as of today* (e.g. from `computeChitFundStatus`) - once that many simulated months pass, the
 *   contribution stops and that amount joins the surplus pool, same as a completed EMI. This is
 *   deliberately the only Chit Fund effect modeled - the contribution end date is a known, fixed
 *   fact (duration is set upfront), unlike winning/maturity timing and payout amount, which this
 *   engine never simulates (real auction outcomes aren't predictable - see bugs-and-lessons.md §20).
 *   Chits don't participate in the priority-ordered payoff themselves, only in freeing up surplus.
 * @param {number} inputs.monthlySurplus - flat amount available for extra payments every month
 * @param {number} [inputs.startingLumpSum] - one-time amount added to *month 1 only* (default 0) -
 *   e.g. current account balances above each account's own Min Balance buffer (see
 *   computeUpcomingEMIFundingWarnings' identical `balance - minBalance` pattern) - cash already
 *   sitting there today that isn't earmarked for anything else, distinct from `monthlySurplus`
 *   (which recurs every month and is never double-counted with this).
 * @param {{ name: string, amount: number, dueDate: string }[]} [inputs.oneTimeExpenses] - known,
 *   already-committed future outflows with a real due date (e.g. an unpaid Credit Card bill's
 *   remaining balance) - reduces the extra-payment pool for whichever simulated month `dueDate`
 *   falls into (a date in the past/this month counts as month 1), floored at 0 for that month
 *   (never carries a negative balance into other months' pools). Deliberately just a pool
 *   reduction, not a priority-ordered item and not a reordering trigger - see the module
 *   docstring above for why deadline-driven reordering was removed entirely (bugs-and-lessons.md
 *   §54); a one-time expense reducing the pool doesn't have that problem since it never changes
 *   *which* priority-tagged item gets funded first, only *how much* is available that month.
 * @param {string} inputs.startDate - ISO date, month 1 of the simulation
 * @param {number} [inputs.maxMonths] - safety cap (default 120), same pattern as projectCreditCardPayoff
 * @returns {{
 *   months: { date: string, extraPaymentApplied: Object<string, number>, remaining: Object<string, number> }[],
 *   milestones: { itemName: string, clearedMonth: number, clearedDate: string }[],
 *   allClearMonth: number|null,
 *   neverCompletes: boolean,
 * }}
 */
export function projectPayoffPlan({ handLoans = [], emiLoans = [], projects = [], activeChits = [], oneTimeExpenses = [], monthlySurplus, startingLumpSum = 0, startDate, maxMonths = 120 }) {
  // Working copies - never mutate the caller's input objects.
  const debts = handLoans
    .filter((l) => l.priority != null)
    .map((l) => ({ ...l, kind: 'hand', remaining: l.outstandingPrincipal, accruedInterest: l.accruedInterestSoFar || 0 }));
  const emis = emiLoans
    .filter((l) => l.priority != null)
    .map((l) => ({ ...l, kind: 'emi', remaining: l.outstandingBalance, freedThisSim: false, freedMonth: null }));
  const projs = projects
    .filter((p) => p.priority != null)
    .map((p) => ({ ...p, kind: 'project', remaining: p.remainingBudget }));
  const chits = activeChits.map((c) => ({ ...c }));

  const months = [];
  const milestones = [];
  let freedEMIPool = 0;

  for (let m = 1; m <= maxMonths; m++) {
    const monthDate = addMonths(startDate, m - 1);
    const extraApplied = {};

    // 1. Fixed EMI installments - every EMI loan pays its normal schedule
    // regardless of priority. Reducing-balance amortization, same formula
    // as loanCalculations.js's buildAmortizationSchedule (which this
    // engine doesn't reuse directly since it needs to track a live,
    // mutating `remaining` alongside extra/priority-driven payments) -
    // each EMI splits into interest (on the *current* balance) and
    // principal; only the principal portion reduces the balance. An
    // earlier version of this loop subtracted the whole EMI as if it were
    // 100% principal, which cleared every EMI loan unrealistically fast
    // (understating how much of each payment is actually interest,
    // especially early in a loan's tenure) - see bugs-and-lessons.md.
    for (const e of emis) {
      if (e.remaining <= 0) continue;
      const monthlyRate = (e.annualRate || 0) / 12 / 100;
      const interest = e.remaining * monthlyRate;
      const principalComponent = Math.min(Math.max(e.emi - interest, 0), e.remaining);
      e.remaining -= principalComponent;
      if (e.remaining <= 0 && !e.freedThisSim) {
        e.freedThisSim = true;
        e.freedMonth = m;
        milestones.push({ itemName: e.name, clearedMonth: m, clearedDate: monthDate.toISOString().slice(0, 10) });
      }
    }

    // 2. Hand loan interest accrual (simple interest, one month).
    for (const d of debts) {
      if (d.remaining <= 0) continue;
      d.accruedInterest += computeSimpleInterestAccrued(d.remaining, d.annualRate, addMonths(startDate, m - 1), addMonths(startDate, m));
    }

    // 3. This month's extra-payment pool - freed EMI installments join
    // starting the month *after* they completed; a Chit's contribution
    // joins once its (already-known) remaining-months count has elapsed.
    freedEMIPool = emis
      .filter((e) => e.freedMonth != null && e.freedMonth < m)
      .reduce((sum, e) => sum + e.emi, 0);
    const freedChitPool = chits
      .filter((c) => c.monthsRemaining != null && m > c.monthsRemaining)
      .reduce((sum, c) => sum + (c.monthlyContribution || 0), 0);
    const oneTimeExpenseThisMonth = oneTimeExpenses
      .filter((e) => monthsFromStart(startDate, e.dueDate) + 1 === m)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const extraPool = {
      value: Math.max(0, monthlySurplus + freedEMIPool + freedChitPool + (m === 1 ? startingLumpSum : 0) - oneTimeExpenseThisMonth),
    };

    // 4. Strict priority order - lower priority number first, full stop.
    // No deadline-based reordering (see module docstring above for why).
    const order = [...debts, ...projs, ...emis]
      .filter((it) => it.remaining > 0 || (it.kind === 'hand' && it.accruedInterest > 0))
      .sort((a, b) => a.priority - b.priority);

    // 5. Cascade the extra payment down the effective order.
    for (const item of order) {
      if (extraPool.value <= 0) break;
      if (item.kind === 'hand') {
        const owed = item.accruedInterest + item.remaining;
        if (owed <= 0) continue;
        const applied = Math.min(extraPool.value, owed);
        const interestPortion = Math.min(applied, item.accruedInterest);
        item.accruedInterest -= interestPortion;
        item.remaining -= (applied - interestPortion);
        extraPool.value -= applied;
        extraApplied[item.name] = (extraApplied[item.name] || 0) + applied;
        if (item.remaining <= 0 && item.accruedInterest <= 0) {
          milestones.push({ itemName: item.name, clearedMonth: m, clearedDate: monthDate.toISOString().slice(0, 10) });
        }
      } else if (item.kind === 'project') {
        if (item.remaining <= 0) continue;
        const applied = Math.min(extraPool.value, item.remaining);
        item.remaining -= applied;
        extraPool.value -= applied;
        extraApplied[item.name] = (extraApplied[item.name] || 0) + applied;
        if (item.remaining <= 0) {
          milestones.push({ itemName: item.name, clearedMonth: m, clearedDate: monthDate.toISOString().slice(0, 10) });
        }
      } else if (item.kind === 'emi') {
        // Only reachable once every Hand Loan/Project ahead of it is clear -
        // extra payment here is a prepayment reducing balance directly.
        if (item.remaining <= 0) continue;
        const applied = Math.min(extraPool.value, item.remaining);
        item.remaining -= applied;
        extraPool.value -= applied;
        extraApplied[item.name] = (extraApplied[item.name] || 0) + applied;
        if (item.remaining <= 0 && !item.freedThisSim) {
          item.freedThisSim = true;
          item.freedMonth = m;
          milestones.push({ itemName: item.name, clearedMonth: m, clearedDate: monthDate.toISOString().slice(0, 10) });
        }
      }
    }

    const remaining = {};
    for (const d of debts) remaining[d.name] = Math.max(0, d.remaining + d.accruedInterest);
    for (const p of projs) remaining[p.name] = Math.max(0, p.remaining);
    for (const e of emis) remaining[e.name] = Math.max(0, e.remaining);

    months.push({ date: monthDate.toISOString().slice(0, 10), extraPaymentApplied: extraApplied, remaining });

    const allClear = debts.every((d) => d.remaining <= 0 && d.accruedInterest <= 0)
      && projs.every((p) => p.remaining <= 0)
      && emis.every((e) => e.remaining <= 0);
    if (allClear) {
      return { months, milestones, allClearMonth: m, neverCompletes: false };
    }
  }

  return { months, milestones, allClearMonth: null, neverCompletes: true };
}
