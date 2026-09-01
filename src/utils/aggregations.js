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
 * Sums Money OUT for CashBook entries tagged with a specific project (via
 * the optional Project column, column index 6 - only ever set on
 * Type=PROJECT entries, see EntryForm.jsx). This lets money spent on a
 * project directly through CashBook (not routed through the Vendors tab)
 * still count toward that project's spend.
 * @param {string[][]} rows - CashBook rows [Date, Desc, Account, Type, IN, OUT, Project]
 * @param {string} projectCode - Project code to filter by
 * @returns {number}
 */
export function computeCashBookProjectSpend(rows, projectCode) {
  let total = 0;
  for (const row of rows) {
    if (row[6] === projectCode) {
      total += parseFloat(row[5]) || 0;
    }
  }
  return total;
}

/**
 * Combined project spend across both expense sources: Vendors bills (the
 * original tracking mechanism) plus CashBook entries directly tagged with
 * the project. The two are independent workflows/tabs, so there's no
 * double-counting risk between them.
 * @param {string[][]} vendorRows - Vendors tab rows
 * @param {string[][]} cashBookRows - CashBook tab rows
 * @param {string} projectCode
 * @returns {number}
 */
export function computeCombinedProjectSpend(vendorRows, cashBookRows, projectCode) {
  return computeProjectSpent(vendorRows, projectCode) + computeCashBookProjectSpend(cashBookRows, projectCode);
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
 * For EMI loans with an installment due *later this month* (not yet due, so
 * not yet shown as a "Due Now" confirm card), checks whether the paying
 * account's current balance - minus its configured minimum balance buffer -
 * can actually cover the total upcoming EMI(s) for that account. Surfaces a
 * shortfall warning from the start of the month (as soon as the balance is
 * insufficient), not just on the due date itself, so there's time to
 * transfer funds in. Multiple loans debiting the same account are summed
 * together.
 *
 * Also suggests which *other* account to transfer the shortfall from - the
 * one with the largest available surplus (its own balance minus its own
 * minimum balance buffer), if any account has a positive surplus. This is
 * only a suggestion (the largest-surplus account, not necessarily one that
 * fully covers the shortfall) - the user decides how much to actually move.
 * @param {Array} loans - parsed EMI loan objects (each with .status, .debitsFrom, .emiStatus.{nextDueDate,emi})
 * @param {Map<string, number>} accountBalances - from useCashBook
 * @param {Map<string, number>} minBalances - from useAccountSettings
 * @param {string} today - "YYYY-MM-DD"
 * @returns {{ account: string, requiredAmount: number, currentBalance: number, shortfall: number, loanNames: string[], suggestedSourceAccount: string|null, suggestedSourceAvailable: number }[]}
 */
export function computeUpcomingEMIFundingWarnings(loans, accountBalances, minBalances, today) {
  const currentMonth = today.slice(0, 7);
  const byAccount = new Map();

  for (const loan of loans) {
    if (loan.status === 'Closed' || !loan.debitsFrom) continue;
    const due = loan.emiStatus?.nextDueDate;
    // Only "upcoming, not yet due" installments this month - once the due
    // date arrives, the Dashboard's "Due Now" card takes over instead.
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
      let suggestedSourceAccount = null;
      let suggestedSourceAvailable = 0;
      for (const [otherAccount, otherBalance] of accountBalances) {
        if (otherAccount === account) continue;
        const otherSurplus = otherBalance - (minBalances.get(otherAccount) || 0);
        if (otherSurplus > suggestedSourceAvailable) {
          suggestedSourceAccount = otherAccount;
          suggestedSourceAvailable = otherSurplus;
        }
      }
      warnings.push({
        account, requiredAmount, currentBalance, shortfall: requiredAmount - available, loanNames,
        suggestedSourceAccount, suggestedSourceAvailable,
      });
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
 * Actual net (IN - OUT) for one specific Monthly Plan: a Category (Type)
 * within a month, optionally narrowed to a specific Account. Passing no
 * account matches every account with that Type - identical to
 * `computeMonthlyActuals`'s per-category total - so a plan left without an
 * account keeps working exactly as it did before the Account field existed.
 * @param {string[][]} rows - CashBook rows [Date, Desc, Account, Type, IN, OUT]
 * @param {string} month - "YYYY-MM"
 * @param {string} category - matches CashBook Type
 * @param {string} [account] - optional, narrows to this CashBook Account
 * @returns {number}
 */
export function computeActualForPlan(rows, month, category, account) {
  let total = 0;
  for (const row of rows) {
    const date = row[0] || '';
    if (!date.startsWith(month)) continue;
    if ((row[3] || '') !== category) continue;
    if (account && (row[2] || '') !== account) continue;
    total += (parseFloat(row[4]) || 0) - (parseFloat(row[5]) || 0);
  }
  return total;
}

/**
 * Diagnostic-only helper for a Monthly Plan whose Actual came back 0 for
 * the month: looks for a CashBook row that *would* have matched if
 * Category and/or Account were compared case/whitespace-insensitively
 * instead of the app's normal exact-match comparison - a hint that the
 * ₹0 is a likely typo/case-drift (e.g. "W-Kotak" entered instead of the
 * plan's "W-KOTAK") rather than genuinely no spend yet this month.
 *
 * Deliberately does NOT change how Actual itself is computed - exact-match
 * string keys are a deliberate, documented invariant across this app
 * (loosening it risks silently merging genuinely-different values, see
 * bugs-and-lessons.md discussion) - this only ever *reports* a possible
 * near-match for the user to go verify/correct themselves.
 * @param {string[][]} rows - CashBook rows [Date, Desc, Account(2), Type(3), IN, OUT]
 * @param {string} month - "YYYY-MM"
 * @param {string} category - the Plan's Category (matches CashBook Type)
 * @param {string} [account] - the Plan's optional Account narrowing
 * @returns {{ category: string, account: string } | null} the near-matching
 *   row's actual Type/Account as recorded, or null if nothing close was found
 */
export function findNearMissForZeroActual(rows, month, category, account) {
  const norm = (s) => (s || '').trim().toLowerCase();
  const catNorm = norm(category);
  const accNorm = account ? norm(account) : null;

  for (const row of rows) {
    if (!(row[0] || '').startsWith(month)) continue;
    const rowType = row[3] || '';
    const rowAccount = row[2] || '';

    // An exact match on both would mean Actual wasn't really 0 - not our case, skip.
    if (rowType === category && (!account || rowAccount === account)) continue;

    const typeCloseMatch = norm(rowType) === catNorm;
    const accountCloseMatch = !accNorm || norm(rowAccount) === accNorm;
    if (typeCloseMatch && accountCloseMatch) {
      return { category: rowType, account: rowAccount };
    }
  }
  return null;
}

/**
 * Actual amount transferred for a Monthly Plan that explicitly plans a
 * specific "From Account -> To Account" transfer (e.g. "move ₹10,000 from
 * ICICI to AXIS" for a wants allowance), rather than just narrowing to one
 * side of it like `computeActualForPlan` does.
 *
 * A CashBook self-transfer (see useCashBook.jsx addTransfer) is written as
 * TWO separate rows sharing the same Date and Description - one Money OUT
 * from the source account, one Money IN to the destination account - with
 * no other link between them. This pairs each "from" leg with a "to" leg
 * matching on (date, description, amount), consuming each match one-to-one
 * so a single leg is never reused across multiple pairs (matters if there
 * happen to be more than one ICICI->AXIS transfer with the exact same
 * description in the same month).
 * @param {string[][]} rows - CashBook rows [Date, Desc, Account, Type, IN, OUT]
 * @param {string} month - "YYYY-MM"
 * @param {string} fromAccount
 * @param {string} toAccount
 * @returns {number} total successfully-paired transferred amount
 */
export function computeActualForTransferPlan(rows, month, fromAccount, toAccount) {
  const fromLegs = [];
  const toLegs = [];

  for (const row of rows) {
    const date = row[0] || '';
    if (!date.startsWith(month)) continue;
    if ((row[3] || '') !== 'TRANSFER') continue;
    const account = row[2] || '';
    const description = row[1] || '';
    const moneyIn = parseFloat(row[4]) || 0;
    const moneyOut = parseFloat(row[5]) || 0;

    if (account === fromAccount && moneyOut > 0) fromLegs.push({ date, description, amount: moneyOut });
    if (account === toAccount && moneyIn > 0) toLegs.push({ date, description, amount: moneyIn });
  }

  let total = 0;
  const usedToIndexes = new Set();
  for (const fromLeg of fromLegs) {
    const matchIndex = toLegs.findIndex((toLeg, idx) =>
      !usedToIndexes.has(idx) &&
      toLeg.date === fromLeg.date &&
      toLeg.description === fromLeg.description &&
      toLeg.amount === fromLeg.amount
    );
    if (matchIndex !== -1) {
      usedToIndexes.add(matchIndex);
      total += fromLeg.amount;
    }
  }
  return total;
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
 * Counts how many times each Type has been used with a given Account in
 * CashBook history, most-used first - the "auto-learned" half of the
 * Account -> Type ordering (see `orderTypeOptionsForAccount`).
 * @param {string[][]} rows - CashBook rows [Date, Desc, Account, Type, ...]
 * @param {string} account
 * @returns {Map<string, number>} Type -> usage count, insertion-ordered by descending count
 */
export function computeTypeFrequencyForAccount(rows, account) {
  const counts = new Map();
  for (const row of rows) {
    if ((row[2] || '') !== account) continue;
    const type = row[3] || '';
    if (!type) continue;
    counts.set(type, (counts.get(type) || 0) + 1);
  }
  return new Map([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

/**
 * Orders the Type dropdown for a selected Account as: (1) Types explicitly
 * pinned as favorites for this account, (2) Types historically used with
 * this account, most-frequent first, (3) every other Type, in its original
 * order - so nothing is ever hidden or hard-filtered, just reordered to put
 * the most relevant options within thumb's reach first. Degrades gracefully
 * for a brand-new account with no history/favorites yet (returns the
 * original list untouched).
 * @param {string[]} allTypes - the full Types list (e.g. from Lists tab)
 * @param {string[][]} cashBookRows
 * @param {string} account
 * @param {string[]} favoriteTypes - Types pinned as favorites for this account
 * @returns {string[]}
 */
export function orderTypeOptionsForAccount(allTypes, cashBookRows, account, favoriteTypes = []) {
  if (!account) return allTypes;
  const frequency = computeTypeFrequencyForAccount(cashBookRows, account);
  const seen = new Set();
  const ordered = [];

  for (const t of favoriteTypes) {
    if (allTypes.includes(t) && !seen.has(t)) { ordered.push(t); seen.add(t); }
  }
  for (const t of frequency.keys()) {
    if (allTypes.includes(t) && !seen.has(t)) { ordered.push(t); seen.add(t); }
  }
  for (const t of allTypes) {
    if (!seen.has(t)) { ordered.push(t); seen.add(t); }
  }
  return ordered;
}

/**
 * Type-level spending breakdown (Money OUT only - "where did my money go")
 * for a given month, for the Monthly page's pie chart.
 * @param {string[][]} rows - CashBook rows [Date, Desc, Account, Type, IN, OUT]
 * @param {string} month - "YYYY-MM"
 * @returns {Map<string, number>} Type -> total Money OUT for that month
 */
export function computeTypeSpendBreakdown(rows, month) {
  const result = new Map();
  for (const row of rows) {
    if (!(row[0] || '').startsWith(month)) continue;
    const moneyOut = parseFloat(row[5]) || 0;
    if (moneyOut <= 0) continue;
    const type = row[3] || '(none)';
    result.set(type, (result.get(type) || 0) + moneyOut);
  }
  return result;
}

/**
 * Sub-category spending breakdown (Money OUT only) within one Type, for a
 * given month - the pie chart's drill-down view.
 * @param {string[][]} rows - CashBook rows [..., Type(3), IN(4), OUT(5), Project(6), SubCategory(7)]
 * @param {string} month - "YYYY-MM"
 * @param {string} type - the Type to drill into
 * @returns {Map<string, number>} SubCategory -> total Money OUT (uses "(uncategorized)" for entries with no sub-category)
 */
export function computeSubCategorySpendBreakdown(rows, month, type) {
  const result = new Map();
  for (const row of rows) {
    if (!(row[0] || '').startsWith(month)) continue;
    if ((row[3] || '') !== type) continue;
    const moneyOut = parseFloat(row[5]) || 0;
    if (moneyOut <= 0) continue;
    const subCategory = row[7] || '(uncategorized)';
    result.set(subCategory, (result.get(subCategory) || 0) + moneyOut);
  }
  return result;
}

/**
 * Account spending breakdown (Money OUT only) for a given month - the
 * Actual Breakdown pie chart's alternate top-level grouping (Account
 * instead of Type), so "which accounts did the month's spend come out of"
 * can be answered directly instead of only "which categories".
 * @param {string[][]} rows - CashBook rows [..., Account(2), Type(3), IN(4), OUT(5)]
 * @param {string} month - "YYYY-MM"
 * @returns {Map<string, number>} Account -> total Money OUT for that month
 */
export function computeAccountSpendBreakdown(rows, month) {
  const result = new Map();
  for (const row of rows) {
    if (!(row[0] || '').startsWith(month)) continue;
    const moneyOut = parseFloat(row[5]) || 0;
    if (moneyOut <= 0) continue;
    const account = row[2] || '(none)';
    result.set(account, (result.get(account) || 0) + moneyOut);
  }
  return result;
}

/**
 * Type spending breakdown (Money OUT only) within one Account, for a given
 * month - the drill-down view when the Actual Breakdown pie is grouped by
 * Account (see computeAccountSpendBreakdown): tapping an account slice
 * (e.g. "W-HDFC") shows which Types made up that account's spend.
 * @param {string[][]} rows - CashBook rows [..., Account(2), Type(3), IN(4), OUT(5)]
 * @param {string} month - "YYYY-MM"
 * @param {string} account - the Account to drill into
 * @returns {Map<string, number>} Type -> total Money OUT for that account+month
 */
export function computeTypeSpendBreakdownForAccount(rows, month, account) {
  const result = new Map();
  for (const row of rows) {
    if (!(row[0] || '').startsWith(month)) continue;
    if ((row[2] || '') !== account) continue;
    const moneyOut = parseFloat(row[5]) || 0;
    if (moneyOut <= 0) continue;
    const type = row[3] || '(none)';
    result.set(type, (result.get(type) || 0) + moneyOut);
  }
  return result;
}

/**
 * Account spending breakdown (Money OUT only) within one Type, for a given
 * month - an alternate drill-down for the Type-grouped Actual Breakdown pie,
 * alongside the existing Sub-category drill-down (computeSubCategorySpendBreakdown).
 * Lets "which account did this category's spend come out of" be answered
 * without switching the whole chart to Account-grouped mode.
 * @param {string[][]} rows - CashBook rows [..., Account(2), Type(3), IN(4), OUT(5)]
 * @param {string} month - "YYYY-MM"
 * @param {string} type - the Type to drill into
 * @returns {Map<string, number>} Account -> total Money OUT for that type+month
 */
export function computeAccountSpendBreakdownForType(rows, month, type) {
  const result = new Map();
  for (const row of rows) {
    if (!(row[0] || '').startsWith(month)) continue;
    if ((row[3] || '') !== type) continue;
    const moneyOut = parseFloat(row[5]) || 0;
    if (moneyOut <= 0) continue;
    const account = row[2] || '(none)';
    result.set(account, (result.get(account) || 0) + moneyOut);
  }
  return result;
}

/**
 * Category-level Planned breakdown for a month, for the Monthly page's
 * "Planned" pie chart (a companion to computeTypeSpendBreakdown's "Actual"
 * pie) - sums PlannedAmount by Category. Unlike the Actual breakdown, this
 * doesn't need to touch CashBook at all: Monthly Plans are already
 * category-keyed, so it's a plain group-and-sum over already-parsed plan
 * objects for the month (see useMonthly.jsx), not raw sheet rows.
 * @param {{ category: string, plannedAmount: number }[]} monthPlans - plans already filtered to one month
 * @returns {Map<string, number>} Category -> total Planned Amount
 */
export function computePlannedBreakdown(monthPlans) {
  const result = new Map();
  for (const plan of monthPlans) {
    if (!plan.category) continue;
    result.set(plan.category, (result.get(plan.category) || 0) + (plan.plannedAmount || 0));
  }
  return result;
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
    // A bill-payment Transfer's incoming leg (settling the card's balance
    // back up, see ObligationsPage.jsx's handleSaveBill) also lands on
    // this account - excluding it here keeps this purely a projection of
    // *new purchases/refunds* since the last statement, not muddied by a
    // payment that isn't a real refund (it's just moving money already
    // counted as spend under whatever category the original purchase used).
    if ((row[3] || '') === 'TRANSFER') continue;
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

