import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../contexts/DataContext';
import {
  computeProjectSpent, computeMonthSurplus, hasEMIBeenLoggedForMonth,
  emiCashBookDescription, computeUpcomingEMIFundingWarnings,
} from '../utils/aggregations';
import { formatCurrency, formatDate, getTodayISO } from '../utils/formatters';
import ProgressBar from '../components/ProgressBar';
import Toast from '../components/Toast';
import { Plus, ArrowRight, ArrowLeftRight, AlertTriangle } from 'lucide-react';

export default function DashboardPage() {
  const { cashBook, vendors, projects, emiLoans, handLoans, creditCards, accountSettings } = useAppData();
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);

  // Silently logs this month's EMI to CashBook once its due date has passed,
  // for any active loan that doesn't already have a matching entry - see
  // bugs-and-lessons.md for why this can't run in the background (no
  // server) and instead runs the moment the Dashboard is opened. Guarded by
  // a ref (set before the async work starts) so React 18 StrictMode's
  // double-invoke in dev, or a re-render before cashBook's state catches up,
  // can't fire this twice in the same mount.
  const autoLogRanRef = useRef(false);
  useEffect(() => {
    if (cashBook.isLoading || emiLoans.isLoading) return;
    if (autoLogRanRef.current) return;
    autoLogRanRef.current = true;

    const today = getTodayISO();
    const dueLoans = emiLoans.loans.filter((loan) => {
      if (loan.status === 'Closed' || !loan.debitsFrom) return false;
      const due = loan.emiStatus?.nextDueDate;
      if (!due || due > today) return false;
      return !hasEMIBeenLoggedForMonth(cashBook.rows, loan, due.slice(0, 7));
    });
    if (dueLoans.length === 0) return;

    (async () => {
      for (const loan of dueLoans) {
        try {
          await cashBook.addEntry({
            date: loan.emiStatus.nextDueDate,
            description: emiCashBookDescription(loan.name),
            account: loan.debitsFrom,
            type: 'EMI',
            moneyOut: loan.emiStatus.emi,
          });
          setToast({ message: `Auto-logged this month's EMI for ${loan.name} (${formatCurrency(loan.emiStatus.emi)})`, type: 'success' });
        } catch {
          setToast({ message: `Couldn't auto-log ${loan.name}'s EMI - please add it manually in CashBook.`, type: 'error' });
        }
      }
    })();
  }, [cashBook.isLoading, emiLoans.isLoading]);

  const currentMonth = getTodayISO().slice(0, 7); // "YYYY-MM"
  const { surplus, totalIn, totalOut } = computeMonthSurplus(cashBook.rows, currentMonth);

  const totalDebtOutstanding = emiLoans.totalOutstanding + handLoans.totalOwed + creditCards.totalOutstanding;

  // Live from day 1 of the month: flags any account that won't have enough
  // balance to cover an EMI due later this month, so there's time to
  // transfer funds in before the auto-logger fires on the due date.
  const fundingWarnings = computeUpcomingEMIFundingWarnings(
    emiLoans.loans, cashBook.accountBalances, accountSettings.minBalances, getTodayISO()
  );

  const activeProjects = projects.projects.filter((p) => p.status !== 'Completed');

  // Unified "what's due next" across every source that has a real due date:
  // project milestones, EMI installments, and Credit Card bills. (Hand Loans
  // don't have a structured due date field - they're bullet-repayment loans
  // settled at renewal/closure, not on a fixed monthly schedule - see
  // bugs-and-lessons.md §9 for the EMI-vs-hand-loan distinction.)
  const today = getTodayISO();
  const dueItems = [
    ...projects.milestones
      .filter((m) => m.plannedDate && m.status !== 'Done' && m.status !== 'Cancelled')
      .map((m) => ({ type: 'Milestone', label: `${m.milestone} (${m.project})`, date: m.plannedDate, to: '/projects' })),
    ...emiLoans.loans
      .filter((l) => l.status !== 'Closed' && l.emiStatus?.nextDueDate)
      .map((l) => ({ type: 'EMI', label: `${l.name} EMI (${formatCurrency(l.emiStatus.emi)})`, date: l.emiStatus.nextDueDate, to: '/debts' })),
    ...creditCards.cards
      .filter((c) => c.latestBill && !c.isPaidInFull)
      .map((c) => ({ type: 'Credit Card', label: `${c.name} bill (${formatCurrency(c.outstanding)})`, date: c.latestBill.dueDate, to: '/debts' })),
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
    { label: 'Record Debt Payment', icon: ArrowRight, onClick: () => navigate('/debts') },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>

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

      {/* Insufficient-funds warnings for EMIs due later this month */}
      {fundingWarnings.map((w) => (
        <div key={w.account} className="bg-red-50 rounded-2xl p-4 flex items-start gap-2">
          <AlertTriangle size={18} className="text-danger shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-danger font-semibold">
              {w.account} may be short by {formatCurrency(w.shortfall)}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {w.loanNames.join(', ')} need{w.loanNames.length === 1 ? 's' : ''} {formatCurrency(w.requiredAmount)} this
              month, but {w.account}'s current balance is {formatCurrency(w.currentBalance)}. Transfer funds in before the due date.
            </p>
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
              const spent = computeProjectSpent(vendors.rows, p.code);
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
