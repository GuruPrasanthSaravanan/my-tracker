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

  it('accelerates a Project ahead of a lower-priority-number item to hit its own deadline', () => {
    const result = projectPayoffPlan({
      handLoans: [{ name: 'Slow Loan', priority: 2, outstandingPrincipal: 100000, accruedInterestSoFar: 0, annualRate: 0 }],
      emiLoans: [],
      projects: [{ name: 'Urgent Reno', priority: 3, remainingBudget: 10000, endDatePlanned: '2026-02-01' }],
      monthlySurplus: 5000, startDate: '2026-01-01', maxMonths: 6,
    });
    // Urgent Reno's deadline is 1 month out - it must be funded before Slow Loan despite lower priority number.
    expect(result.months[0].extraPaymentApplied['Urgent Reno']).toBeGreaterThan(0);
  });

  it('treats a Project with an already-passed deadline as maximally urgent', () => {
    const result = projectPayoffPlan({
      handLoans: [{ name: 'Some Loan', priority: 1, outstandingPrincipal: 100000, accruedInterestSoFar: 0, annualRate: 0 }],
      emiLoans: [],
      projects: [{ name: 'Overdue Project', priority: 5, remainingBudget: 2000, endDatePlanned: '2020-01-01' }],
      monthlySurplus: 5000, startDate: '2026-01-01', maxMonths: 3,
    });
    expect(result.months[0].extraPaymentApplied['Overdue Project']).toBe(2000);
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

  it('returns an inert result when nothing has a priority set', () => {
    const result = projectPayoffPlan({
      handLoans: [{ name: 'No Priority Loan', priority: null, outstandingPrincipal: 1000, accruedInterestSoFar: 0, annualRate: 0 }],
      emiLoans: [], projects: [], monthlySurplus: 5000, startDate: '2026-01-01', maxMonths: 3,
    });
    expect(result.milestones).toEqual([]);
    expect(result.allClearMonth).toBe(1); // nothing to clear, so "all clear" immediately
  });
});
