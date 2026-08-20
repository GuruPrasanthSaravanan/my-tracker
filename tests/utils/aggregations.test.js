import { describe, it, expect } from 'vitest';
import { sumByField, computeVendorBalances, computeAccountBalances } from '../../src/utils/aggregations';

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
