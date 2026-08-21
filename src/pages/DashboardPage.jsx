import { useNavigate } from 'react-router-dom';
import { useAppData } from '../contexts/DataContext';
import { computeProjectSpent, computeMonthSurplus } from '../utils/aggregations';
import { formatCurrency, formatDate, getTodayISO } from '../utils/formatters';
import ProgressBar from '../components/ProgressBar';
import { Plus, ArrowRight } from 'lucide-react';

export default function DashboardPage() {
  const { cashBook, vendors, projects, emiLoans, handLoans, creditCards } = useAppData();
  const navigate = useNavigate();

  const currentMonth = getTodayISO().slice(0, 7); // "YYYY-MM"
  const { surplus, totalIn, totalOut } = computeMonthSurplus(cashBook.rows, currentMonth);

  const totalDebtOutstanding = emiLoans.totalOutstanding + handLoans.totalOwed + creditCards.totalOutstanding;

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

  const quickActions = [
    { label: 'Add CashBook Entry', onClick: () => navigate('/cashbook') },
    { label: 'Add Vendor Entry', onClick: () => navigate('/vendors') },
    { label: 'Record Debt Payment', onClick: () => navigate('/debts') },
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
              <span className="flex items-center gap-2"><Plus size={16} className="text-primary" /> {a.label}</span>
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
    </div>
  );
}
