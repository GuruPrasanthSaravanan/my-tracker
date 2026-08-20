/**
 * Group rows by a field and sum a value column.
 * @param {string[][]} rows - 2D array from Sheets API
 * @param {number} groupIdx - column index to group by
 * @param {number} sumIdx - column index to sum
 * @returns {Map<string, number>}
 */
export function sumByField(rows, groupIdx, sumIdx) {
  const result = new Map();
  for (const row of rows) {
    const key = row[groupIdx] || '';
    const val = parseFloat(row[sumIdx]) || 0;
    result.set(key, (result.get(key) || 0) + val);
  }
  return result;
}

/**
 * Compute per-vendor balance: Bills - Paid.
 * Positive = you owe them. Negative = they owe you (advance).
 * @param {string[][]} rows - Vendors tab rows [Date, Vendor, Desc, Project, Bill, Paid]
 * @returns {Map<string, number>}
 */
export function computeVendorBalances(rows) {
  const result = new Map();
  for (const row of rows) {
    const vendor = row[1] || '';
    const bill = parseFloat(row[4]) || 0;
    const paid = parseFloat(row[5]) || 0;
    result.set(vendor, (result.get(vendor) || 0) + bill - paid);
  }
  return result;
}

/**
 * Compute per-account net balance: IN - OUT.
 * @param {string[][]} rows - CashBook rows [Date, Desc, Account, Type, IN, OUT]
 * @returns {Map<string, number>}
 */
export function computeAccountBalances(rows) {
  const result = new Map();
  for (const row of rows) {
    const account = row[2] || '';
    const moneyIn = parseFloat(row[4]) || 0;
    const moneyOut = parseFloat(row[5]) || 0;
    result.set(account, (result.get(account) || 0) + moneyIn - moneyOut);
  }
  return result;
}

/**
 * Sum all bills for a specific project from vendor rows.
 * @param {string[][]} rows - Vendors tab rows [Date, Vendor, Desc, Project, Bill, Paid]
 * @param {string} projectCode - Project code to filter by
 * @returns {number}
 */
export function computeProjectSpent(rows, projectCode) {
  let total = 0;
  for (const row of rows) {
    if (row[3] === projectCode) {
      total += parseFloat(row[4]) || 0;
    }
  }
  return total;
}

/**
 * Calculate overall debt progress.
 * @param {string[][]} rows - Debts tab rows [Priority, Name, Original, Rate, Target, DebitsFrom, Status]
 * @returns {{ totalOriginal: number, totalCleared: number, percentCleared: number, activeDebts: object[] }}
 */
export function computeDebtProgress(rows) {
  let totalOriginal = 0;
  let totalCleared = 0;
  const activeDebts = [];

  for (const row of rows) {
    const amount = parseFloat(row[2]) || 0;
    totalOriginal += amount;
    if ((row[6] || '').toLowerCase() === 'cleared') {
      totalCleared += amount;
    } else {
      activeDebts.push({
        priority: parseInt(row[0]) || 0,
        name: row[1] || '',
        originalAmount: amount,
        interestRate: parseFloat(row[3]) || 0,
        targetDate: row[4] || '',
        debitsFrom: row[5] || '',
        status: row[6] || 'Active',
      });
    }
  }

  const percentCleared = totalOriginal > 0 ? (totalCleared / totalOriginal) * 100 : 0;
  return { totalOriginal, totalCleared, percentCleared, activeDebts };
}
