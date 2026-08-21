import { describe, it, expect } from 'vitest';
import {
  calculateEMI,
  buildAmortizationSchedule,
  computeEMIStatus,
  computeSimpleInterestAccrued,
  splitPayment,
  presentValueOfAnnuity,
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
