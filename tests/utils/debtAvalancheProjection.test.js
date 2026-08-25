import { describe, it, expect } from 'vitest';
import { projectPayoffPlan } from '../../src/utils/debtAvalancheProjection';

describe('projectPayoffPlan', () => {
  it('pays off a single Hand Loan using the flat monthly surplus, interest then principal', () => {
    const result = projectPayoffPlan({
      handLoans: [{ name: 'Friend Loan', priority: 1, outstandingPrincipal: 10000, accruedInterestSoFar: 0, annualRate: 12 }],
      emiLoans: [],
      projects: [],
      monthlySurplus: 5000,
      startDate: '2026-01-01',
      maxMonths: 12,
    });
    expect(result.neverCompletes).toBe(false);
    expect(result.milestones).toEqual([
      { itemName: 'Friend Loan', clearedMonth: expect.any(Number), clearedDate: expect.any(String) },
    ]);
    expect(result.allClearMonth).toBe(result.milestones[0].clearedMonth);
  });

  it('cascades to the next-priority Hand Loan once the first is cleared in the same month', () => {
    const result = projectPayoffPlan({
      handLoans: [
        { name: 'Small Loan', priority: 1, outstandingPrincipal: 1000, accruedInterestSoFar: 0, annualRate: 0 },
        { name: 'Big Loan', priority: 2, outstandingPrincipal: 50000, accruedInterestSoFar: 0, annualRate: 0 },
      ],
      emiLoans: [], projects: [], monthlySurplus: 5000, startDate: '2026-01-01', maxMonths: 24,
    });
    const smallCleared = result.milestones.find((m) => m.itemName === 'Small Loan');
    expect(smallCleared.clearedMonth).toBe(1);
    expect(result.months[0].extraPaymentApplied['Big Loan']).toBeCloseTo(4000, 0);
  });

  it("frees an EMI loan's installment into the surplus pool the month after it completes", () => {
    const result = projectPayoffPlan({
      handLoans: [{ name: 'Gold Loan', priority: 2, outstandingPrincipal: 100000, accruedInterestSoFar: 0, annualRate: 0 }],
      emiLoans: [{ name: 'Small EMI', priority: 1, outstandingBalance: 3000, annualRate: 0, emi: 3000, remainingMonths: 1 }],
      projects: [], monthlySurplus: 5000, startDate: '2026-01-01', maxMonths: 24,
    });
    // Month 1: EMI pays itself off (3000), Gold Loan gets the full 5000 surplus (EMI not freed until month 2).
    expect(result.months[0].extraPaymentApplied['Gold Loan']).toBeCloseTo(5000, 0);
    // Month 2: surplus pool is now 5000 + 3000 freed = 8000, all to Gold Loan.
    expect(result.months[1].extraPaymentApplied['Gold Loan']).toBeCloseTo(8000, 0);
  });

  it('never lets a Project jump ahead of a lower-priority-number item, even with an urgent/passed deadline', () => {
    // Regression test for the opposite of the old behavior: endDatePlanned
    // must NOT reorder the cascade - Payoff Priority is the only thing
    // that determines order, full stop (see bugs-and-lessons.md for why
    // the earlier deadline-override was removed).
    const result = projectPayoffPlan({
      handLoans: [{ name: 'Slow Loan', priority: 1, outstandingPrincipal: 100000, accruedInterestSoFar: 0, annualRate: 0 }],
      emiLoans: [],
      projects: [{ name: 'Overdue Project', priority: 2, remainingBudget: 2000, endDatePlanned: '2020-01-01' }],
      monthlySurplus: 5000, startDate: '2026-01-01', maxMonths: 3,
    });
    // Slow Loan (priority 1) takes the full pool first, regardless of the Project's already-passed deadline.
    expect(result.months[0].extraPaymentApplied['Slow Loan']).toBeCloseTo(5000, 0);
    expect(result.months[0].extraPaymentApplied['Overdue Project']).toBeUndefined();
  });

  it('funds a Project once its own priority position is reached, in the same pass as everything else', () => {
    const result = projectPayoffPlan({
      handLoans: [{ name: 'Tiny Loan', priority: 1, outstandingPrincipal: 1000, accruedInterestSoFar: 0, annualRate: 0 }],
      emiLoans: [],
      projects: [{ name: 'Reno', priority: 2, remainingBudget: 3000, endDatePlanned: '2026-02-01' }],
      monthlySurplus: 5000, startDate: '2026-01-01', maxMonths: 3,
    });
    // Tiny Loan clears first (1000), leaving 4000 of the pool for Reno.
    expect(result.months[0].extraPaymentApplied['Tiny Loan']).toBe(1000);
    expect(result.months[0].extraPaymentApplied['Reno']).toBeCloseTo(3000, 0);
  });

  it('flags neverCompletes when surplus cannot clear everything within maxMonths', () => {
    const result = projectPayoffPlan({
      handLoans: [{ name: 'Huge Loan', priority: 1, outstandingPrincipal: 10000000, accruedInterestSoFar: 0, annualRate: 12 }],
      emiLoans: [], projects: [], monthlySurplus: 100, startDate: '2026-01-01', maxMonths: 6,
    });
    expect(result.neverCompletes).toBe(true);
    expect(result.allClearMonth).toBeNull();
  });

  it('only includes Hand Loans actually passed in (caller is responsible for excluding Lend-direction ones)', () => {
    const result = projectPayoffPlan({
      handLoans: [{ name: 'Owe Loan', priority: 1, outstandingPrincipal: 1000, accruedInterestSoFar: 0, annualRate: 0 }],
      emiLoans: [], projects: [], monthlySurplus: 5000, startDate: '2026-01-01', maxMonths: 3,
    });
    expect(result.milestones.map((m) => m.itemName)).toEqual(['Owe Loan']);
  });

  it("frees a Chit Fund's monthly contribution into the surplus pool once its known remaining months elapse", () => {
    const result = projectPayoffPlan({
      handLoans: [{ name: 'Gold Loan', priority: 1, outstandingPrincipal: 100000, accruedInterestSoFar: 0, annualRate: 0 }],
      emiLoans: [], projects: [],
      activeChits: [{ name: 'Family Chit', monthlyContribution: 2000, monthsRemaining: 1 }],
      monthlySurplus: 5000, startDate: '2026-01-01', maxMonths: 4,
    });
    // Month 1: still 1 contribution left (monthsRemaining=1), not freed yet.
    expect(result.months[0].extraPaymentApplied['Gold Loan']).toBeCloseTo(5000, 0);
    // Month 2 onward: contribution has ended, +2000 joins the pool.
    expect(result.months[1].extraPaymentApplied['Gold Loan']).toBeCloseTo(7000, 0);
  });

  it('never uses a Chit Fund to fund anything before its contribution actually ends (already-complete chit frees immediately)', () => {
    const result = projectPayoffPlan({
      handLoans: [{ name: 'Gold Loan', priority: 1, outstandingPrincipal: 100000, accruedInterestSoFar: 0, annualRate: 0 }],
      emiLoans: [], projects: [],
      activeChits: [{ name: 'Finished Chit', monthlyContribution: 3000, monthsRemaining: 0 }],
      monthlySurplus: 5000, startDate: '2026-01-01', maxMonths: 2,
    });
    expect(result.months[0].extraPaymentApplied['Gold Loan']).toBeCloseTo(8000, 0);
  });

  it('adds an optional starting lump sum to month 1 only, not to later months', () => {
    const result = projectPayoffPlan({
      handLoans: [{ name: 'Gold Loan', priority: 1, outstandingPrincipal: 100000, accruedInterestSoFar: 0, annualRate: 0 }],
      emiLoans: [], projects: [],
      monthlySurplus: 5000, startingLumpSum: 20000, startDate: '2026-01-01', maxMonths: 6,
    });
    expect(result.months[0].extraPaymentApplied['Gold Loan']).toBeCloseTo(25000, 0); // 5000 surplus + 20000 lump sum
    expect(result.months[1].extraPaymentApplied['Gold Loan']).toBeCloseTo(5000, 0); // lump sum doesn't repeat
  });

  it('reduces the pool in the specific month a one-time expense (e.g. an unpaid Credit Card bill) is due', () => {
    const result = projectPayoffPlan({
      handLoans: [{ name: 'Gold Loan', priority: 1, outstandingPrincipal: 100000, accruedInterestSoFar: 0, annualRate: 0 }],
      emiLoans: [], projects: [],
      oneTimeExpenses: [{ name: 'ICICI Card Bill', amount: 3000, dueDate: '2026-02-15' }],
      monthlySurplus: 5000, startDate: '2026-01-01', maxMonths: 4,
    });
    // Month 1 (Jan): due date (Feb) hasn't arrived yet - full pool available.
    expect(result.months[0].extraPaymentApplied['Gold Loan']).toBeCloseTo(5000, 0);
    // Month 2 (Feb): the bill's due month - pool reduced by its amount.
    expect(result.months[1].extraPaymentApplied['Gold Loan']).toBeCloseTo(2000, 0);
    // Month 3 (Mar): back to the full pool, not repeated.
    expect(result.months[2].extraPaymentApplied['Gold Loan']).toBeCloseTo(5000, 0);
  });

  it('treats an already-overdue one-time expense as due this month (month 1), and never lets the pool go negative', () => {
    const result = projectPayoffPlan({
      handLoans: [{ name: 'Gold Loan', priority: 1, outstandingPrincipal: 100000, accruedInterestSoFar: 0, annualRate: 0 }],
      emiLoans: [], projects: [],
      oneTimeExpenses: [{ name: 'Overdue Card Bill', amount: 9000, dueDate: '2020-01-01' }],
      monthlySurplus: 5000, startDate: '2026-01-01', maxMonths: 2,
    });
    // Expense (9000) exceeds the whole month's surplus (5000) - nothing left for Gold Loan, not a negative pool.
    expect(result.months[0].extraPaymentApplied['Gold Loan']).toBeUndefined();
  });

  it('returns an inert result when nothing has a priority set', () => {
    const result = projectPayoffPlan({
      handLoans: [{ name: 'No Priority Loan', priority: null, outstandingPrincipal: 1000, accruedInterestSoFar: 0, annualRate: 0 }],
      emiLoans: [], projects: [], monthlySurplus: 5000, startDate: '2026-01-01', maxMonths: 3,
    });
    expect(result.milestones).toEqual([]);
    expect(result.allClearMonth).toBe(1); // nothing to clear, so "all clear" immediately
  });
});
