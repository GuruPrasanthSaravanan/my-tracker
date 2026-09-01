import { useState } from 'react';
import { useAppData } from '../contexts/DataContext';
import { computeCombinedProjectSpend, computeTypicalIncomeExpenses, computeRemainingPlannedOutflow } from '../utils/aggregations';
import { projectPayoffPlan } from '../utils/debtAvalancheProjection';
import { formatCurrency, getTodayISO } from '../utils/formatters';
import LoadingSkeleton from '../components/LoadingSkeleton';
import TemplateManager from '../components/TemplateManager';
import PriorityOrderManager from '../components/PriorityOrderManager';
import Toast from '../components/Toast';
import { Settings2 } from 'lucide-react';

/**
 * "Oct 2026" - month and year only, no day. Used for the Debt Payoff
 * Trajectory's projected dates, where the day-of-month is just whatever
 * the simulation's internal date arithmetic landed on (it keeps today's
 * day-of-month for every projected month) and isn't meaningful to show.
 */
function formatMonthYear(dateStr) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleString('en', { month: 'short', year: 'numeric' });
}

/**
 * Projections - a dedicated page, deliberately separate from Monthly.
 * Monthly answers "what's moving in/out of my accounts this specific
 * month" (a cash-flow-timing view, where a Credit Card bill payment or a
 * one-off Project expense are both legitimate real entries). Projections
 * answers a different question - "at my *typical* pace, when will I be
 * debt-free" - which needs a stable assumption, not whatever this month's
 * Monthly Plan happens to say (a month with an unusual one-off expense or
 * irregular income would otherwise skew a multi-year projection).
 *
 * That "typical" figure is derived from the Monthly Template, not a
 * separately-maintained number - the Template already represents "what's
 * typical" (it's what pre-fills a brand-new month), so this is "derive,
 * don't duplicate" rather than a second place to keep in sync. Managing
 * the Template is available right here too, so there's no need to hop
 * over to Monthly just to update it. See bugs-and-lessons.md.
 */
export default function ProjectionsPage() {
  const {
    handLoans, emiLoans, projects, vendors, cashBook, chitFunds,
    accountSettings, creditCards, monthly, lists,
  } = useAppData();

  const [showTemplate, setShowTemplate] = useState(false);
  const [toast, setToast] = useState(null);
  const notify = (message, type = 'success') => setToast({ message, type });

  const categoryOptions = lists.lists.types || [];
  const handleAddCategory = (value) => lists.addListItem('types', value);
  const accountOptions = lists.lists.accounts || [];
  const handleAddAccount = (value) => lists.addListItem('accounts', value);

  const handleSaveTemplateItem = async (existing, entry) => {
    try {
      if (existing) {
        await monthly.editTemplateItem(existing._rowIndex, entry);
      } else {
        await monthly.addTemplateItem(entry);
      }
      notify('Template updated!');
    } catch {
      notify('Failed to save template item.', 'error');
    }
  };

  const handleDeleteTemplateItem = async (existing) => {
    try {
      await monthly.deleteTemplateItem(existing._rowIndex);
      notify('Removed from template.');
    } catch {
      notify('Failed to remove.', 'error');
    }
  };

  const { income: typicalIncome, expenses: typicalExpenses } = computeTypicalIncomeExpenses(monthly.template);
  const typicalSurplus = typicalIncome - typicalExpenses;

  // Only items with a Payoff Priority set participate (see
  // debtAvalancheProjection.js / bugs-and-lessons.md §44). Lend-direction
  // Hand Loans are excluded here (not the engine's job) - this projection
  // is about paying down obligations/funding commitments, not chasing
  // repayment of money lent out.
  const payoffHandLoans = handLoans.debts
    .filter((l) => l.status !== 'Closed' && l.payoffPriority != null)
    .map((l) => {
      const state = handLoans.getLoanState(l);
      return {
        name: l.name, priority: l.payoffPriority,
        outstandingPrincipal: state.outstandingPrincipal,
        accruedInterestSoFar: state.accruedInterest,
        annualRate: l.annualRate,
      };
    });
  const payoffEMILoans = emiLoans.loans
    .filter((l) => l.status !== 'Closed' && !l.emiStatus?.isComplete && l.payoffPriority != null)
    .map((l) => ({
      name: l.name, priority: l.payoffPriority,
      outstandingBalance: l.emiStatus?.outstandingBalance ?? l.principal,
      annualRate: l.annualRate, emi: l.emiStatus?.emi ?? 0,
      remainingMonths: l.emiStatus?.installmentsRemaining ?? 0,
    }));
  const payoffProjects = projects.projects
    .filter((p) => p.status !== 'Completed' && !p.endDateActual && p.payoffPriority != null)
    .map((p) => ({
      name: p.name || p.code, priority: p.payoffPriority,
      remainingBudget: Math.max(0, p.budget - computeCombinedProjectSpend(vendors.rows, cashBook.rows, p.code)),
      endDatePlanned: p.endDatePlanned || null,
    }));
  // Chit Funds don't get a Payoff Priority or join the priority-ordered
  // list themselves - they only ever *free up* surplus once their known
  // remaining contribution months elapse (see debtAvalancheProjection.js's
  // activeChits doc for why winning/maturity timing is still excluded).
  const activeChits = chitFunds.chits
    .filter((c) => c.status !== 'Closed' && !c.isComplete)
    .map((c) => ({ name: c.name, monthlyContribution: c.monthlyContribution, monthsRemaining: c.monthsRemaining }));
  // One-time starting lump sum for month 1 only: current balance sitting
  // above each account's own Min Balance buffer (the exact same
  // `balance - minBalance` pattern computeUpcomingEMIFundingWarnings
  // already uses), MINUS whatever this month's Monthly Plan still expects
  // to spend but hasn't yet - money sitting in an account today isn't all
  // "free" for debt payoff if some of it is already earmarked for this
  // month's still-pending rent/groceries/EMI/etc. that just hasn't
  // happened as a CashBook entry yet. Distinct from the recurring
  // typicalSurplus below (that's *next* month onward; this is *this*
  // month's already-committed-but-not-yet-spent remainder).
  const currentMonth = getTodayISO().slice(0, 7);
  const remainingPlannedOutflow = computeRemainingPlannedOutflow(monthly.plans, cashBook.rows, currentMonth);
  const startingLumpSum = Math.max(0, Array.from(cashBook.accountBalances.entries())
    .reduce((sum, [account, balance]) => sum + Math.max(0, balance - (accountSettings.minBalances.get(account) || 0)), 0)
    - remainingPlannedOutflow);
  // Credit Cards otherwise never appear in this projection at all (assumed
  // always paid in full monthly, per the original design) - but an
  // already-billed, not-yet-paid statement is a real, already-committed
  // near-term outflow, not a hypothetical one, so its remaining amount is
  // deducted from whichever month it's actually due in (never repeated,
  // and never turns into a priority-ordered target the way Hand/EMI Loans
  // and Projects are - it's a one-time pool reduction, nothing more).
  const oneTimeExpenses = creditCards.cards
    .filter((c) => c.latestBill && c.outstanding > 0)
    .map((c) => ({ name: `${c.name} bill`, amount: c.outstanding, dueDate: c.latestBill.dueDate }));
  const hasPayoffItems = payoffHandLoans.length > 0 || payoffEMILoans.length > 0 || payoffProjects.length > 0;
  const payoffPlan = hasPayoffItems
    ? projectPayoffPlan({
        handLoans: payoffHandLoans, emiLoans: payoffEMILoans, projects: payoffProjects, activeChits, oneTimeExpenses,
        monthlySurplus: Math.max(0, typicalSurplus), startingLumpSum, startDate: getTodayISO(),
      })
    : null;

  if (handLoans.isLoading || emiLoans.isLoading || projects.isLoading || monthly.isLoading) {
    return <LoadingSkeleton rows={4} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold">Projections</h1>
        <button onClick={() => setShowTemplate(true)} className="text-xs text-gray-500 font-medium flex items-center gap-1">
          <Settings2 size={14} /> Manage Template
        </button>
      </div>

      {/* Typical Monthly Income/Expenses - derived live from the Monthly
          Template (see module docstring above), not a separately-typed
          number. Editing it means editing the Template, via the button
          above - kept in one place rather than two. */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">Typical Monthly Surplus</h2>
        <p className="text-xs text-gray-400 mb-3">
          Derived from your Monthly Template - tap "Manage Template" above to update it.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500">Income</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(typicalIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Expenses</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(typicalExpenses)}</p>
          </div>
          <div className="col-span-2 border-t border-gray-100 pt-2">
            <p className="text-xs text-gray-500">Surplus available for debt payoff</p>
            <p className={`text-xl font-bold ${typicalSurplus >= 0 ? 'text-primary' : 'text-danger'}`}>
              {formatCurrency(typicalSurplus)}/month
            </p>
          </div>
        </div>
      </div>

      <PriorityOrderManager handLoans={handLoans} emiLoans={emiLoans} projects={projects} />

      {/* Debt Payoff Trajectory - always renders the card itself (not
          hidden entirely behind hasPayoffItems) so the feature stays
          discoverable even before anything has been opted in - see
          bugs-and-lessons.md §44. */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-1">Debt Payoff Trajectory</h2>

        {!hasPayoffItems || !payoffPlan ? (
          <p className="text-sm text-gray-400 mt-2">
            Set a Payoff Priority on a Hand Loan, EMI Loan, or Project (edit it, look for the "Payoff Priority"
            field) to include it here and see when it's projected to clear.
          </p>
        ) : (
          <>
            <div className="space-y-0.5 mt-2 mb-3">
              <p className="text-xs text-gray-400">
                Assumes {formatCurrency(Math.max(0, typicalSurplus))}/month (your Typical Monthly Surplus above) stays constant.
              </p>
              {startingLumpSum > 0 && (
                <p className="text-xs text-gray-400">
                  Plus a one-time {formatCurrency(startingLumpSum)} from current balances above each account's
                  Min Balance{remainingPlannedOutflow > 0 ? ` (after setting aside ${formatCurrency(remainingPlannedOutflow)} this month's Plan still expects to spend)` : ''},
                  applied this month only.
                </p>
              )}
              {activeChits.length > 0 && (
                <p className="text-xs text-gray-400">
                  Also assumes {activeChits.map((c) => c.name).join(', ')}'s contribution joins this pool once it
                  ends (not its win/maturity amount or timing, which can't be predicted).
                </p>
              )}
              {oneTimeExpenses.length > 0 && (
                <p className="text-xs text-gray-400">
                  Reserves {oneTimeExpenses.map((e) => `${formatCurrency(e.amount)} for ${e.name}`).join(', ')} in
                  its due month(s), since Credit Cards are otherwise assumed always paid in full.
                </p>
              )}
            </div>

            {payoffPlan.neverCompletes ? (
              <p className="text-sm text-danger">Does not clear within {payoffPlan.months.length} months at this pace.</p>
            ) : (
              <div className="space-y-1 mb-3">
                {payoffPlan.milestones
                  .slice()
                  .sort((a, b) => a.clearedMonth - b.clearedMonth)
                  .map((m) => (
                    <p key={m.itemName} className="text-sm text-gray-700">
                      <span className="font-medium text-gray-900">{m.itemName}</span> clears: Month {m.clearedMonth} ({formatMonthYear(m.clearedDate)})
                    </p>
                  ))}
                <p className="text-sm font-semibold text-success">
                  All cleared: Month {payoffPlan.allClearMonth} ({formatMonthYear(payoffPlan.months[payoffPlan.allClearMonth - 1].date)})
                </p>
              </div>
            )}

            <details className="mt-2">
              <summary className="text-xs text-primary font-medium cursor-pointer">Show full month-by-month table</summary>
              <div className="mt-2 max-h-80 overflow-y-auto space-y-3">
                {payoffPlan.months.map((month, i) => (
                  <div key={i} className="border-b border-gray-100 pb-2">
                    <p className="text-xs font-semibold text-gray-500">Month {i + 1} - {formatMonthYear(month.date)}</p>
                    {Object.entries(month.extraPaymentApplied).map(([name, amt]) => (
                      <p key={name} className="text-xs text-gray-600 flex justify-between">
                        <span>{name}: +{formatCurrency(amt)} applied</span>
                        <span>{formatCurrency(month.remaining[name] || 0)} left</span>
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          </>
        )}
      </div>

      {showTemplate && (
        <TemplateManager
          template={monthly.template}
          categoryOptions={categoryOptions}
          onAddCategory={handleAddCategory}
          accountOptions={accountOptions}
          onAddAccount={handleAddAccount}
          onSave={handleSaveTemplateItem}
          onDelete={handleDeleteTemplateItem}
          onClose={() => setShowTemplate(false)}
        />
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
