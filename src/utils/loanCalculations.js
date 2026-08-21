/**
 * Loan calculation utilities for two distinct Indian loan models:
 *
 * 1. EMI loans (reducing-balance / diminishing-balance amortization) - used
 *    for bank term loans (home/land/personal/car). A fixed monthly EMI is
 *    paid every month; each installment splits into an interest component
 *    (computed on the outstanding balance) and a principal component, with
 *    interest front-loaded and shrinking as the balance reduces.
 *
 * 2. Hand/gold loans (simple interest, bullet repayment) - informal loans
 *    from friends/relatives, or gold-loan NBFCs. Interest is simple (not
 *    compounded), accrues on the outstanding principal, and is typically
 *    settled at yearly renewal or loan closure rather than monthly. Partial
 *    principal repayments reduce the principal that future interest accrues
 *    on, but do not retroactively change interest already accrued.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Standard reducing-balance EMI formula.
 * @param {number} principal
 * @param {number} annualRate - annual interest rate as a percentage (e.g. 12 for 12%)
 * @param {number} tenureMonths
 * @returns {number} the fixed monthly EMI amount
 */
export function calculateEMI(principal, annualRate, tenureMonths) {
  const r = annualRate / 12 / 100;
  if (r === 0) return principal / tenureMonths;
  const factor = Math.pow(1 + r, tenureMonths);
  return (principal * r * factor) / (factor - 1);
}

/**
 * Builds the full month-by-month amortization schedule for an EMI loan.
 * Stops early (before tenureMonths) if extra/part-payments pay off the
 * balance ahead of schedule.
 * @param {number} principal
 * @param {number} annualRate
 * @param {number} tenureMonths
 * @param {Object<number, number>} extraPaymentsByMonth - optional map of
 *   1-based month number -> extra amount paid toward principal that month
 *   (on top of the regular EMI), e.g. a part-payment/prepayment.
 * @param {number} [emiOverride] - use this exact EMI amount instead of the
 *   theoretically calculated one. Banks often round the EMI to a clean
 *   number, so the amount actually billed can differ slightly from the pure
 *   formula result - pass the real EMI here to match your statements exactly.
 * @returns {{ month: number, emi: number, interest: number, principal: number, extraPayment: number, balance: number }[]}
 */
export function buildAmortizationSchedule(principal, annualRate, tenureMonths, extraPaymentsByMonth = {}, emiOverride = null) {
  const r = annualRate / 12 / 100;
  const emi = emiOverride || calculateEMI(principal, annualRate, tenureMonths);
  const schedule = [];
  let balance = principal;

  for (let month = 1; month <= tenureMonths && balance > 0.01; month++) {
    const interest = balance * r;
    // Guard against a manually-entered actual EMI that's lower than the
    // month's interest (would otherwise grow the balance, which this
    // reducing-balance model doesn't support) - treat it as interest-only.
    let principalComponent = Math.max(emi - interest, 0);
    // Zero out rounding residue on the final installment.
    if (month === tenureMonths || principalComponent > balance) {
      principalComponent = balance;
    }
    balance = Math.max(balance - principalComponent, 0);

    // Apply any extra/part-payment for this month, entirely toward principal
    // (the regular EMI above already covers this month's interest).
    const extra = extraPaymentsByMonth[month] || 0;
    const extraApplied = extra > 0 ? Math.min(extra, balance) : 0;
    balance = Math.max(balance - extraApplied, 0);

    const isFinalRow = balance <= 0.01;
    schedule.push({
      month,
      emi: isFinalRow ? interest + principalComponent + extraApplied : emi,
      interest,
      principal: principalComponent + extraApplied,
      extraPayment: extraApplied,
      balance,
    });
  }

  return schedule;
}

/**
 * Number of EMI installments that have actually occurred between a loan's
 * start date and a given date, given the fixed day-of-month the EMI is
 * debited (`emiDate`). Counting by calendar month alone (ignoring the day)
 * over- or under-counts near month boundaries - e.g. a loan taken on the
 * 28th with an EMI date of the 5th shouldn't count that first month until
 * the 5th has actually passed. Falls back to the start date's own
 * day-of-month if no explicit `emiDate` is given.
 * @param {string|Date} startDate
 * @param {string|Date} asOfDate
 * @param {number} [emiDate] - day of month (1-31) the EMI is debited
 */
export function countElapsedInstallments(startDate, asOfDate, emiDate) {
  const start = new Date(startDate);
  const now = new Date(asOfDate);
  const day = emiDate || start.getDate();

  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < day) {
    months -= 1;
  }
  return Math.max(0, months);
}

/**
 * Computes the current status of an EMI loan as of a given date, assuming
 * on-time monthly payments since startDate: how many installments have
 * elapsed, totals paid so far, and the outstanding balance. Optionally takes
 * a list of extra/part-payments which accelerate payoff (see
 * buildAmortizationSchedule), an `emiDate` (day of month the EMI is
 * debited, for more precise installment counting), and an `actualEMI`
 * override to match the exact amount your bank bills (which may be rounded
 * slightly differently from the pure formula result).
 * @param {{ principal: number, annualRate: number, tenureMonths: number, startDate: string, emiDate?: number, actualEMI?: number }} loan
 * @param {string|Date} asOfDate
 * @param {{ date: string, amount: number }[]} extraPayments
 */
export function computeEMIStatus(loan, asOfDate = new Date(), extraPayments = []) {
  const { principal, annualRate, tenureMonths } = loan;
  const start = new Date(loan.startDate);

  const monthsElapsed = countElapsedInstallments(loan.startDate, asOfDate, loan.emiDate);

  // Convert each extra payment's date into a 1-based month offset from the
  // loan start date, so it lands in the correct row of the schedule.
  const extraPaymentsByMonth = {};
  for (const p of extraPayments) {
    const pDate = new Date(p.date);
    const monthOffset = Math.max(
      1,
      (pDate.getFullYear() - start.getFullYear()) * 12 + (pDate.getMonth() - start.getMonth()) + 1
    );
    extraPaymentsByMonth[monthOffset] = (extraPaymentsByMonth[monthOffset] || 0) + p.amount;
  }

  const schedule = buildAmortizationSchedule(principal, annualRate, tenureMonths, extraPaymentsByMonth, loan.actualEMI || null);
  // The schedule may be shorter than tenureMonths if prepayments closed it early.
  const installmentsPaid = Math.min(monthsElapsed, schedule.length);

  const paidRows = schedule.slice(0, installmentsPaid);
  const totalInterestPaid = paidRows.reduce((sum, row) => sum + row.interest, 0);
  const totalPrincipalPaid = paidRows.reduce((sum, row) => sum + row.principal, 0);
  const outstandingBalance = installmentsPaid > 0
    ? schedule[installmentsPaid - 1].balance
    : principal;

  const emi = loan.actualEMI || calculateEMI(principal, annualRate, tenureMonths);
  const totalInterestPayable = schedule.reduce((sum, row) => sum + row.interest, 0);
  const totalExtraPaid = extraPayments.reduce((sum, p) => sum + p.amount, 0);

  // Next EMI due date = start date + installmentsPaid months, pinned to the
  // configured EMI day-of-month (or the start date's day if none was given).
  const nextDueDate = new Date(start);
  if (loan.emiDate) nextDueDate.setDate(loan.emiDate);
  nextDueDate.setMonth(nextDueDate.getMonth() + installmentsPaid);

  return {
    emi,
    installmentsPaid,
    installmentsRemaining: schedule.length - installmentsPaid,
    effectiveTenureMonths: schedule.length, // may be < tenureMonths if prepaid early
    originalTenureMonths: tenureMonths,
    totalInterestPaid,
    totalPrincipalPaid,
    totalExtraPaid,
    outstandingBalance,
    totalInterestPayable,
    isComplete: outstandingBalance <= 0.01,
    nextDueDate: outstandingBalance > 0.01 ? nextDueDate.toISOString().split('T')[0] : null,
  };
}

/**
 * Simple interest accrued on a principal over a date range.
 * Interest = Principal * AnnualRate * (days / 365). No compounding.
 * @param {number} principal
 * @param {number} annualRate - percentage (e.g. 9 for 9%)
 * @param {string|Date} fromDate
 * @param {string|Date} toDate
 * @param {number} dayCountBasis - defaults to 365 (standard for Indian gold-loan NBFCs)
 */
export function computeSimpleInterestAccrued(principal, annualRate, fromDate, toDate, dayCountBasis = 365) {
  if (!annualRate) return 0;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const days = Math.max(0, (to.getTime() - from.getTime()) / MS_PER_DAY);
  return principal * (annualRate / 100) * (days / dayCountBasis);
}

/**
 * Present value of an annuity - back-solves the outstanding principal that
 * would require exactly `remainingMonths` of `emi` payments at `annualRate`
 * to fully amortize. Useful when migrating a legacy loan where only the
 * current EMI amount and remaining tenure/end date are known (not the
 * original principal or start date).
 * @param {number} emi
 * @param {number} annualRate
 * @param {number} remainingMonths
 */
export function presentValueOfAnnuity(emi, annualRate, remainingMonths) {
  const r = annualRate / 12 / 100;
  if (r === 0) return emi * remainingMonths;
  return emi * (1 - Math.pow(1 + r, -remainingMonths)) / r;
}

/**
 * Splits a payment amount between interest due and principal, applying
 * interest first (standard practice for both bank and informal loans).
 * @param {number} paymentAmount
 * @param {number} interestDue - accrued interest owed at the time of payment
 * @returns {{ interestPaid: number, principalPaid: number, remainingInterestDue: number }}
 */
export function splitPayment(paymentAmount, interestDue) {
  const interestPaid = Math.min(paymentAmount, interestDue);
  const principalPaid = Math.max(paymentAmount - interestDue, 0);
  const remainingInterestDue = Math.max(interestDue - paymentAmount, 0);
  return { interestPaid, principalPaid, remainingInterestDue };
}

// ---------------------------------------------------------------------------
// Credit Card billing (Indian bank conventions: HDFC/ICICI/Axis/SBI etc.)
// ---------------------------------------------------------------------------

/**
 * Computes the Minimum Amount Due (MAD) for a credit card bill.
 * Standard Indian bank formula: ~5% of the revolving balance (excluding
 * fixed EMI/fee components, which are billed at 100%), plus any overlimit
 * amount, floored at a small minimum amount.
 * @param {{ totalAmountDue: number, emiComponent?: number, overlimitAmount?: number }} bill
 * @param {number} minDuePercent - defaults to 5 (%)
 * @param {number} floorAmount - defaults to 200 (₹)
 */
export function computeMinimumDue(bill, minDuePercent = 5, floorAmount = 200) {
  const emiComponent = bill.emiComponent || 0;
  const overlimitAmount = bill.overlimitAmount || 0;
  const revolvingBalance = Math.max(bill.totalAmountDue - emiComponent - overlimitAmount, 0);

  const mad = Math.max((revolvingBalance * minDuePercent) / 100, floorAmount) + emiComponent + overlimitAmount;
  // Clamp to [0, totalAmountDue] - a negative totalAmountDue (credit balance from an
  // overpayment/refund) should never produce a negative minimum due.
  return Math.max(Math.min(Math.round(mad), bill.totalAmountDue), 0);
}

/**
 * Projects how long it will take to pay off a credit card balance, and the
 * total interest paid, if only a percentage-of-balance minimum payment is
 * made each month (standard "minimum due" trap simulation used by
 * BankBazaar/Paisabazaar/CRED-style calculators).
 * @param {number} outstanding - current balance to pay off
 * @param {number} monthlyRatePercent - monthly interest rate as a percentage (e.g. 3.5 for 3.5%/month)
 * @param {number} minDuePercent - percentage of balance charged as minimum due each month (default 5)
 * @param {number} floorAmount - minimum payment floor (default 200)
 * @param {number} maxMonths - safety cap to avoid infinite loops (default 600 = 50 years)
 * @returns {{ monthsToPayoff: number|null, totalInterestPaid: number, schedule: object[], neverPaysOff: boolean }}
 */
export function projectCreditCardPayoff(outstanding, monthlyRatePercent, minDuePercent = 5, floorAmount = 200, maxMonths = 600) {
  const monthlyRate = monthlyRatePercent / 100;
  const minRate = minDuePercent / 100;

  // If the minimum-due percentage doesn't even cover the monthly interest
  // rate, the balance will never reduce - flag this instead of looping forever.
  if (minRate <= monthlyRate) {
    return { monthsToPayoff: null, totalInterestPaid: 0, schedule: [], neverPaysOff: true };
  }

  let balance = outstanding;
  let totalInterest = 0;
  let months = 0;
  const schedule = [];

  while (balance > 1 && months < maxMonths) {
    const interest = balance * monthlyRate;
    const balanceWithInterest = balance + interest;
    let payment = Math.max(minRate * balanceWithInterest, floorAmount);
    payment = Math.min(payment, balanceWithInterest);

    const openingBalance = balance;
    balance = balanceWithInterest - payment;
    totalInterest += interest;
    months += 1;

    schedule.push({
      month: months,
      openingBalance,
      interest,
      payment,
      closingBalance: balance,
    });
  }

  return {
    monthsToPayoff: balance <= 1 ? months : null,
    totalInterestPaid: totalInterest,
    schedule,
    neverPaysOff: balance > 1,
  };
}

/**
 * Determines whether interest is actually accruing on a credit card bill yet,
 * based on the Due Date - not just whether it's unpaid. Indian card issuers
 * (HDFC/ICICI/SBI/Axis) only withdraw the interest-free grace period if the
 * Total Amount Due is still unpaid *as of the due date*; paying part of the
 * bill before the due date does not itself trigger interest. Once the due
 * date passes without full payment, interest technically backdates to each
 * transaction's date - but since this app only tracks one aggregate
 * Total Amount Due per cycle (not per-transaction dates), we approximate by
 * accruing simple interest from the Due Date itself, prorated by the actual
 * number of days overdue (average-daily-balance style), which understates
 * true interest slightly but avoids the bigger error of charging a full
 * month's interest on day one of being overdue.
 * @param {{ totalAmountDue: number, paymentMade: number, dueDate: string }} bill
 * @param {number} monthlyRatePercent
 * @param {string|Date} asOfDate
 * @returns {{
 *   outstanding: number,
 *   isPaidInFull: boolean,
 *   interestAccruing: boolean,
 *   daysPastDue: number,
 *   accruedInterestSinceDue: number,
 *   effectiveBalance: number,
 * }}
 */
export function computeCreditCardInterestState(bill, monthlyRatePercent, asOfDate = new Date()) {
  const outstanding = Math.max((bill.totalAmountDue || 0) - (bill.paymentMade || 0), 0);

  if (outstanding <= 0) {
    return {
      outstanding: 0, isPaidInFull: true, interestAccruing: false,
      daysPastDue: 0, accruedInterestSinceDue: 0, effectiveBalance: 0,
    };
  }

  const due = new Date(bill.dueDate);
  const now = new Date(asOfDate);
  const daysPastDue = Math.max(0, Math.floor((now.getTime() - due.getTime()) / MS_PER_DAY));

  if (daysPastDue <= 0) {
    // Due date hasn't passed yet - still within the payment window, no interest yet.
    return {
      outstanding, isPaidInFull: false, interestAccruing: false,
      daysPastDue: 0, accruedInterestSinceDue: 0, effectiveBalance: outstanding,
    };
  }

  // Simple (non-compounding) daily proration for the stub period since the due date.
  const dailyRate = monthlyRatePercent / 100 / 30;
  const accruedInterestSinceDue = outstanding * dailyRate * daysPastDue;

  return {
    outstanding,
    isPaidInFull: false,
    interestAccruing: true,
    daysPastDue,
    accruedInterestSinceDue,
    effectiveBalance: outstanding + accruedInterestSinceDue,
  };
}
