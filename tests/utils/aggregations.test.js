import { describe, it, expect } from 'vitest';
import { sumByField, computeVendorBalances, computeAccountBalances, computeProjectSpent, computeCashBookSpendForAccount, computeMonthlyActuals, computeMonthSurplus } from '../../src/utils/aggregations';

describe('sumByField', () => {
  it('sums values grouped by a field', () => {
    const rows = [
      ['1-Sep', 'Salary', 'ICICI', 'SALARY', '153000', ''],
      ['1-Sep', 'EMI', 'HDFC', 'EMI', '', '31000'],
      ['2-Sep', 'Bonus', 'ICICI', 'BONUS', '60000', ''],
    ];
    const result = sumByField(rows, 2, 4); // group by Account (idx 2), sum Money IN (idx 4)
    expect(result.get('ICICI')).toBe(213000);
    expect(result.get('HDFC')).toBe(0);
  });
});

describe('computeVendorBalances', () => {
  it('calculates bills minus paid per vendor', () => {
    const rows = [
      ['1-Sep', 'Raju', 'Advance', 'Constr', '', '30000'],
      ['1-Sep', 'Sri Lakshmi', 'Cement', 'Constr', '18000', ''],
      ['5-Sep', 'Sri Lakshmi', 'Payment', '', '', '10000'],
    ];
    const result = computeVendorBalances(rows);
    expect(result.get('Raju')).toBe(-30000); // they owe you (advance)
    expect(result.get('Sri Lakshmi')).toBe(8000); // you owe them
  });
});

describe('computeAccountBalances', () => {
  it('calculates net per account', () => {
    const rows = [
      ['1-Sep', 'Salary', 'ICICI', 'SALARY', '153000', ''],
      ['1-Sep', 'EMI', 'ICICI', 'EMI', '', '11000'],
      ['1-Sep', 'Transfer', 'HDFC', 'EMI', '', '31000'],
    ];
    const result = computeAccountBalances(rows);
    expect(result.get('ICICI')).toBe(142000); // 153000 - 11000
    expect(result.get('HDFC')).toBe(-31000); // 0 - 31000
  });
});

describe('computeProjectSpent', () => {
  it('sums bills for a specific project from vendor rows', () => {
    const vendorRows = [
      ['1-Sep', 'Raju', 'Cement', 'Constr', '18000', ''],
      ['1-Sep', 'Ganesh', 'Bricks', 'Constr', '25000', ''],
      ['2-Sep', 'Sharma', 'Paint', 'Reno', '12000', ''],
      ['3-Sep', 'Raju', 'Labour', 'Constr', '30000', ''],
    ];
    expect(computeProjectSpent(vendorRows, 'Constr')).toBe(73000);
    expect(computeProjectSpent(vendorRows, 'Reno')).toBe(12000);
    expect(computeProjectSpent(vendorRows, 'Land')).toBe(0);
  });
});

describe('computeMonthlyActuals', () => {
  const rows = [
    ['2026-09-01', 'Salary', 'ICICI', 'SALARY', '153000', ''],
    ['2026-09-05', 'EMI', 'HDFC', 'EMI', '', '21000'],
    ['2026-09-10', 'Groceries', 'ICICI', 'FAMILY', '', '8000'],
    ['2026-10-01', 'Next month salary', 'ICICI', 'SALARY', '153000', ''],
  ];

  it('sums net actual (IN - OUT) grouped by Type, for the given month only', () => {
    const result = computeMonthlyActuals(rows, '2026-09');
    expect(result.get('SALARY')).toBe(153000);
    expect(result.get('EMI')).toBe(-21000);
    expect(result.get('FAMILY')).toBe(-8000);
    expect(result.has('SALARY')).toBe(true);
  });

  it('excludes entries from other months', () => {
    const result = computeMonthlyActuals(rows, '2026-10');
    expect(result.get('SALARY')).toBe(153000);
    expect(result.has('EMI')).toBe(false);
  });
});

describe('computeMonthSurplus', () => {
  const rows = [
    ['2026-09-01', 'Salary', 'ICICI', 'SALARY', '153000', ''],
    ['2026-09-05', 'EMI', 'HDFC', 'EMI', '', '21000'],
    ['2026-09-10', 'Groceries', 'ICICI', 'FAMILY', '', '8000'],
    ['2026-10-01', 'Next month', 'ICICI', 'SALARY', '200000', ''],
  ];

  it('computes total income, outflow, and surplus for a given month', () => {
    const result = computeMonthSurplus(rows, '2026-09');
    expect(result.totalIn).toBe(153000);
    expect(result.totalOut).toBe(29000);
    expect(result.surplus).toBe(124000);
  });

  it('returns zeroes for a month with no entries', () => {
    const result = computeMonthSurplus(rows, '2026-01');
    expect(result).toEqual({ totalIn: 0, totalOut: 0, surplus: 0 });
  });
});

describe('computeCashBookSpendForAccount', () => {
  const rows = [
    ['2026-08-01', 'Groceries', 'ICICI Amazon Pay', 'Shopping', '', '2000'],
    ['2026-08-05', 'Electronics', 'ICICI Amazon Pay', 'Shopping', '', '15000'],
    ['2026-08-10', 'Refund', 'ICICI Amazon Pay', 'Shopping', '3000', ''],
    ['2026-08-10', 'Fuel', 'HDFC', 'Fuel', '', '2500'], // different account - ignored
    ['2026-09-01', 'Next cycle purchase', 'ICICI Amazon Pay', 'Shopping', '', '5000'],
  ];

  it('sums money-out minus money-in for the matching account within the date window', () => {
    const result = computeCashBookSpendForAccount(rows, 'ICICI Amazon Pay', null, '2026-08-31');
    // 2000 + 15000 - 3000 = 14000, across 3 matching transactions
    expect(result.spend).toBe(14000);
    expect(result.transactionCount).toBe(3);
  });

  it('excludes entries on or before fromDate (last statement date) and includes only the new cycle', () => {
    const result = computeCashBookSpendForAccount(rows, 'ICICI Amazon Pay', '2026-08-31', '2026-09-30');
    expect(result.spend).toBe(5000);
    expect(result.transactionCount).toBe(1);
  });

  it('ignores entries for a different account', () => {
    const result = computeCashBookSpendForAccount(rows, 'HDFC', null, '2026-08-31');
    expect(result.spend).toBe(2500);
    expect(result.transactionCount).toBe(1);
  });

  it('returns zero spend for an account with no matching transactions', () => {
    const result = computeCashBookSpendForAccount(rows, 'Nonexistent Card', null, '2026-12-31');
    expect(result.spend).toBe(0);
    expect(result.transactionCount).toBe(0);
  });

  it('never returns negative spend even if refunds exceed purchases in the window', () => {
    const refundHeavyRows = [
      ['2026-08-01', 'Purchase', 'Card', 'Shopping', '', '1000'],
      ['2026-08-02', 'Big Refund', 'Card', 'Shopping', '5000', ''],
    ];
    const result = computeCashBookSpendForAccount(refundHeavyRows, 'Card', null, '2026-08-31');
    expect(result.spend).toBe(0);
  });

  it('skips rows with missing or unparseable dates instead of throwing', () => {
    const messyRows = [
      ['', 'No date', 'Card', 'Shopping', '', '1000'],
      ['not-a-date', 'Bad date', 'Card', 'Shopping', '', '2000'],
      ['2026-08-15', 'Valid', 'Card', 'Shopping', '', '3000'],
    ];
    const result = computeCashBookSpendForAccount(messyRows, 'Card', null, '2026-08-31');
    expect(result.spend).toBe(3000);
    expect(result.transactionCount).toBe(1);
  });
});

