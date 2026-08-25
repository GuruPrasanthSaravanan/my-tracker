import { useState } from 'react';
import { useAppData } from '../contexts/DataContext';
import {
  computeMonthlyActuals, computeActualForPlan, computeActualForTransferPlan,
  computeTypeSpendBreakdown, computeSubCategorySpendBreakdown, computePlannedBreakdown,
  computeAccountSpendBreakdown, computeTypeSpendBreakdownForAccount, computeAccountSpendBreakdownForType,
  findNearMissForZeroActual, computeCombinedProjectSpend,
} from '../utils/aggregations';
import { projectPayoffPlan } from '../utils/debtAvalancheProjection';
import { formatCurrency, getTodayISO, shiftMonth, monthLabel } from '../utils/formatters';
import Dropdown from '../components/Dropdown';
import PieChart from '../components/PieChart';
import BarChart from '../components/BarChart';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Settings2, ArrowLeft, Download, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

const SECTIONS = ['Income', 'My Outflows', 'Wife Outflows', 'Projects'];

// "Transfers" is not a manually-selectable Section (it wouldn't make sense
// to ask "which section is this transfer in" - a self-transfer isn't
// income/outflow/a project) - instead any plan with Category=TRANSFER is
// automatically grouped under it for display, regardless of whatever
// Section value happens to be stored on that row (existing Transfer plans
// don't need to be edited/migrated for this to take effect).
const DISPLAY_SECTIONS = ['Income', 'My Outflows', 'Wife Outflows', 'Transfers', 'Projects'];
const effectiveSection = (p) => (p.category === 'TRANSFER' ? 'Transfers' : p.section);

/** "ICICI -> AXIS" for a Transfer plan with both sides set, else just the (From) account, else nothing. */
function accountLabel(item) {
  if (item.account && item.toAccount) return `${item.account} \u2192 ${item.toAccount}`;
  return item.account || '';
}

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

function PlanForm({
  initial, month, categoryOptions, onAddCategory, accountOptions, onAddAccount,
  onSave, onDelete, onClose, title = 'Planned Category',
}) {
  const [form, setForm] = useState(initial || { category: '', plannedAmount: '', section: SECTIONS[1], account: '', toAccount: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const busy = isSaving || isDeleting;
  const isTransfer = form.category === 'TRANSFER';

  const handleSubmit = async () => {
    if (busy) return;
    if (!form.category.trim()) return setError('Please choose a category.');
    if (!form.plannedAmount) return setError('Please enter a planned amount.');
    setError('');
    setIsSaving(true);
    try {
      await onSave({ ...form, month });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (busy) return;
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{initial ? 'Edit' : 'New'} {title}</h2>
          <button onClick={onClose} disabled={busy} className="p-1"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          {error && <div className="bg-red-50 text-danger text-sm px-3 py-2 rounded-lg">{error}</div>}
          <Dropdown
            label="Category"
            options={categoryOptions}
            value={form.category}
            onChange={(v) => set('category', v)}
            onAddNew={onAddCategory}
          />
          <p className="text-xs text-gray-400 -mt-2">Matching a CashBook Type lets Actual auto-track from your entries.</p>
          <div>
            <label className="text-xs text-gray-500">Planned Amount</label>
            <input type="number" inputMode="numeric" value={form.plannedAmount}
              onChange={(e) => set('plannedAmount', e.target.value)} disabled={busy}
              placeholder="0" className="w-full border rounded-lg px-3 py-3 mt-0.5 text-xl font-bold text-center disabled:opacity-50" />
          </div>
          {isTransfer ? (
            <p className="text-xs text-gray-400">Transfers are grouped automatically under their own "Transfers" section - no need to pick one.</p>
          ) : (
            <div>
              <label className="text-xs text-gray-500">Section</label>
              <select value={form.section} onChange={(e) => set('section', e.target.value)} disabled={busy}
                className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50">
                {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <Dropdown
            label={isTransfer ? 'From Account (optional)' : 'Account (optional)'}
            options={accountOptions || []}
            value={form.account || ''}
            onChange={(v) => set('account', v)}
            onAddNew={onAddAccount}
          />
          {isTransfer ? (
            <>
              <Dropdown
                label="To Account (optional)"
                options={accountOptions || []}
                value={form.toAccount || ''}
                onChange={(v) => set('toAccount', v)}
                onAddNew={onAddAccount}
              />
              <p className="text-xs text-gray-400 -mt-2">
                Set both From and To to track this specific transfer (e.g. a wants allowance, ICICI to AXIS) -
                Actual will only count transfers that match both sides. Leave one blank to fall back to matching
                just the other side.
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-400 -mt-2">
              Leave blank to track Actual across every account for this category. Set an account to narrow it down
              (e.g. plan "EMI" specifically against HDFC).
            </p>
          )}

          <button onClick={handleSubmit} disabled={busy}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-lg mt-2 disabled:opacity-60">
            {isSaving ? 'Saving...' : 'Save'}
          </button>

          {initial && onDelete && (
            confirmDelete ? (
              <div className="flex gap-2">
                <button onClick={handleDelete} disabled={busy}
                  className="flex-1 bg-danger text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-60">
                  {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
                <button onClick={() => setConfirmDelete(false)} disabled={busy}
                  className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-semibold text-sm disabled:opacity-60">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} disabled={busy}
                className="w-full flex items-center justify-center gap-2 text-danger py-2 text-sm disabled:opacity-60">
                <Trash2 size={16} /> Delete
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function TemplateManager({ template, categoryOptions, onAddCategory, accountOptions, onAddAccount, onSave, onDelete, onClose }) {
  const [editingItem, setEditingItem] = useState(undefined); // undefined = list view, null = new item, object = editing

  if (editingItem !== undefined) {
    return (
      <PlanForm
        title="Template Category"
        month={null}
        categoryOptions={categoryOptions}
        onAddCategory={onAddCategory}
        accountOptions={accountOptions}
        onAddAccount={onAddAccount}
        initial={editingItem ? {
          category: editingItem.category,
          plannedAmount: String(editingItem.defaultPlannedAmount),
          section: editingItem.section,
          account: editingItem.account,
          toAccount: editingItem.toAccount,
        } : null}
        onSave={async (entry) => {
          await onSave(editingItem, {
            category: entry.category, section: entry.section,
            defaultPlannedAmount: entry.plannedAmount, account: entry.account, toAccount: entry.toAccount,
          });
          setEditingItem(undefined);
        }}
        onDelete={editingItem ? async () => { await onDelete(editingItem); setEditingItem(undefined); } : undefined}
        onClose={() => setEditingItem(undefined)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8 max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Monthly Template</h2>
          <button onClick={onClose} className="p-1"><X size={20} /></button>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Set this up once with your usual categories - then "Load Template" pre-fills any new month instead of starting blank.
        </p>
        <button onClick={() => setEditingItem(null)}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-xl font-medium text-sm mb-3">
          <Plus size={16} /> Add Template Category
        </button>
        {template.length === 0 ? (
          <p className="text-center text-gray-400 py-6 text-sm">No template categories yet.</p>
        ) : (
          <div className="bg-gray-50 rounded-xl overflow-hidden">
            {template.map((t) => (
              <button key={t._rowIndex} onClick={() => setEditingItem(t)}
                className="w-full flex items-center justify-between px-3 py-2.5 border-b border-gray-200 last:border-0 text-left active:bg-gray-100">
                <div>
                  <p className="text-sm text-gray-900">{t.category}</p>
                  <p className="text-xs text-gray-400">{t.section}{accountLabel(t) ? ` \u00b7 ${accountLabel(t)}` : ''}</p>
                </div>
                <span className="text-sm text-gray-500">{formatCurrency(t.defaultPlannedAmount)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Lets the user pick one or more specific template items to pull into the
 * current month, instead of the old all-or-nothing "Load Default Template"
 * button - which also only ever appeared before the month had any plans at
 * all, so there was no way to top up a month with more template items later.
 * Template items whose category+account combo already exists as a plan
 * this month are hidden (nothing to add), and defaults to everything else
 * selected, since "pull the whole template" is still the common case.
 */
function LoadTemplateModal({ template, monthPlans, onLoad, onClose }) {
  const alreadyPlanned = new Set(monthPlans.map((p) => `${p.category}|${p.account || ''}|${p.toAccount || ''}`));
  const availableItems = template.filter((t) => !alreadyPlanned.has(`${t.category}|${t.account || ''}|${t.toAccount || ''}`));
  const [selected, setSelected] = useState(new Set(availableItems.map((t) => t._rowIndex)));
  const [isLoading, setIsLoading] = useState(false);

  const toggle = (rowIndex) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex); else next.add(rowIndex);
      return next;
    });
  };

  const allSelected = selected.size === availableItems.length && availableItems.length > 0;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(availableItems.map((t) => t._rowIndex)));

  const handleLoad = async () => {
    if (isLoading || selected.size === 0) return;
    setIsLoading(true);
    try {
      await onLoad(availableItems.filter((t) => selected.has(t._rowIndex)));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8 max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Load from Template</h2>
          <button onClick={onClose} disabled={isLoading} className="p-1"><X size={20} /></button>
        </div>

        {availableItems.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            Every template category is already planned for this month.
          </p>
        ) : (
          <>
            <button onClick={toggleAll} className="text-xs text-primary font-medium mb-2">
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
            <div className="bg-gray-50 rounded-xl overflow-hidden mb-4">
              {availableItems.map((t) => (
                <label key={t._rowIndex}
                  className="w-full flex items-center gap-3 px-3 py-2.5 border-b border-gray-200 last:border-0">
                  <input type="checkbox" checked={selected.has(t._rowIndex)} onChange={() => toggle(t._rowIndex)} />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{t.category}</p>
                    <p className="text-xs text-gray-400">{t.section}{accountLabel(t) ? ` \u00b7 ${accountLabel(t)}` : ''}</p>
                  </div>
                  <span className="text-sm text-gray-500">{formatCurrency(t.defaultPlannedAmount)}</span>
                </label>
              ))}
            </div>
            <button onClick={handleLoad} disabled={isLoading || selected.size === 0}
              className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-lg disabled:opacity-60">
              {isLoading ? 'Adding...' : `Add ${selected.size} Selected`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function MonthlyPage() {
  const { monthly, cashBook, lists, handLoans, emiLoans, projects, vendors, chitFunds, accountSettings, creditCards } = useAppData();
  const [month, setMonth] = useState(getTodayISO().slice(0, 7));
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [showLoadTemplate, setShowLoadTemplate] = useState(false);
  // Collapsed by default - this is a heavy simulation section, moved to the
  // bottom of the page and hidden until asked for, so it doesn't dominate
  // the page above the more commonly-used Categories/breakdown sections.
  const [showPayoffTrajectory, setShowPayoffTrajectory] = useState(false);
  // Actual Breakdown pie: top-level grouping (Type, the original behavior,
  // or Account - "how much came out of W-HDFC this month") plus a drilled-in
  // slice label. When grouped by Type, drillMode additionally picks which
  // dimension the drill-down itself uses (Sub-category, the original
  // behavior, or Account) - so "WANTS -> Dining/Shopping" and "WANTS ->
  // W-AXIS/CASH" are both reachable without a whole separate chart.
  // Grouping by Account only ever drills into Type (no further level),
  // since that's the specific view requested ("show all the actuals by
  // Type" for a given account).
  const [breakdownGroupBy, setBreakdownGroupBy] = useState('type'); // 'type' | 'account'
  const [drillInto, setDrillInto] = useState(null);
  const [drillMode, setDrillMode] = useState('subcategory'); // 'subcategory' | 'account' - only used when breakdownGroupBy === 'type'

  // Planned vs Actual bar chart's row grouping - 'type' rolls plans sharing
  // a Category into one bar (the default "actual budget" view), 'account'
  // rolls plans up by Account instead, 'plan' keeps one row per plan (the
  // original behavior, for when the his/hers or per-loan split needs to
  // stay visible in this specific chart).
  const [barGroupBy, setBarGroupBy] = useState('type'); // 'type' | 'account' | 'plan'
  const [toast, setToast] = useState(null);
  const notify = (message, type = 'success') => setToast({ message, type });

  const categoryOptions = lists.lists.types || [];
  const handleAddCategory = (value) => lists.addListItem('types', value);
  const accountOptions = lists.lists.accounts || [];
  const handleAddAccount = (value) => lists.addListItem('accounts', value);

  // Actual for a plan with no Account set matches every account for that
  // Type (the pre-existing, still-supported behavior); a plan with an
  // Account set narrows to just that account; a TRANSFER plan with both
  // Account (from) and ToAccount set pairs the two CashBook legs of a real
  // transfer instead (see computeActualForTransferPlan).
  const actuals = computeMonthlyActuals(cashBook.rows, month);
  const actualForPlan = (p) => {
    if (p.category === 'TRANSFER' && p.account && p.toAccount) {
      return computeActualForTransferPlan(cashBook.rows, month, p.account, p.toAccount);
    }
    if (p.account) return computeActualForPlan(cashBook.rows, month, p.category, p.account);
    return actuals.get(p.category) || 0;
  };

  const monthPlans = monthly.plans.filter((p) => p.month === month);
  const hasPlans = monthPlans.length > 0;
  const previousMonth = shiftMonth(month, -1);
  const previousMonthPlans = monthly.plans.filter((p) => p.month === previousMonth);

  const totalPlanned = monthPlans.reduce((sum, p) => sum + p.plannedAmount, 0);
  const totalActual = monthPlans.reduce((sum, p) => sum + actualForPlan(p), 0);

  // Savings = Income - Outflow, excluding TRANSFER plans entirely - a
  // self-transfer between your own accounts is neither income nor an
  // expense, it just moves money around, so counting it here would
  // overstate both sides (and roughly cancel out anyway, but only by
  // coincidence when amounts match, not reliably). This is the number
  // that answers "how much can I actually commit toward a repayment or
  // project this month" - unlike Total Planned/Actual above, which just
  // sums every plan's positive plannedAmount regardless of Income vs
  // Outflow direction and isn't meant to represent a net figure.
  const isRealFlow = (p) => p.category !== 'TRANSFER';
  const incomePlans = monthPlans.filter((p) => p.section === 'Income' && isRealFlow(p));
  const outflowPlans = monthPlans.filter((p) => p.section !== 'Income' && isRealFlow(p));
  const plannedIncome = incomePlans.reduce((sum, p) => sum + p.plannedAmount, 0);
  const plannedOutflow = outflowPlans.reduce((sum, p) => sum + p.plannedAmount, 0);
  const plannedSavings = plannedIncome - plannedOutflow;
  const actualIncome = incomePlans.reduce((sum, p) => sum + actualForPlan(p), 0);
  const actualOutflow = outflowPlans.reduce((sum, p) => sum + Math.abs(actualForPlan(p)), 0);
  const actualSavings = actualIncome - actualOutflow;

  // Total Available = whatever's actually sitting in your accounts right
  // now (live, not month-scoped - the same figure as CashBook's "Total
  // Balance") plus this month's Savings - i.e. "how much could I commit to
  // a repayment or project today, plus what this month is expected to free
  // up." Deliberately uses the live running balance rather than trying to
  // reconstruct "last month's leftover" as a separate carried-forward
  // figure - the running balance already *is* every prior month's leftover,
  // with no risk of it drifting out of sync with a separately-tracked number.
  const currentBalance = cashBook.totalBalance;
  const totalAvailablePlanned = currentBalance + plannedSavings;
  const totalAvailableActual = currentBalance + actualSavings;

  // Debt Payoff Trajectory - only items with a Payoff Priority set
  // participate (see debtAvalancheProjection.js / bugs-and-lessons.md §44).
  // Lend-direction Hand Loans are excluded here (not the engine's job) -
  // this projection is about paying down obligations/funding commitments,
  // not chasing repayment of money lent out.
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
  // already uses) - cash already available today that isn't earmarked for
  // anything else, distinct from the recurring monthlySurplus below.
  const startingLumpSum = Array.from(cashBook.accountBalances.entries())
    .reduce((sum, [account, balance]) => sum + Math.max(0, balance - (accountSettings.minBalances.get(account) || 0)), 0);
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
        monthlySurplus: Math.max(0, plannedSavings), startingLumpSum, startDate: getTodayISO(),
      })
    : null;

  // Actual spending breakdown pie chart - top level is either Type (e.g.
  // tap "WANTS" to see Dining vs Shopping vs Entertainment) or Account
  // (e.g. tap "W-HDFC" to see which Types its spend went to), and a Type
  // drill-down can itself be viewed by Sub-category or by Account.
  const topLevelBreakdown = breakdownGroupBy === 'account'
    ? computeAccountSpendBreakdown(cashBook.rows, month)
    : computeTypeSpendBreakdown(cashBook.rows, month);

  let drillBreakdown = null;
  if (drillInto) {
    if (breakdownGroupBy === 'account') {
      drillBreakdown = computeTypeSpendBreakdownForAccount(cashBook.rows, month, drillInto);
    } else if (drillMode === 'account') {
      drillBreakdown = computeAccountSpendBreakdownForType(cashBook.rows, month, drillInto);
    } else {
      drillBreakdown = computeSubCategorySpendBreakdown(cashBook.rows, month, drillInto);
    }
  }

  const actualPieData = drillInto ? drillBreakdown : topLevelBreakdown;
  const actualPieChartData = Array.from(actualPieData?.entries() || [])
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const actualBreakdownTitle = !drillInto
    ? 'Actual Breakdown'
    : breakdownGroupBy === 'account'
      ? `${drillInto} - by Type`
      : `${drillInto} - by ${drillMode === 'account' ? 'Account' : 'Sub-category'}`;

  // Planned breakdown pie chart - a companion to the Actual one above, but
  // sourced straight from this month's plans (no CashBook needed) since
  // Planned amounts are already category-keyed. No drill-down - Monthly
  // Plans don't have a sub-category dimension.
  const plannedBreakdown = computePlannedBreakdown(monthPlans);
  const plannedPieChartData = Array.from(plannedBreakdown.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // Planned vs Actual bar chart - grouping is user-selectable (barGroupBy):
  // "By Type" (default) rolls every plan sharing a Category into one bar -
  // e.g. "SALARY [ICICI]" and "SALARY [W-ICICI]" combine into one "SALARY"
  // row - "By Account" instead rolls plans up by their Account (plans with
  // none set fall into "(No Account)"), and "By Type + Account" keeps the
  // original one-row-per-plan behavior for when the his/hers or per-loan
  // split still needs to be visible in this specific chart.
  // `actualForPlan` returns a signed net (Money IN - Money OUT), which is
  // naturally *negative* for an outflow category (e.g. -72,040 for a
  // 72,040 EMI payment) - but Planned Amount is always entered as a plain
  // positive budgeted figure regardless of direction. Comparing the two
  // directly (positive Planned vs negative Actual) broke both the bar
  // width math and showed a confusing negative number, so both sides are
  // compared as magnitudes here instead - this chart is about "how much
  // activity happened vs how much was planned," not the sign/direction.
  const barChartRows = monthPlans.map((p) => ({
    category: p.category,
    account: p.account || '(No Account)',
    label: accountLabel(p) ? `${p.category} (${accountLabel(p)})` : p.category,
    planned: Math.abs(p.plannedAmount),
    actual: Math.abs(actualForPlan(p)),
  }));

  let barChartData;
  if (barGroupBy === 'plan') {
    barChartData = barChartRows;
  } else if (barGroupBy === 'type') {
    // Unlike the other two modes, this one does NOT sum each plan's own
    // actualForPlan (which is itself Account-narrowed) - a Category can
    // easily have real CashBook spend on accounts no plan happens to be
    // scoped to, which would otherwise understate "the actual budget" this
    // view is meant to show. Instead uses `actuals` (computeMonthlyActuals)
    // - the Type's true total across every account, "despite of the
    // account" set on any one plan. TRANSFER is the one exception: netting
    // every transfer's paired Money-IN/-OUT legs this way collapses to
    // ~0 for fully-paired transfers, so it keeps using the per-plan
    // paired-transfer amount (computeActualForTransferPlan via actualForPlan) instead.
    const grouped = new Map();
    for (const p of monthPlans) {
      const entry = grouped.get(p.category) || { label: p.category, planned: 0 };
      entry.planned += Math.abs(p.plannedAmount);
      grouped.set(p.category, entry);
    }
    for (const [category, entry] of grouped) {
      entry.actual = category === 'TRANSFER'
        ? monthPlans.filter((p) => p.category === 'TRANSFER').reduce((sum, p) => sum + Math.abs(actualForPlan(p)), 0)
        : Math.abs(actuals.get(category) || 0);
    }
    barChartData = Array.from(grouped.values());
  } else {
    barChartData = Array.from(
      barChartRows.reduce((grouped, row) => {
        const entry = grouped.get(row.account) || { label: row.account, planned: 0, actual: 0 };
        entry.planned += row.planned;
        entry.actual += row.actual;
        grouped.set(row.account, entry);
        return grouped;
      }, new Map()).values()
    );
  }
  barChartData = barChartData.sort((a, b) => b.planned - a.planned);

  const handleSave = async (entry) => {
    try {
      if (editingPlan) {
        await monthly.editPlan(editingPlan._rowIndex, entry);
      } else {
        await monthly.addPlan(entry);
      }
      setShowForm(false);
      setEditingPlan(null);
      notify('Saved!');
    } catch {
      notify('Failed to save.', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await monthly.deletePlan(editingPlan._rowIndex);
      setEditingPlan(null);
      notify('Deleted.');
    } catch {
      notify('Failed to delete.', 'error');
    }
  };

  const handleCopyLastMonth = async () => {
    try {
      await monthly.copyMonthPlans(previousMonth, month);
      notify('Copied last month\'s plan!');
    } catch {
      notify('Failed to copy.', 'error');
    }
  };

  const handleLoadTemplate = async () => {
    try {
      await monthly.loadTemplateIntoMonth(month);
      notify('Template loaded!');
    } catch {
      notify('Failed to load template.', 'error');
    }
  };

  const handleLoadSelectedTemplateItems = async (items) => {
    try {
      await monthly.loadTemplateIntoMonth(month, items);
      setShowLoadTemplate(false);
      notify(`Added ${items.length} categor${items.length === 1 ? 'y' : 'ies'} from template!`);
    } catch {
      notify('Failed to load template items.', 'error');
    }
  };

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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMonth(shiftMonth(month, -1))} className="p-2"><ChevronLeft size={20} /></button>
        <h1 className="text-lg font-bold text-gray-900">{monthLabel(month)}</h1>
        <button onClick={() => setMonth(shiftMonth(month, 1))} className="p-2"><ChevronRight size={20} /></button>
      </div>

      {/* Savings = Income - Outflow, excluding transfers between your own
          accounts - the figure to actually plan a repayment/project
          commitment against, as opposed to Total Planned/Actual below
          which just sum every plan's positive amount regardless of
          direction. */}
      <div className={`rounded-2xl p-4 mb-4 text-white ${plannedSavings >= 0 ? 'bg-primary' : 'bg-danger'}`}>
        <p className="text-xs opacity-80">Planned Savings (Income − Outflow, excl. transfers)</p>
        <p className="text-2xl font-bold">{formatCurrency(plannedSavings)}</p>
        <p className="text-xs opacity-80 mt-1">
          Actual so far: {formatCurrency(actualSavings)} ({formatCurrency(actualIncome)} in − {formatCurrency(actualOutflow)} out)
        </p>
        <div className="border-t border-white/20 mt-3 pt-3">
          <p className="text-xs opacity-80">Total Available for a repayment/project (Current Balance + Planned Savings)</p>
          <p className="text-xl font-bold">{formatCurrency(totalAvailablePlanned)}</p>
          <p className="text-xs opacity-80 mt-1">
            Current Balance: {formatCurrency(currentBalance)} · Available now (using Actual so far): {formatCurrency(totalAvailableActual)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total Planned</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(totalPlanned)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total Actual</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(totalActual)}</p>
        </div>
      </div>

      {/* Planned breakdown pie - what you intended to spend, by category. */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">Planned Breakdown</h2>
        <PieChart data={plannedPieChartData} />
      </div>

      {/* Actual breakdown pie: grouped by Type or Account at the top level,
          drilling one level further into Sub-category/Account (Type) or
          just Type (Account) when a slice is tapped. */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <div className="flex items-center gap-2 mb-2">
          {drillInto && (
            <button onClick={() => setDrillInto(null)} className="text-gray-400"><ArrowLeft size={16} /></button>
          )}
          <h2 className="text-sm font-semibold text-gray-500">{actualBreakdownTitle}</h2>
        </div>

        {!drillInto && (
          <div className="flex gap-1 mb-3">
            {[{ key: 'type', label: 'By Type' }, { key: 'account', label: 'By Account' }].map((g) => (
              <button key={g.key} onClick={() => { setBreakdownGroupBy(g.key); setDrillInto(null); }}
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  breakdownGroupBy === g.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                {g.label}
              </button>
            ))}
          </div>
        )}

        {drillInto && breakdownGroupBy === 'type' && (
          <div className="flex gap-1 mb-3">
            {[{ key: 'subcategory', label: 'By Sub-category' }, { key: 'account', label: 'By Account' }].map((m) => (
              <button key={m.key} onClick={() => setDrillMode(m.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  drillMode === m.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                {m.label}
              </button>
            ))}
          </div>
        )}

        <PieChart
          data={actualPieChartData}
          onSliceClick={drillInto ? undefined : (label) => setDrillInto(label)}
        />
        {!drillInto && actualPieChartData.length > 0 && (
          <p className="text-xs text-gray-400 mt-2">
            Tap a {breakdownGroupBy === 'account' ? 'account' : 'category'} to see its breakdown.
          </p>
        )}
      </div>

      {/* Planned vs Actual bar chart - grouping toggle lets this be either
          a per-plan view (today's Category+Account split intact) or a
          rolled-up Type/Account budget view. */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-3">Planned vs Actual</h2>
        <div className="flex gap-1 mb-3">
          {[
            { key: 'type', label: 'By Type' },
            { key: 'account', label: 'By Account' },
            { key: 'plan', label: 'By Type + Account' },
          ].map((g) => (
            <button key={g.key} onClick={() => setBarGroupBy(g.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                barGroupBy === g.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
              }`}>
              {g.label}
            </button>
          ))}
        </div>
        <BarChart data={barChartData} />
      </div>

      {!hasPlans && previousMonthPlans.length > 0 && (
        <button onClick={handleCopyLastMonth}
          className="w-full bg-blue-50 text-primary text-sm font-medium py-2.5 rounded-xl mb-2">
          Copy plan from {monthLabel(previousMonth)}
        </button>
      )}
      {!hasPlans && monthly.template.length > 0 && (
        <button onClick={handleLoadTemplate}
          className="w-full bg-blue-50 text-primary text-sm font-medium py-2.5 rounded-xl mb-4">
          Load Default Template
        </button>
      )}

      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-gray-500">Categories ({monthPlans.length})</h2>
        <div className="flex items-center gap-3">
          {monthly.template.length > 0 && (
            <button onClick={() => setShowLoadTemplate(true)} className="text-xs text-gray-500 font-medium flex items-center gap-1">
              <Download size={14} /> From Template
            </button>
          )}
          <button onClick={() => setShowTemplate(true)} className="text-xs text-gray-500 font-medium flex items-center gap-1">
            <Settings2 size={14} /> Template
          </button>
          <button onClick={() => { setEditingPlan(null); setShowForm(true); }}
            className="text-xs text-primary font-medium flex items-center gap-1">
            <Plus size={14} /> Add Category
          </button>
        </div>
      </div>

      {monthly.isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : monthPlans.length === 0 ? (
        <p className="text-center text-gray-400 py-8">No categories planned for this month yet.</p>
      ) : (
        DISPLAY_SECTIONS.map((section) => {
          const sectionPlans = monthPlans.filter((p) => effectiveSection(p) === section);
          if (sectionPlans.length === 0) return null;
          // Same magnitude convention as each row's own Actual (§31) - a
          // section total mixing signed Income and signed Outflow actuals
          // would be meaningless, so every row contributes its magnitude.
          const sectionPlannedTotal = sectionPlans.reduce((sum, p) => sum + p.plannedAmount, 0);
          const sectionActualTotal = sectionPlans.reduce((sum, p) => sum + Math.abs(actualForPlan(p)), 0);
          return (
            <div key={section} className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-semibold text-gray-400 uppercase">{section}</h3>
                <span className="text-xs text-gray-500">
                  Plan: {formatCurrency(sectionPlannedTotal)} · Actual: {formatCurrency(sectionActualTotal)}
                </span>
              </div>
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {sectionPlans.map((p) => {
                  // actualForPlan returns a signed net (Money IN - Money OUT),
                  // naturally negative for a pure-outflow category - but
                  // Planned Amount is always a plain positive budgeted figure.
                  // Compare magnitudes (same convention as the Planned vs
                  // Actual bar chart above, see bugs-and-lessons.md §31) so
                  // this never shows a confusing negative Actual or a
                  // meaningless "over/under" color for an outflow category.
                  const actualMagnitude = Math.abs(actualForPlan(p));
                  const isOverPlanned = actualMagnitude > p.plannedAmount;
                  // Diagnostic-only hint for a ₹0 Actual - checks (without
                  // changing the real exact-match computation, see
                  // findNearMissForZeroActual) whether a case/whitespace-only
                  // variant of this Category/Account was actually used this
                  // month, e.g. "W-Kotak" entered instead of the plan's
                  // "W-KOTAK" - the likely cause flagged in bugs-and-lessons.md §36.
                  const nearMiss = actualMagnitude === 0 && p.category !== 'TRANSFER'
                    ? findNearMissForZeroActual(cashBook.rows, month, p.category, p.account)
                    : null;
                  return (
                    <button key={p._rowIndex} onClick={() => { setEditingPlan(p); setShowForm(true); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 border-b border-gray-100 last:border-0 text-left active:bg-gray-50">
                      <div>
                        <span className="text-sm text-gray-900">{p.category}</span>
                        {accountLabel(p) && <p className="text-xs text-gray-400">{accountLabel(p)}</p>}
                        {nearMiss && (
                          <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5 max-w-[160px]">
                            <AlertTriangle size={11} className="shrink-0" />
                            Found "{nearMiss.category}" / "{nearMiss.account}" - check spelling?
                          </p>
                        )}
                      </div>
                      <div className="text-right text-xs">
                        <p className="text-gray-500">Plan: {formatCurrency(p.plannedAmount)}</p>
                        <p className={isOverPlanned ? 'text-danger' : 'text-success'}>Actual: {formatCurrency(actualMagnitude)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Debt Payoff Trajectory - a heavy simulation section, deliberately
          moved to the bottom of the page and collapsed by default (tap to
          expand) so it doesn't dominate the more commonly-used sections
          above. Still always renders the card itself (not hidden entirely
          behind hasPayoffItems) so the feature stays discoverable even
          before anything has been opted in - see bugs-and-lessons.md §44. */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <button onClick={() => setShowPayoffTrajectory((v) => !v)}
          className="w-full flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500">Debt Payoff Trajectory</h2>
          {showPayoffTrajectory ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {showPayoffTrajectory && (
          !hasPayoffItems || !payoffPlan ? (
            <p className="text-sm text-gray-400 mt-2">
              Set a Payoff Priority on a Hand Loan, EMI Loan, or Project (edit it, look for the "Payoff Priority"
              field) to include it here and see when it's projected to clear.
            </p>
          ) : (
          <>
            <div className="space-y-0.5 mt-2 mb-3">
              <p className="text-xs text-gray-400">
                Assumes {formatCurrency(Math.max(0, plannedSavings))}/month (this month's Planned Savings) stays constant.
              </p>
              {startingLumpSum > 0 && (
                <p className="text-xs text-gray-400">
                  Plus a one-time {formatCurrency(startingLumpSum)} from current balances above each account's
                  Min Balance, applied this month only.
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
          )
        )}
      </div>

      {showForm && (
        <PlanForm
          month={month}
          categoryOptions={categoryOptions}
          onAddCategory={handleAddCategory}
          accountOptions={accountOptions}
          onAddAccount={handleAddAccount}
          initial={editingPlan ? {
            category: editingPlan.category, plannedAmount: String(editingPlan.plannedAmount),
            section: editingPlan.section, account: editingPlan.account, toAccount: editingPlan.toAccount,
          } : null}
          onSave={handleSave}
          onDelete={editingPlan ? handleDelete : undefined}
          onClose={() => { setShowForm(false); setEditingPlan(null); }}
        />
      )}

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

      {showLoadTemplate && (
        <LoadTemplateModal
          template={monthly.template}
          monthPlans={monthPlans}
          onLoad={handleLoadSelectedTemplateItems}
          onClose={() => setShowLoadTemplate(false)}
        />
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
