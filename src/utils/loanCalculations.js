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
 * @param {number} principal
 * @param {number} annualRate
 * @param {number} tenureMonths
 * @returns {{ month: number, emi: number, interest: number, principal: number, balance: number }[]}
 */
export function buildAmortizationSchedule(principal, annualRate, tenureMonths) {
  const r = annualRate / 12 / 100;
  const emi = calculateEMI(principal, annualRate, tenureMonths);
  const schedule = [];
  let balance = principal;

  for (let month = 1; month <= tenureMonths; month++) {
    const interest = balance * r;
    let principalComponent = emi - interest;
    // Zero out rounding residue on the final installment.
    if (month === tenureMonths || principalComponent > balance) {
      principalComponent = balance;
    }
    balance = Math.max(balance - principalComponent, 0);
    schedule.push({
      month,
      emi: month === tenureMonths ? interest + principalComponent : emi,
      interest,
      principal: principalComponent,
      balance,
    });
  }

  return schedule;
}

/**
 * Computes the current status of an EMI loan as of a given date, assuming
 * on-time monthly payments since startDate: how many installments have
 * elapsed, totals paid so far, and the outstanding balance.
 * @param {{ principal: number, annualRate: number, tenureMonths: number, startDate: string }} loan
 * @param {string|Date} asOfDate
 */
export function computeEMIStatus(loan, asOfDate = new Date()) {
  const { principal, annualRate, tenureMonths } = loan;
  const start = new Date(loan.startDate);
  const now = new Date(asOfDate);

  const monthsElapsed = Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  );
  const installmentsPaid = Math.min(monthsElapsed, tenureMonths);

  const schedule = buildAmortizationSchedule(principal, annualRate, tenureMonths);
  const paidRows = schedule.slice(0, installmentsPaid);

  const totalInterestPaid = paidRows.reduce((sum, row) => sum + row.interest, 0);
  const totalPrincipalPaid = paidRows.reduce((sum, row) => sum + row.principal, 0);
  const outstandingBalance = installmentsPaid > 0
    ? schedule[installmentsPaid - 1].balance
    : principal;

  const emi = calculateEMI(principal, annualRate, tenureMonths);
  const totalInterestPayable = schedule.reduce((sum, row) => sum + row.interest, 0);

  return {
    emi,
    installmentsPaid,
    installmentsRemaining: tenureMonths - installmentsPaid,
    totalInterestPaid,
    totalPrincipalPaid,
    outstandingBalance,
    totalInterestPayable,
    isComplete: installmentsPaid >= tenureMonths,
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
