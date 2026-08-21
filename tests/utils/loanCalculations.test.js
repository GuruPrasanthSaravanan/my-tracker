import { describe, it, expect } from 'vitest';
import {
  calculateEMI,
  buildAmortizationSchedule,
  computeEMIStatus,
  countElapsedInstallments,
  computeSimpleInterestAccrued,
  splitPayment,
  presentValueOfAnnuity,
  computeMinimumDue,
  projectCreditCardPayoff,
  computeCreditCardInterestState,
} from '../../src/utils/loanCalculations';

describe('calculateEMI', () => {
  it('calculates the standard reducing-balance EMI amount', () => {
    // Well-known reference: 1,00,000 @ 12% annual for 12 months ~ 8884.88
    const emi = calculateEMI(100000, 12, 12);
    expect(emi).toBeCloseTo(8884.88, 1);
  });

  it('returns principal/tenure for a 0% interest loan (no interest component)', () => {
    const emi = calculateEMI(120000, 0, 12);
    expect(emi).toBeCloseTo(10000, 2);
  });
});

describe('buildAmortizationSchedule', () => {
  it('splits each installment into interest and principal, decreasing balance to zero', () => {
    const schedule = buildAmortizationSchedule(100000, 12, 12);
    expect(schedule).toHaveLength(12);

    // First month: interest = balance * monthlyRate = 100000 * 0.01 = 1000
    expect(schedule[0].interest).toBeCloseTo(1000, 1);
    expect(schedule[0].principal).toBeCloseTo(schedule[0].emi - 1000, 1);

    // Interest decreases and principal increases over time (front-loaded interest)
    expect(schedule[11].interest).toBeLessThan(schedule[0].interest);
    expect(schedule[11].principal).toBeGreaterThan(schedule[0].principal);

    // Final balance should be (approximately) zero
    expect(schedule[11].balance).toBeCloseTo(0, 1);

    // Total interest = n*EMI - P
    const totalInterest = schedule.reduce((sum, row) => sum + row.interest, 0);
    const totalPaid = schedule.reduce((sum, row) => sum + row.emi, 0);
    expect(totalInterest).toBeCloseTo(totalPaid - 100000, 1);
  });
});

describe('buildAmortizationSchedule with prepayments', () => {
  it('pays off the loan earlier than the original tenure when a part-payment is made', () => {
    const normal = buildAmortizationSchedule(100000, 12, 12);
    const withExtra = buildAmortizationSchedule(100000, 12, 12, { 3: 30000 });

    expect(withExtra.length).toBeLessThan(normal.length);
    expect(withExtra[2].extraPayment).toBe(30000);
    expect(withExtra[withExtra.length - 1].balance).toBeCloseTo(0, 1);

    // Total interest paid should be less than without the prepayment.
    const totalInterestNormal = normal.reduce((s, r) => s + r.interest, 0);
    const totalInterestExtra = withExtra.reduce((s, r) => s + r.interest, 0);
    expect(totalInterestExtra).toBeLessThan(totalInterestNormal);
  });
});

describe('buildAmortizationSchedule with an actual EMI override', () => {
  it('uses the provided actual EMI amount instead of the calculated one', () => {
    const calculated = calculateEMI(100000, 12, 12);
    const actualEMI = Math.round(calculated / 100) * 100; // bank-rounded to nearest 100
    const schedule = buildAmortizationSchedule(100000, 12, 12, {}, actualEMI);

    expect(schedule[0].emi).toBe(actualEMI);
    expect(schedule[schedule.length - 1].balance).toBeCloseTo(0, 1);
  });
});

describe('countElapsedInstallments', () => {
  it('matches plain calendar-month counting when no emiDate is given (uses start day)', () => {
    // Start and asOf both on the 1st - no partial-month ambiguity.
    expect(countElapsedInstallments('2026-01-01', '2026-04-01')).toBe(3);
  });

  it('does not count the current month until the EMI date has passed', () => {
    // Loan taken Jan 28, EMI debited on the 5th of each month.
    // By Feb 3, the Feb 5th EMI hasn't happened yet.
    expect(countElapsedInstallments('2026-01-28', '2026-02-03', 5)).toBe(0);
    // By Feb 10, it has.
    expect(countElapsedInstallments('2026-01-28', '2026-02-10', 5)).toBe(1);
  });

  it('never returns a negative count', () => {
    expect(countElapsedInstallments('2026-06-01', '2026-01-01')).toBe(0);
  });
});

describe('computeEMIStatus', () => {
  it('computes elapsed installments, outstanding balance, and totals as of a given date', () => {
    const status = computeEMIStatus({
      principal: 100000,
      annualRate: 12,
      tenureMonths: 12,
      startDate: '2026-01-01',
    }, '2026-04-01'); // 3 months elapsed

    expect(status.installmentsPaid).toBe(3);
    expect(status.totalInterestPaid).toBeGreaterThan(0);
    expect(status.totalPrincipalPaid).toBeGreaterThan(0);
    expect(status.outstandingBalance).toBeLessThan(100000);
    expect(status.outstandingBalance).toBeGreaterThan(0);
  });

  it('caps installments at the tenure when past the loan end date', () => {
    const status = computeEMIStatus({
      principal: 100000,
      annualRate: 12,
      tenureMonths: 12,
      startDate: '2026-01-01',
    }, '2028-01-01'); // way past the 12-month tenure

    expect(status.installmentsPaid).toBe(12);
    expect(status.outstandingBalance).toBeCloseTo(0, 1);
  });

  it('computes a next due date and reflects part-payments shortening the effective tenure', () => {
    const status = computeEMIStatus({
      principal: 100000,
      annualRate: 12,
      tenureMonths: 12,
      startDate: '2026-01-01',
    }, '2026-04-01', [{ date: '2026-02-15', amount: 30000 }]);

    expect(status.effectiveTenureMonths).toBeLessThan(status.originalTenureMonths);
    expect(status.totalExtraPaid).toBe(30000);
    expect(status.nextDueDate).toBe('2026-04-01');
  });

  it('uses the emiDate to avoid over-counting installments near month boundaries', () => {
    // Loan taken Jan 28, EMI debited on the 5th - as of Feb 3 the first EMI hasn't hit yet.
    const status = computeEMIStatus({
      principal: 100000,
      annualRate: 12,
      tenureMonths: 12,
      startDate: '2026-01-28',
      emiDate: 5,
    }, '2026-02-03');

    expect(status.installmentsPaid).toBe(0);
    expect(status.outstandingBalance).toBe(100000);
  });

  it('uses actualEMI to report the bank-billed amount instead of the theoretical one', () => {
    const status = computeEMIStatus({
      principal: 100000,
      annualRate: 12,
      tenureMonths: 12,
      startDate: '2026-01-01',
      actualEMI: 9000,
    }, '2026-04-01');

    expect(status.emi).toBe(9000);
  });
});

describe('computeSimpleInterestAccrued', () => {
  it('calculates simple interest for a full year at the given annual rate', () => {
    const interest = computeSimpleInterestAccrued(100000, 9, '2026-01-01', '2027-01-01');
    // 100000 * 0.09 * (365/365) = 9000
    expect(interest).toBeCloseTo(9000, 0);
  });

  it('returns 0 interest for a 0% rate loan', () => {
    const interest = computeSimpleInterestAccrued(300000, 0, '2026-01-01', '2027-01-01');
    expect(interest).toBe(0);
  });

  it('pro-rates interest for a partial period', () => {
    // 182 days at 10% on 100000: 100000 * 0.10 * (182/365)
    const interest = computeSimpleInterestAccrued(100000, 10, '2026-01-01', '2026-07-02');
    expect(interest).toBeCloseTo(100000 * 0.1 * (182 / 365), 2);
  });
});

describe('presentValueOfAnnuity', () => {
  it('back-solves a principal that is self-consistent with calculateEMI', () => {
    const emi = calculateEMI(100000, 12, 12);
    const pv = presentValueOfAnnuity(emi, 12, 12);
    expect(pv).toBeCloseTo(100000, 1);
  });

  it('handles a 0% rate loan as a simple division', () => {
    const pv = presentValueOfAnnuity(10000, 0, 12);
    expect(pv).toBeCloseTo(120000, 2);
  });
});

describe('splitPayment', () => {
  it('applies payment to interest first, then principal', () => {
    const result = splitPayment(10000, 6000);
    expect(result.interestPaid).toBe(6000);
    expect(result.principalPaid).toBe(4000);
    expect(result.remainingInterestDue).toBe(0);
  });

  it('leaves remaining interest due if payment is less than accrued interest', () => {
    const result = splitPayment(3000, 6000);
    expect(result.interestPaid).toBe(3000);
    expect(result.principalPaid).toBe(0);
    expect(result.remainingInterestDue).toBe(3000);
  });

  it('handles a payment exactly equal to accrued interest', () => {
    const result = splitPayment(6000, 6000);
    expect(result.interestPaid).toBe(6000);
    expect(result.principalPaid).toBe(0);
    expect(result.remainingInterestDue).toBe(0);
  });
});

describe('computeMinimumDue', () => {
  it('computes ~5% of the revolving balance, floored at a minimum amount', () => {
    const mad = computeMinimumDue({ totalAmountDue: 50000 });
    expect(mad).toBe(2500); // 5% of 50000
  });

  it('applies the floor amount for small balances', () => {
    const mad = computeMinimumDue({ totalAmountDue: 1000 });
    expect(mad).toBe(200); // floor, since 5% of 1000 = 50 < 200
  });

  it('adds EMI and overlimit components at 100%', () => {
    const mad = computeMinimumDue({ totalAmountDue: 50000, emiComponent: 5000, overlimitAmount: 1000 });
    // 5% of (50000 - 5000 - 1000) = 2200, plus emi 5000, plus overlimit 1000 = 8200
    expect(mad).toBe(8200);
  });

  it('never exceeds the total amount due', () => {
    const mad = computeMinimumDue({ totalAmountDue: 100 });
    expect(mad).toBe(100);
  });

  it('returns 0 when the total amount due is 0 (fully paid, no new spend)', () => {
    expect(computeMinimumDue({ totalAmountDue: 0 })).toBe(0);
  });

  it('never goes negative for a credit balance (overpayment/refund resulted in a negative total due)', () => {
    expect(computeMinimumDue({ totalAmountDue: -500 })).toBe(0);
  });

  it('handles EMI/overlimit components exceeding the total amount due without going negative', () => {
    // Malformed/edge input: components larger than the total - revolving balance clamps to 0.
    const mad = computeMinimumDue({ totalAmountDue: 1000, emiComponent: 2000 });
    expect(mad).toBeGreaterThanOrEqual(0);
  });

  it('respects a custom minDuePercent and floorAmount', () => {
    const mad = computeMinimumDue({ totalAmountDue: 100000 }, 10, 500);
    expect(mad).toBe(10000); // 10% of 100000
  });
});

describe('projectCreditCardPayoff', () => {
  it('projects months to payoff and total interest when paying only minimum due', () => {
    const result = projectCreditCardPayoff(50000, 3.5);
    expect(result.neverPaysOff).toBe(false);
    expect(result.monthsToPayoff).toBeGreaterThan(0);
    expect(result.totalInterestPaid).toBeGreaterThan(0);
    expect(result.schedule.length).toBe(result.monthsToPayoff);
    // Balance should trend downward.
    expect(result.schedule[result.schedule.length - 1].closingBalance).toBeLessThan(1);
  });

  it('flags when the minimum-due percentage cannot outpace the interest rate', () => {
    const result = projectCreditCardPayoff(50000, 6, 5); // 6%/mo interest > 5% min-due rate
    expect(result.neverPaysOff).toBe(true);
    expect(result.monthsToPayoff).toBeNull();
  });

  it('treats an exactly-equal min-due rate and interest rate as never paying off (conservative)', () => {
    const result = projectCreditCardPayoff(50000, 5, 5);
    expect(result.neverPaysOff).toBe(true);
  });

  it('returns immediately (0 months) for a zero outstanding balance', () => {
    const result = projectCreditCardPayoff(0, 3.5);
    expect(result.monthsToPayoff).toBe(0);
    expect(result.totalInterestPaid).toBe(0);
  });

  it('does not overpay when the balance is smaller than the payment floor', () => {
    // 50 outstanding, floor of 200 - the payment should be capped to the balance, not 200.
    const result = projectCreditCardPayoff(50, 3.5);
    expect(result.schedule[0].payment).toBeCloseTo(50 + result.schedule[0].interest, 2);
    expect(result.monthsToPayoff).toBe(1);
  });

  it('works for a 0% interest card (e.g. promotional financing)', () => {
    const result = projectCreditCardPayoff(10000, 0);
    expect(result.neverPaysOff).toBe(false);
    expect(result.totalInterestPaid).toBe(0);
    expect(result.monthsToPayoff).toBeGreaterThan(0);
  });

  it('caps at maxMonths and flags neverPaysOff if payoff would take unreasonably long', () => {
    // minDuePercent only marginally above the monthly rate - takes a very long time.
    const result = projectCreditCardPayoff(1000000, 3.5, 3.51, 200, 24);
    expect(result.neverPaysOff).toBe(true);
    expect(result.monthsToPayoff).toBeNull();
  });
});

describe('computeCreditCardInterestState', () => {
  it('reports no interest and isPaidInFull when the bill is fully paid', () => {
    const state = computeCreditCardInterestState(
      { totalAmountDue: 50000, paymentMade: 50000, dueDate: '2026-08-01' }, 3.5, '2026-09-01'
    );
    expect(state.isPaidInFull).toBe(true);
    expect(state.interestAccruing).toBe(false);
    expect(state.accruedInterestSinceDue).toBe(0);
  });

  it('does not accrue interest yet if a partial payment was made but the due date has not passed', () => {
    const state = computeCreditCardInterestState(
      { totalAmountDue: 50000, paymentMade: 20000, dueDate: '2026-08-20' }, 3.5, '2026-08-10'
    );
    expect(state.outstanding).toBe(30000);
    expect(state.interestAccruing).toBe(false);
    expect(state.accruedInterestSinceDue).toBe(0);
    expect(state.effectiveBalance).toBe(30000);
  });

  it('does not accrue interest on the due date itself (0 days past due)', () => {
    const state = computeCreditCardInterestState(
      { totalAmountDue: 50000, paymentMade: 0, dueDate: '2026-08-20' }, 3.5, '2026-08-20'
    );
    expect(state.interestAccruing).toBe(false);
    expect(state.daysPastDue).toBe(0);
  });

  it('prorates a small stub interest amount for the days actually overdue, not a full month', () => {
    const state = computeCreditCardInterestState(
      { totalAmountDue: 50000, paymentMade: 0, dueDate: '2026-08-20' }, 3.5, '2026-08-25' // 5 days overdue
    );
    expect(state.interestAccruing).toBe(true);
    expect(state.daysPastDue).toBe(5);
    // 50000 * 0.035 * (5/30) ~= 291.67 - much less than a full month's 1750
    expect(state.accruedInterestSinceDue).toBeCloseTo(50000 * 0.035 * (5 / 30), 2);
    expect(state.accruedInterestSinceDue).toBeLessThan(50000 * 0.035);
    expect(state.effectiveBalance).toBeCloseTo(50000 + state.accruedInterestSinceDue, 2);
  });
});
