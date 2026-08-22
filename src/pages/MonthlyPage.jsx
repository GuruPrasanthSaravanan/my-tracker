import { useState } from 'react';
import { useAppData } from '../contexts/DataContext';
import {
  computeMonthlyActuals, computeActualForPlan, computeActualForTransferPlan,
  computeTypeSpendBreakdown, computeSubCategorySpendBreakdown, computePlannedBreakdown,
} from '../utils/aggregations';
import { formatCurrency, getTodayISO } from '../utils/formatters';
import Dropdown from '../components/Dropdown';
import PieChart from '../components/PieChart';
import BarChart from '../components/BarChart';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Settings2, ArrowLeft, Download } from 'lucide-react';

const SECTIONS = ['Income', 'My Outflows', 'Wife Outflows', 'Projects'];

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en', { month: 'long', year: 'numeric' });
}

/** "ICICI -> AXIS" for a Transfer plan with both sides set, else just the (From) account, else nothing. */
function accountLabel(item) {
  if (item.account && item.toAccount) return `${item.account} \u2192 ${item.toAccount}`;
  return item.account || '';
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
          <div>
            <label className="text-xs text-gray-500">Section</label>
            <select value={form.section} onChange={(e) => set('section', e.target.value)} disabled={busy}
              className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50">
              {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
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
  const { monthly, cashBook, lists } = useAppData();
  const [month, setMonth] = useState(getTodayISO().slice(0, 7));
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [showLoadTemplate, setShowLoadTemplate] = useState(false);
  const [drillIntoType, setDrillIntoType] = useState(null);
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

  // Actual spending breakdown pie chart: Type-level by default, drills into
  // a Type's Sub-categories when one is selected (e.g. tap "WANTS" to see
  // Dining vs Shopping vs Entertainment).
  const typeBreakdown = computeTypeSpendBreakdown(cashBook.rows, month);
  const subCategoryBreakdown = drillIntoType ? computeSubCategorySpendBreakdown(cashBook.rows, month, drillIntoType) : null;
  const actualPieData = (drillIntoType ? subCategoryBreakdown : typeBreakdown);
  const actualPieChartData = Array.from(actualPieData?.entries() || [])
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // Planned breakdown pie chart - a companion to the Actual one above, but
  // sourced straight from this month's plans (no CashBook needed) since
  // Planned amounts are already category-keyed. No drill-down - Monthly
  // Plans don't have a sub-category dimension.
  const plannedBreakdown = computePlannedBreakdown(monthPlans);
  const plannedPieChartData = Array.from(plannedBreakdown.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // Planned vs Actual bar chart - one row per category actually planned
  // this month, so it's directly comparable to the Categories list below.
  // `actualForPlan` returns a signed net (Money IN - Money OUT), which is
  // naturally *negative* for an outflow category (e.g. -72,040 for a
  // 72,040 EMI payment) - but Planned Amount is always entered as a plain
  // positive budgeted figure regardless of direction. Comparing the two
  // directly (positive Planned vs negative Actual) broke both the bar
  // width math and showed a confusing negative number, so both sides are
  // compared as magnitudes here instead - this chart is about "how much
  // activity happened vs how much was planned," not the sign/direction.
  const barChartData = monthPlans
    .map((p) => ({
      label: accountLabel(p) ? `${p.category} (${accountLabel(p)})` : p.category,
      planned: Math.abs(p.plannedAmount),
      actual: Math.abs(actualForPlan(p)),
    }))
    .sort((a, b) => b.planned - a.planned);

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

      {/* Actual breakdown pie: Type-level by default, drills into a Type's
          Sub-categories when one is tapped. */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <div className="flex items-center gap-2 mb-2">
          {drillIntoType && (
            <button onClick={() => setDrillIntoType(null)} className="text-gray-400"><ArrowLeft size={16} /></button>
          )}
          <h2 className="text-sm font-semibold text-gray-500">
            {drillIntoType ? `${drillIntoType} - by Sub-category` : 'Actual Breakdown'}
          </h2>
        </div>
        <PieChart
          data={actualPieChartData}
          onSliceClick={drillIntoType ? undefined : (label) => setDrillIntoType(label)}
        />
        {!drillIntoType && actualPieChartData.length > 0 && (
          <p className="text-xs text-gray-400 mt-2">Tap a category to see its sub-category breakdown.</p>
        )}
      </div>

      {/* Planned vs Actual bar chart - one row per planned category, so you
          can see at a glance which ones are running over. */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-3">Planned vs Actual</h2>
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
        SECTIONS.map((section) => {
          const sectionPlans = monthPlans.filter((p) => p.section === section);
          if (sectionPlans.length === 0) return null;
          return (
            <div key={section} className="mb-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-1">{section}</h3>
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {sectionPlans.map((p) => {
                  const actual = actualForPlan(p);
                  const diff = actual - p.plannedAmount;
                  return (
                    <button key={p._rowIndex} onClick={() => { setEditingPlan(p); setShowForm(true); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 border-b border-gray-100 last:border-0 text-left active:bg-gray-50">
                      <div>
                        <span className="text-sm text-gray-900">{p.category}</span>
                        {accountLabel(p) && <p className="text-xs text-gray-400">{accountLabel(p)}</p>}
                      </div>
                      <div className="text-right text-xs">
                        <p className="text-gray-500">Plan: {formatCurrency(p.plannedAmount)}</p>
                        <p className={diff >= 0 ? 'text-success' : 'text-danger'}>Actual: {formatCurrency(actual)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

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
