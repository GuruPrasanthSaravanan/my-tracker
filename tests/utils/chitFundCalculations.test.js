import { describe, it, expect } from 'vitest';
import { computeChitFundStatus } from '../../src/utils/chitFundCalculations';

describe('computeChitFundStatus', () => {
  const chit = { durationMonths: 20 };

  it('sums contributions and dividends across logged months', () => {
    const months = [
      { month: '2026-01', contributionPaid: 4250, dividendReceived: 750, isPrizedMonth: false, prizeAmountReceived: 0 },
      { month: '2026-02', contributionPaid: 4500, dividendReceived: 500, isPrizedMonth: false, prizeAmountReceived: 0 },
    ];
    const status = computeChitFundStatus(chit, months);
    expect(status.totalContributed).toBe(8750);
    expect(status.totalDividends).toBe(1250);
    expect(status.monthsLogged).toBe(2);
    expect(status.monthsRemaining).toBe(18);
    expect(status.hasWon).toBe(false);
    expect(status.prizedMonth).toBeNull();
  });

  it('identifies the prized month and amount once the user has won', () => {
    const months = [
      { month: '2026-01', contributionPaid: 4250, dividendReceived: 750, isPrizedMonth: false, prizeAmountReceived: 0 },
      { month: '2026-02', contributionPaid: 5000, dividendReceived: 0, isPrizedMonth: true, prizeAmountReceived: 80000 },
      { month: '2026-03', contributionPaid: 5000, dividendReceived: 0, isPrizedMonth: false, prizeAmountReceived: 0 },
    ];
    const status = computeChitFundStatus(chit, months);
    expect(status.hasWon).toBe(true);
    expect(status.prizedMonth).toBe('2026-02');
    expect(status.prizeAmountReceived).toBe(80000);
  });

  it('computes net position (received vs paid) - negative before winning is expected', () => {
    const months = [
      { month: '2026-01', contributionPaid: 4250, dividendReceived: 750, isPrizedMonth: false, prizeAmountReceived: 0 },
    ];
    const status = computeChitFundStatus(chit, months);
    // Paid 4250, received back 750 in dividend -> net -3500 so far (expected, hasn't won yet)
    expect(status.netPosition).toBe(750 - 4250);
  });

  it('flags isComplete once every month of the duration has been logged', () => {
    const shortChit = { durationMonths: 2 };
    const months = [
      { month: '2026-01', contributionPaid: 5000, dividendReceived: 0, isPrizedMonth: false, prizeAmountReceived: 0 },
      { month: '2026-02', contributionPaid: 5000, dividendReceived: 0, isPrizedMonth: true, prizeAmountReceived: 90000 },
    ];
    expect(computeChitFundStatus(shortChit, months).isComplete).toBe(true);
    expect(computeChitFundStatus(chit, months).isComplete).toBe(false); // 20-month chit, only 2 logged
  });

  it('handles a brand-new chit with no months logged yet', () => {
    const status = computeChitFundStatus(chit, []);
    expect(status.monthsLogged).toBe(0);
    expect(status.monthsRemaining).toBe(20);
    expect(status.totalContributed).toBe(0);
    expect(status.netPosition).toBe(0);
    expect(status.isComplete).toBe(false);
  });
});
