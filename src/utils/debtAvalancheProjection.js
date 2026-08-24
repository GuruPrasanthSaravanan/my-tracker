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
 * regardless of priority; only *extra* payment is priority-driven. A
 * Project whose remaining budget can't be met on-pace by its
 * `endDatePlanned` at its current priority position gets bumped ahead just
 * far enough to stay on pace (or to the very front if the deadline has
 * already passed) - Debts have no such deadline and never get this
 * override.
 */
import { computeSimpleInterestAccrued } from './loanCalculations';

function addMonths(dateStr, n) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + n);
  return d;
}

function monthsBetween(fromDate, toDateStr) {
  const to = new Date(toDateStr);
  return Math.max(0, (to.getFullYear() - fromDate.getFullYear()) * 12 + (to.getMonth() - fromDate.getMonth()));
}

/**
 * Resolves which order this month's extra-payment pool should cascade
 * through, applying the Project deadline override on top of the base
 * priority order. See the module docstring above for the rule.
 *
 * `poolSize` (this month's actual extra-payment pool) is required to
 * compute this correctly - a naive "does *anything* sit ahead of it"
 * check would trigger almost every month for almost any project (there's
 * nearly always *some* positive balance ahead of it in a multi-loan
 * priority list), yanking it to the very front and effectively ignoring
 * every lower-priority-number item's own priority. Instead, a project is
 * moved only as far forward as needed to guarantee `requiredThisMonth` is
 * still available to it after everything genuinely ahead of it (in pool
 * terms, not just position) has taken its share.
 */
function resolveEffectiveOrder(items, monthDate, poolSize) {
  const base = [...items].sort((a, b) => a.priority - b.priority);
  const projectsList = base.filter((it) => it.kind === 'project');
  if (projectsList.length === 0) return base;

  let effective = [...base];
  for (const proj of projectsList) {
    if (proj.remaining <= 0 || !proj.endDatePlanned) continue;
    const monthsUntilDeadline = monthsBetween(monthDate, proj.endDatePlanned);
    effective = effective.filter((it) => it !== proj);
    if (monthsUntilDeadline <= 0) {
      // Deadline missed or due now - maximally urgent, no computation needed.
      effective = [proj, ...effective];
      continue;
    }
    const requiredThisMonth = proj.remaining / monthsUntilDeadline;
    // Walk the current order, accumulating how much each item ahead would
    // actually consume from the pool - insert the project right before
    // the first item whose cumulative consumption would leave less than
    // `requiredThisMonth` remaining for it. Items with a smaller need than
    // the room available stay ahead of the project untouched.
    const budget = Math.max(0, poolSize - requiredThisMonth);
    let cumulative = 0;
    let insertAt = effective.length;
    for (let idx = 0; idx < effective.length; idx++) {
      const need = (effective[idx].remaining || 0) + (effective[idx].accruedInterest || 0);
      if (cumulative + need > budget) {
        insertAt = idx;
        break;
      }
      cumulative += need;
    }
    effective.splice(insertAt, 0, proj);
  }
  return effective;
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
 * @param {string} inputs.startDate - ISO date, month 1 of the simulation
 * @param {number} [inputs.maxMonths] - safety cap (default 120), same pattern as projectCreditCardPayoff
 * @returns {{
 *   months: { date: string, extraPaymentApplied: Object<string, number>, remaining: Object<string, number> }[],
 *   milestones: { itemName: string, clearedMonth: number, clearedDate: string }[],
 *   allClearMonth: number|null,
 *   neverCompletes: boolean,
 * }}
 */
export function projectPayoffPlan({ handLoans = [], emiLoans = [], projects = [], activeChits = [], monthlySurplus, startingLumpSum = 0, startDate, maxMonths = 120 }) {
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
    // regardless of priority.
    for (const e of emis) {
      if (e.remaining <= 0) continue;
      const payment = Math.min(e.emi, e.remaining);
      e.remaining -= payment;
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
    const extraPool = { value: monthlySurplus + freedEMIPool + freedChitPool + (m === 1 ? startingLumpSum : 0) };

    // 4. Resolve effective order for this month (deadline override for Projects).
    const items = [...debts, ...projs, ...emis].filter(
      (it) => it.remaining > 0 || (it.kind === 'hand' && it.accruedInterest > 0)
    );
    const order = resolveEffectiveOrder(items, monthDate, extraPool.value);

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
