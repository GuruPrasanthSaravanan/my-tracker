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
 * Sums CashBook Money IN/OUT grouped by Type, for entries within a given
 * month, giving the "Actual" side of a Planned-vs-Actual comparison. Always
 * computed live from the transaction log rather than manually entered,
 * consistent with the app's existing pattern of deriving summaries from raw
 * CashBook rows (see bugs-and-lessons.md §3.4).
 * @param {string[][]} rows - CashBook rows [Date, Desc, Account, Type, IN, OUT]
 * @param {string} month - "YYYY-MM"
 * @returns {Map<string, number>} Type -> net actual (IN - OUT) for that month
 */
export function computeMonthlyActuals(rows, month) {
  const result = new Map();
  for (const row of rows) {
    const date = row[0] || '';
    if (!date.startsWith(month)) continue;
    const type = row[3] || '';
    const moneyIn = parseFloat(row[4]) || 0;
    const moneyOut = parseFloat(row[5]) || 0;
    result.set(type, (result.get(type) || 0) + moneyIn - moneyOut);
  }
  return result;
}

/**
 * Total income, outflow, and surplus (income - outflow) from CashBook for a
 * given month.
 * @param {string[][]} rows - CashBook rows [Date, Desc, Account, Type, IN, OUT]
 * @param {string} month - "YYYY-MM"
 * @returns {{ totalIn: number, totalOut: number, surplus: number }}
 */
export function computeMonthSurplus(rows, month) {
  let totalIn = 0;
  let totalOut = 0;
  for (const row of rows) {
    if (!(row[0] || '').startsWith(month)) continue;
    totalIn += parseFloat(row[4]) || 0;
    totalOut += parseFloat(row[5]) || 0;
  }
  return { totalIn, totalOut, surplus: totalIn - totalOut };
}

/**
 * Projects a credit card's upcoming bill from CashBook activity, by treating
 * the card as a "virtual account" - every purchase on the card is logged as
 * a normal CashBook entry with Account = the card's exact name (Money Out for
 * a purchase, Money In for a refund/credit). This sums that account's net
 * spend within a date window (exclusive of `fromDate` itself, inclusive of
 * `toDate`), giving an estimate of "what this cycle's bill will show" before
 * the actual bank statement is generated.
 * @param {string[][]} rows - CashBook rows [Date, Desc, Account, Type, IN, OUT]
 * @param {string} accountName - must exactly match the Credit Card's Name
 * @param {string|Date|null} fromDate - typically the last bill's statement date (exclusive);
 *   null means "from the beginning" (used when no bill has ever been recorded for this card)
 * @param {string|Date} toDate - defaults to now
 * @returns {{ spend: number, transactionCount: number }}
 */
export function computeCashBookSpendForAccount(rows, accountName, fromDate = null, toDate = new Date()) {
  const from = fromDate ? new Date(fromDate) : null;
  const to = new Date(toDate);
  let spend = 0;
  let transactionCount = 0;

  for (const row of rows) {
    if ((row[2] || '') !== accountName) continue;
    if (!row[0]) continue;
    const date = new Date(row[0]);
    if (Number.isNaN(date.getTime())) continue;
    if (from && date <= from) continue;
    if (date > to) continue;

    const moneyIn = parseFloat(row[4]) || 0;
    const moneyOut = parseFloat(row[5]) || 0;
    spend += moneyOut - moneyIn;
    transactionCount++;
  }

  return { spend: Math.max(spend, 0), transactionCount };
}

