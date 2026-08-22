import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../contexts/DataContext';
import {
  computeCombinedProjectSpend, computeMonthSurplus, hasEMIBeenLoggedForMonth,
  emiCashBookDescription, computeUpcomingEMIFundingWarnings,
} from '../utils/aggregations';
import { formatCurrency, formatDate, getTodayISO } from '../utils/formatters';
import ProgressBar from '../components/ProgressBar';
import Toast from '../components/Toast';
import { Plus, ArrowRight, ArrowLeftRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function DashboardPage() {
  const { cashBook, vendors, projects, emiLoans, handLoans, creditCards, accountSettings } = useAppData();
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const [loggingLoan, setLoggingLoan] = useState(null);

  const today = getTodayISO();

  // EMI installments whose due date has arrived with nothing logged for
  // this month yet. Deliberately a one-tap *manual* confirm, not a silent
  // background write - see bugs-and-lessons.md for why: a background effect
  // re-fired on every Dashboard remount and created duplicate CashBook
  // entries, and it also wrote the entry regardless of whether the account
  // actually had the funds. A discrete, user-initiated tap can't "just
  // happen" repeatedly, and gives the user the chance to check the funding
  // warning below and transfer money in first if needed.
  const dueEMIs = emiLoans.loans.filter((loan) => {
    if (loan.status === 'Closed' || !loan.debitsFrom) return false;
    const due = loan.emiStatus?.nextDueDate;
    if (!due || due > today) return false;
    return !hasEMIBeenLoggedForMonth(cashBook.rows, loan, due.slice(0, 7));
  });

  const handleLogEMI = async (loan) => {
    if (loggingLoan) return;
    setLoggingLoan(loan.name);
    try {
      await cashBook.addEntry({
        date: loan.emiStatus.nextDueDate,
        description: emiCashBookDescription(loan.name),
        account: loan.debitsFrom,
        type: 'EMI',
        moneyOut: loan.emiStatus.emi,
      });
      setToast({ message: `Logged this month's EMI for ${loan.name} (${formatCurrency(loan.emiStatus.emi)})`, type: 'success' });
    } catch {
      setToast({ message: `Failed to log ${loan.name}'s EMI. Please try again.`, type: 'error' });
    } finally {
      setLoggingLoan(null);
    }
  };

  const currentMonth = getTodayISO().slice(0, 7); // "YYYY-MM"
  const { surplus, totalIn, totalOut } = computeMonthSurplus(cashBook.rows, currentMonth);

  const totalDebtOutstanding = emiLoans.totalOutstanding + handLoans.totalOwed + creditCards.totalOutstanding;

  // Live from day 1 of the month: flags any account that won't have enough
  // balance to cover an EMI due later this month, so there's time to
  // transfer funds in before the due date arrives (and the "Due Now" card
  // above shows up asking to confirm it).
  const fundingWarnings = computeUpcomingEMIFundingWarnings(
    emiLoans.loans, cashBook.accountBalances, accountSettings.minBalances, today
  );

  const activeProjects = projects.projects.filter((p) => p.status !== 'Completed');

  // Unified "what's due next" across every source that has a real due date:
  // project milestones, EMI installments, and Credit Card bills. (Hand Loans
  // don't have a structured due date field - they're bullet-repayment loans
  // settled at renewal/closure, not on a fixed monthly schedule - see
  // bugs-and-lessons.md §9 for the EMI-vs-hand-loan distinction.)
  const dueItems = [
    ...projects.milestones
      .filter((m) => m.plannedDate && m.status !== 'Done' && m.status !== 'Cancelled')
      .map((m) => ({ type: 'Milestone', label: `${m.milestone} (${m.project})`, date: m.plannedDate, to: '/projects' })),
    ...emiLoans.loans
      .filter((l) => l.status !== 'Closed' && l.emiStatus?.nextDueDate)
      .map((l) => ({ type: 'EMI', label: `${l.name} EMI (${formatCurrency(l.emiStatus.emi)})`, date: l.emiStatus.nextDueDate, to: '/obligations' })),
    ...creditCards.cards
      .filter((c) => c.latestBill && !c.isPaidInFull)
      .map((c) => ({ type: 'Credit Card', label: `${c.name} bill (${formatCurrency(c.outstanding)})`, date: c.latestBill.dueDate, to: '/obligations' })),
  ]
    .filter((item) => item.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextDue = dueItems[0];

  // Each navigates with state that the target page reads on mount to open
  // the relevant form immediately, instead of landing on the page and
  // requiring a second tap - that's what makes these actually "quick".
  const quickActions = [
    { label: 'Add CashBook Entry', icon: Plus, onClick: () => navigate('/cashbook', { state: { openForm: true } }) },
    { label: 'Transfer Between Accounts', icon: ArrowLeftRight, onClick: () => navigate('/cashbook', { state: { openTransfer: true } }) },
    { label: 'Add Vendor Entry', icon: Plus, onClick: () => navigate('/vendors', { state: { openForm: true } }) },
    { label: 'Record Debt Payment', icon: ArrowRight, onClick: () => navigate('/obligations') },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>

      {/* Actionable items first - anything needing your attention should be
          seen before routine stats, not buried below them. */}

      {/* EMIs due now, awaiting a one-tap confirm to log into CashBook */}
      {dueEMIs.map((loan) => (
        <div key={loan.name} className="bg-amber-50 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-amber-700 font-semibold">EMI Due - {formatDate(loan.emiStatus.nextDueDate)}</p>
            <p className="text-sm text-gray-900 font-medium mt-0.5 truncate">{loan.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{formatCurrency(loan.emiStatus.emi)} from {loan.debitsFrom}</p>
          </div>
          <button onClick={() => handleLogEMI(loan)} disabled={loggingLoan === loan.name}
            className="flex items-center gap-1.5 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-60 shrink-0">
            <CheckCircle2 size={16} />
            {loggingLoan === loan.name ? 'Logging...' : 'Log Payment'}
          </button>
        </div>
      ))}

      {/* Insufficient-funds warnings for EMIs due later this month */}
      {fundingWarnings.map((w) => (
        <div key={w.account} className="bg-red-50 rounded-2xl p-4 flex items-start gap-2">
          <AlertTriangle size={18} className="text-danger shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-danger font-semibold">
              {w.account} may be short by {formatCurrency(w.shortfall)}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {w.loanNames.join(', ')} need{w.loanNames.length === 1 ? 's' : ''} {formatCurrency(w.requiredAmount)} this
              month, but {w.account}'s current balance is {formatCurrency(w.currentBalance)}.
            </p>
            {w.suggestedSourceAccount ? (
              <button
                onClick={() => navigate('/cashbook', {
                  state: {
                    openTransfer: true,
                    transferPrefill: {
                      fromAccount: w.suggestedSourceAccount, toAccount: w.account,
                      amount: Math.min(w.shortfall, w.suggestedSourceAvailable),
                      description: `${w.loanNames.join(', ')} EMI funding`,
                    },
                  },
                })}
                className="mt-2 flex items-center gap-1.5 bg-white text-danger text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm"
              >
                <ArrowLeftRight size={13} />
                Transfer {formatCurrency(Math.min(w.shortfall, w.suggestedSourceAvailable))} from {w.suggestedSourceAccount}
              </button>
            ) : (
              <p className="text-xs text-gray-500 mt-1">No other account currently has a surplus to suggest transferring from.</p>
            )}
          </div>
        </div>
      ))}

      {/* Next due (nearest of: milestone, EMI, or credit card bill) */}
      {nextDue && (
        <button onClick={() => navigate(nextDue.to)} className="w-full bg-amber-50 rounded-2xl p-4 text-left">
          <p className="text-xs text-amber-700 font-semibold">Next Due - {nextDue.type}</p>
          <p className="text-sm text-gray-900 font-medium mt-0.5">{nextDue.label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{formatDate(nextDue.date)}</p>
        </button>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-primary text-white rounded-2xl p-4">
          <p className="text-xs opacity-80">Total Balance</p>
          <p className="text-xl font-bold">{formatCurrency(cashBook.totalBalance)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Vendor Owed</p>
          <p className="text-xl font-bold text-danger">{formatCurrency(vendors.totalOwed)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total Debt Outstanding</p>
          <p className="text-xl font-bold text-danger">{formatCurrency(totalDebtOutstanding)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">EMI + Hand Loans + Credit Cards - excludes Chit Funds</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">This Month's Surplus</p>
          <p className={`text-xl font-bold ${surplus >= 0 ? 'text-success' : 'text-danger'}`}>
            {formatCurrency(surplus)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm text-sm text-gray-500 flex items-center justify-between">
        <span>Income this month: <span className="text-gray-900 font-medium">{formatCurrency(totalIn)}</span></span>
        <span>Outflow: <span className="text-gray-900 font-medium">{formatCurrency(totalOut)}</span></span>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-2">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-2">
          {quickActions.map((a) => (
            <button key={a.label} onClick={a.onClick}
              className="w-full flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm text-sm font-medium text-gray-700 active:bg-gray-50">
              <span className="flex items-center gap-2"><a.icon size={16} className="text-primary" /> {a.label}</span>
              <ArrowRight size={16} className="text-gray-300" />
            </button>
          ))}
        </div>
      </div>

      {/* Project overview */}
      {activeProjects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-500">Active Projects</h2>
            <button onClick={() => navigate('/projects')} className="text-xs text-primary font-medium">View all</button>
          </div>
          <div className="space-y-2">
            {activeProjects.slice(0, 4).map((p) => {
              const spent = computeCombinedProjectSpend(vendors.rows, cashBook.rows, p.code);
              return (
                <button key={p.code} onClick={() => navigate('/projects')}
                  className="w-full bg-white rounded-xl p-3 shadow-sm text-left">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-gray-900">{p.name || p.code}</span>
                    <span className="text-gray-500">{formatCurrency(spent)} / {formatCurrency(p.budget)}</span>
                  </div>
                  <ProgressBar value={spent} max={p.budget} showLabel={false}
                    color={spent > p.budget ? 'danger' : spent > p.budget * 0.8 ? 'amber' : 'primary'} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
