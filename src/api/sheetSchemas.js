/**
 * Central registry of every tab this app reads/writes, with its header row.
 * Used by `ensureTabsExist` (see sheets.js) to auto-provision any missing tab
 * on app load, so the user never has to manually create a tab in the Google
 * Sheets UI - see bugs-and-lessons.md §6/§9 for why this matters.
 */
export const SHEET_SCHEMAS = {
  Lists: ['Accounts', 'Types', 'Vendors', 'Projects', 'MilestoneStatuses'],
  CashBook: ['Date', 'Description', 'Account', 'Type', 'Money IN', 'Money OUT', 'Project', 'SubCategory'],
  Vendors: ['Date', 'Vendor', 'Description', 'Project', 'Bill', 'Paid'],
  Projects: [
    'Code', 'Name', 'Budget', 'Est.Labour', 'Est.Material', 'Est.Machine', 'Est.Other',
    'StartDate', 'EndDatePlanned', 'EndDateActual', 'Manager', 'Status', 'Notes', 'PayoffPriority',
  ],
  Milestones: ['Project', 'Milestone', 'PlannedDate', 'ActualDate', 'Status', 'Notes'],
  EMILoans: ['Name', 'Principal', 'AnnualRate', 'TenureMonths', 'StartDate', 'DebitsFrom', 'Status', 'Notes', 'EMIDate', 'ActualEMI', 'PayoffPriority'],
  EMIPrepayments: ['LoanName', 'Date', 'Amount', 'Notes'],
  HandLoans: ['Name', 'Principal', 'AnnualRate', 'StartDate', 'Direction', 'DebitsFrom', 'Status', 'Notes', 'PayoffPriority'],
  HandLoanPayments: ['LoanName', 'Date', 'Amount', 'InterestPaid', 'PrincipalPaid', 'RemainingPrincipal'],
  CreditCards: ['Name', 'CreditLimit', 'InterestRateMonthly', 'DebitsFrom', 'Status', 'Notes'],
  CreditCardBills: ['CardName', 'StatementDate', 'DueDate', 'TotalAmountDue', 'MinimumAmountDue', 'PaymentMade', 'PaymentDate', 'Notes', 'IsEstimated'],
  AccountSettings: ['Account', 'MinBalance', 'AccountNumber', 'IFSC', 'Branch', 'AccountType', 'Purpose', 'RMName', 'RMContact'],
  MonthlyPlans: ['Month', 'Category', 'PlannedAmount', 'Section', 'Account', 'ToAccount'],
  MonthlyTemplate: ['Category', 'Section', 'DefaultPlannedAmount', 'Account', 'ToAccount'],
  NetWorthSnapshots: ['Date', 'AssetsTotal', 'LiabilitiesTotal', 'Notes'],
  AccountTypeFavorites: ['Account', 'Type'],
  SubCategories: ['Type', 'SubCategory'],
  ChitFunds: ['Name', 'TotalValue', 'MonthlyContribution', 'DurationMonths', 'StartDate', 'ForemanCommissionPercent', 'DebitsFrom', 'Status', 'Notes'],
  ChitFundMonths: ['ChitName', 'Month', 'ContributionPaid', 'DividendReceived', 'IsPrizedMonth', 'PrizeAmountReceived', 'Notes'],
  // Single-row settings tab for the Projections page - a stable, manually-set
  // "typical" monthly figure, deliberately decoupled from whatever this
  // specific month's Monthly Plan happens to say (which can be skewed by a
  // one-off Project expense or irregular income) - see bugs-and-lessons.md.
  ProjectionSettings: ['TypicalMonthlyIncome', 'TypicalMonthlyExpenses'],
};
