import { describe, it, expect } from 'vitest';
import {
  sumByField, computeVendorBalances, computeAccountBalances, computeProjectSpent, computeCashBookSpendForAccount,
  computeCashBookProjectSpend, computeCombinedProjectSpend,
  computeMonthlyActuals, computeActualForPlan, computeMonthSurplus, hasEMIBeenLoggedForMonth, computeUpcomingEMIFundingWarnings,
  computeTypeFrequencyForAccount, orderTypeOptionsForAccount, computeTypeSpendBreakdown, computeSubCategorySpendBreakdown,
} from '../../src/utils/aggregations';

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

describe('computeCashBookProjectSpend / computeCombinedProjectSpend', () => {
  const cashBookRows = [
    ['2026-09-01', 'Cement direct purchase', 'ICICI', 'PROJECT', '', '18000', 'Constr'],
    ['2026-09-02', 'Site visit fuel', 'ICICI', 'PROJECT', '', '2000', 'Constr'],
    ['2026-09-03', 'Salary', 'ICICI', 'SALARY', '153000', '', ''],
    ['2026-09-04', 'Paint direct', 'HDFC', 'PROJECT', '', '5000', 'Reno'],
  ];
  const vendorRows = [
    ['1-Sep', 'Raju', 'Cement', 'Constr', '18000', ''],
  ];

  it('sums CashBook Money OUT tagged with a project via the optional Project column', () => {
    expect(computeCashBookProjectSpend(cashBookRows, 'Constr')).toBe(20000);
    expect(computeCashBookProjectSpend(cashBookRows, 'Reno')).toBe(5000);
    expect(computeCashBookProjectSpend(cashBookRows, 'Land')).toBe(0);
  });

  it('ignores non-project entries even if they happen to have no project tag', () => {
    expect(computeCashBookProjectSpend(cashBookRows, '')).toBe(0);
  });

  it('combines Vendors bills and tagged CashBook entries into one total', () => {
    expect(computeCombinedProjectSpend(vendorRows, cashBookRows, 'Constr')).toBe(18000 + 20000);
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

describe('computeActualForPlan', () => {
  const rows = [
    ['2026-09-05', 'Land Loan EMI', 'HDFC', 'EMI', '', '21000'],
    ['2026-09-06', 'Car Loan EMI', 'ICICI', 'EMI', '', '10000'],
    ['2026-10-05', 'Land Loan EMI', 'HDFC', 'EMI', '', '21000'],
  ];

  it('matches every account with the category when no account is given (same as computeMonthlyActuals)', () => {
    expect(computeActualForPlan(rows, '2026-09', 'EMI')).toBe(-31000);
  });

  it('narrows to just the given account when specified', () => {
    expect(computeActualForPlan(rows, '2026-09', 'EMI', 'HDFC')).toBe(-21000);
    expect(computeActualForPlan(rows, '2026-09', 'EMI', 'ICICI')).toBe(-10000);
  });

  it('returns 0 for a category/account/month combination with no matches', () => {
    expect(computeActualForPlan(rows, '2026-09', 'EMI', 'AXIS')).toBe(0);
    expect(computeActualForPlan(rows, '2026-11', 'EMI', 'HDFC')).toBe(0);
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

describe('hasEMIBeenLoggedForMonth', () => {
  const loan = { name: 'Land Loan', debitsFrom: 'HDFC' };

  it('finds a matching entry for the given month', () => {
    const rows = [
      ['2026-09-05', 'Land Loan - EMI', 'HDFC', 'EMI', '', '21000'],
    ];
    expect(hasEMIBeenLoggedForMonth(rows, loan, '2026-09')).toBe(true);
  });

  it('does not match a different loan, account, type, or month', () => {
    const rows = [
      ['2026-09-05', 'Car Loan - EMI', 'HDFC', 'EMI', '', '21000'], // different loan name
      ['2026-09-05', 'Land Loan - EMI', 'ICICI', 'EMI', '', '21000'], // different account
      ['2026-09-05', 'Land Loan - EMI', 'HDFC', 'DEBT', '', '21000'], // different type
      ['2026-08-05', 'Land Loan - EMI', 'HDFC', 'EMI', '', '21000'], // different month
    ];
    expect(hasEMIBeenLoggedForMonth(rows, loan, '2026-09')).toBe(false);
  });
});

describe('computeUpcomingEMIFundingWarnings', () => {
  const today = '2026-09-10';

  it('flags a shortfall when the account balance cannot cover an upcoming EMI this month', () => {
    const loans = [
      { status: 'Active', debitsFrom: 'HDFC', name: 'Land Loan', emiStatus: { nextDueDate: '2026-09-20', emi: 21000 } },
    ];
    const accountBalances = new Map([['HDFC', 15000]]);
    const minBalances = new Map();
    const warnings = computeUpcomingEMIFundingWarnings(loans, accountBalances, minBalances, today);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ account: 'HDFC', requiredAmount: 21000, currentBalance: 15000, shortfall: 6000 });
    expect(warnings[0].loanNames).toEqual(['Land Loan']);
  });

  it('accounts for the configured minimum balance buffer', () => {
    const loans = [
      { status: 'Active', debitsFrom: 'HDFC', name: 'Land Loan', emiStatus: { nextDueDate: '2026-09-20', emi: 21000 } },
    ];
    const accountBalances = new Map([['HDFC', 25000]]);
    const minBalances = new Map([['HDFC', 10000]]); // only 15000 actually available
    const warnings = computeUpcomingEMIFundingWarnings(loans, accountBalances, minBalances, today);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].shortfall).toBe(6000);
  });

  it('sums multiple loans debiting the same account', () => {
    const loans = [
      { status: 'Active', debitsFrom: 'HDFC', name: 'Land Loan', emiStatus: { nextDueDate: '2026-09-20', emi: 21000 } },
      { status: 'Active', debitsFrom: 'HDFC', name: 'Car Loan', emiStatus: { nextDueDate: '2026-09-25', emi: 10000 } },
    ];
    const accountBalances = new Map([['HDFC', 25000]]);
    const warnings = computeUpcomingEMIFundingWarnings(loans, accountBalances, new Map(), today);
    expect(warnings[0].requiredAmount).toBe(31000);
    expect(warnings[0].loanNames).toEqual(['Land Loan', 'Car Loan']);
  });

  it('does not warn when the balance is sufficient', () => {
    const loans = [
      { status: 'Active', debitsFrom: 'HDFC', name: 'Land Loan', emiStatus: { nextDueDate: '2026-09-20', emi: 21000 } },
    ];
    const accountBalances = new Map([['HDFC', 50000]]);
    expect(computeUpcomingEMIFundingWarnings(loans, accountBalances, new Map(), today)).toHaveLength(0);
  });

  it('suggests the account with the largest available surplus as a transfer source', () => {
    const loans = [
      { status: 'Active', debitsFrom: 'HDFC', name: 'Land Loan', emiStatus: { nextDueDate: '2026-09-20', emi: 21000 } },
      { status: 'Active', debitsFrom: 'HDFC', name: 'Car Loan', emiStatus: { nextDueDate: '2026-09-25', emi: 10000 } },
    ];
    const accountBalances = new Map([['HDFC', 15000], ['ICICI', 80000], ['AXIS', 40000]]);
    const minBalances = new Map([['ICICI', 10000], ['AXIS', 5000]]); // ICICI available: 70000, AXIS available: 35000
    const warnings = computeUpcomingEMIFundingWarnings(loans, accountBalances, minBalances, today);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].requiredAmount).toBe(31000);
    expect(warnings[0].shortfall).toBe(16000);
    expect(warnings[0].suggestedSourceAccount).toBe('ICICI');
    expect(warnings[0].suggestedSourceAvailable).toBe(70000);
  });

  it('does not suggest itself as a transfer source, and returns null if no other account has a surplus', () => {
    const loans = [
      { status: 'Active', debitsFrom: 'HDFC', name: 'Land Loan', emiStatus: { nextDueDate: '2026-09-20', emi: 21000 } },
    ];
    const accountBalances = new Map([['HDFC', 15000], ['ICICI', 500]]); // ICICI has almost nothing either
    const warnings = computeUpcomingEMIFundingWarnings(loans, accountBalances, new Map(), today);
    expect(warnings[0].suggestedSourceAccount).toBe('ICICI'); // still the best available, even if small
    expect(warnings[0].suggestedSourceAvailable).toBe(500);

    const noSurplusBalances = new Map([['HDFC', 15000], ['ICICI', 0]]);
    const warnings2 = computeUpcomingEMIFundingWarnings(loans, noSurplusBalances, new Map(), today);
    expect(warnings2[0].suggestedSourceAccount).toBeNull();
  });

  it('ignores closed loans, loans with no DebitsFrom, and dates already due or in a different month', () => {
    const loans = [
      { status: 'Closed', debitsFrom: 'HDFC', name: 'Closed Loan', emiStatus: { nextDueDate: '2026-09-20', emi: 99999 } },
      { status: 'Active', debitsFrom: '', name: 'No Account Loan', emiStatus: { nextDueDate: '2026-09-20', emi: 99999 } },
      { status: 'Active', debitsFrom: 'ICICI', name: 'Already Due', emiStatus: { nextDueDate: '2026-09-05', emi: 99999 } },
      { status: 'Active', debitsFrom: 'AXIS', name: 'Next Month', emiStatus: { nextDueDate: '2026-10-05', emi: 99999 } },
    ];
    const accountBalances = new Map(); // empty balances - would definitely warn if any of these were counted
    expect(computeUpcomingEMIFundingWarnings(loans, accountBalances, new Map(), today)).toHaveLength(0);
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

describe('computeTypeFrequencyForAccount', () => {
  it('counts Type usage for a given account, most-used first', () => {
    const rows = [
      ['2026-09-01', 'a', 'HDFC', 'EMI', '', '21000'],
      ['2026-09-02', 'b', 'HDFC', 'EMI', '', '21000'],
      ['2026-09-03', 'c', 'HDFC', 'VENDOR', '', '5000'],
      ['2026-09-04', 'd', 'ICICI', 'SALARY', '153000', ''],
    ];
    const freq = computeTypeFrequencyForAccount(rows, 'HDFC');
    expect([...freq.entries()]).toEqual([['EMI', 2], ['VENDOR', 1]]);
    expect(computeTypeFrequencyForAccount(rows, 'AXIS').size).toBe(0);
  });
});

describe('orderTypeOptionsForAccount', () => {
  const allTypes = ['SALARY', 'EMI', 'VENDOR', 'PROJECT', 'FAMILY'];
  const rows = [
    ['2026-09-01', 'a', 'HDFC', 'PROJECT', '', '30000'],
    ['2026-09-02', 'b', 'HDFC', 'PROJECT', '', '10000'],
    ['2026-09-03', 'c', 'HDFC', 'VENDOR', '', '5000'],
  ];

  it('returns the original list untouched when no account is selected yet', () => {
    expect(orderTypeOptionsForAccount(allTypes, rows, '')).toEqual(allTypes);
  });

  it('puts favorites first, then history by frequency, then everything else in original order', () => {
    const ordered = orderTypeOptionsForAccount(allTypes, rows, 'HDFC', ['FAMILY']);
    expect(ordered).toEqual(['FAMILY', 'PROJECT', 'VENDOR', 'SALARY', 'EMI']);
  });

  it('never drops or duplicates a type, and degrades to the original list for a brand-new account', () => {
    const ordered = orderTypeOptionsForAccount(allTypes, rows, 'BRAND-NEW-ACCOUNT');
    expect(ordered).toEqual(allTypes);
    expect(new Set(orderTypeOptionsForAccount(allTypes, rows, 'HDFC', ['FAMILY'])).size).toBe(allTypes.length);
  });
});

describe('computeTypeSpendBreakdown', () => {
  it('sums Money OUT per Type for a given month, ignoring Money IN rows', () => {
    const rows = [
      ['2026-09-01', 'Salary', 'ICICI', 'SALARY', '153000', ''],
      ['2026-09-05', 'EMI', 'HDFC', 'EMI', '', '21000'],
      ['2026-09-06', 'Groceries', 'ICICI', 'FAMILY', '', '8000'],
      ['2026-09-07', 'More groceries', 'ICICI', 'FAMILY', '', '2000'],
      ['2026-10-01', 'Next month EMI', 'HDFC', 'EMI', '', '21000'],
    ];
    const breakdown = computeTypeSpendBreakdown(rows, '2026-09');
    expect(breakdown.get('EMI')).toBe(21000); // not 42000 - October's EMI must not leak in
    expect(breakdown.get('FAMILY')).toBe(10000);
    expect(breakdown.has('SALARY')).toBe(false); // it's Money IN, not an outflow
  });
});

describe('computeSubCategorySpendBreakdown', () => {
  const rows = [
    ['2026-09-01', 'Dinner out', 'ICICI', 'WANTS', '', '2000', '', 'Dining'],
    ['2026-09-02', 'Movie', 'ICICI', 'WANTS', '', '1000', '', 'Entertainment'],
    ['2026-09-03', 'More dinner', 'ICICI', 'WANTS', '', '1500', '', 'Dining'],
    ['2026-09-04', 'Unlabeled want', 'ICICI', 'WANTS', '', '500', '', ''],
    ['2026-09-05', 'EMI', 'HDFC', 'EMI', '', '21000', '', ''],
  ];

  it('sums Money OUT per sub-category within a specific Type/month', () => {
    const breakdown = computeSubCategorySpendBreakdown(rows, '2026-09', 'WANTS');
    expect(breakdown.get('Dining')).toBe(3500);
    expect(breakdown.get('Entertainment')).toBe(1000);
    expect(breakdown.get('(uncategorized)')).toBe(500);
    expect(breakdown.has('EMI')).toBe(false);
  });
});

