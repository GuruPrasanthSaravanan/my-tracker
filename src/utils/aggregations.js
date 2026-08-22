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

/** Standardized CashBook description for an auto-logged/quick-logged EMI entry - kept
 * as one place so the auto-log writer and the "already logged?" detector always agree. */
export function emiCashBookDescription(loanName) {
  return `${loanName} - EMI`;
}

/**
 * Checks whether a matching EMI CashBook entry already exists for a given
 * loan and month, so an auto-logger doesn't create a duplicate entry on
 * every app load. Matches on Account + Type=EMI + the standardized
 * description + the entry's date falling in the given month.
 * @param {string[][]} cashBookRows - CashBook rows [Date, Desc, Account, Type, IN, OUT]
 * @param {{ name: string, debitsFrom: string }} loan
 * @param {string} month - "YYYY-MM"
 */
export function hasEMIBeenLoggedForMonth(cashBookRows, loan, month) {
  const desc = emiCashBookDescription(loan.name);
  return cashBookRows.some((row) =>
    (row[0] || '').startsWith(month) && row[1] === desc && row[2] === loan.debitsFrom && row[3] === 'EMI'
  );
}

/**
 * For EMI loans with an installment due *later this month* (not yet due,
 * so not yet auto-logged), checks whether the paying account's current
 * balance - minus its configured minimum balance buffer - can actually
 * cover the total upcoming EMI(s) for that account. Surfaces a shortfall
 * warning from the start of the month (as soon as the balance is
 * insufficient), not just on the due date itself, so there's time to
 * transfer funds in. Multiple loans debiting the same account are summed
 * together.
 * @param {Array} loans - parsed EMI loan objects (each with .status, .debitsFrom, .emiStatus.{nextDueDate,emi})
 * @param {Map<string, number>} accountBalances - from useCashBook
 * @param {Map<string, number>} minBalances - from useAccountSettings
 * @param {string} today - "YYYY-MM-DD"
 * @returns {{ account: string, requiredAmount: number, currentBalance: number, shortfall: number, loanNames: string[] }[]}
 */
export function computeUpcomingEMIFundingWarnings(loans, accountBalances, minBalances, today) {
  const currentMonth = today.slice(0, 7);
  const byAccount = new Map();

  for (const loan of loans) {
    if (loan.status === 'Closed' || !loan.debitsFrom) continue;
    const due = loan.emiStatus?.nextDueDate;
    // Only "upcoming, not yet due" installments this month - once the due
    // date arrives, the auto-logger takes over instead of this warning.
    if (!due || !due.startsWith(currentMonth) || due <= today) continue;

    const entry = byAccount.get(loan.debitsFrom) || { requiredAmount: 0, loanNames: [] };
    entry.requiredAmount += loan.emiStatus.emi;
    entry.loanNames.push(loan.name);
    byAccount.set(loan.debitsFrom, entry);
  }

  const warnings = [];
  for (const [account, { requiredAmount, loanNames }] of byAccount) {
    const currentBalance = accountBalances.get(account) || 0;
    const minBalance = minBalances.get(account) || 0;
    const available = currentBalance - minBalance;
    if (available < requiredAmount) {
      warnings.push({ account, requiredAmount, currentBalance, shortfall: requiredAmount - available, loanNames });
    }
  }
  return warnings;
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

