import { useState } from 'react';
import { useAppData } from '../contexts/DataContext';
import { computeMonthlyActuals, computeActualForPlan } from '../utils/aggregations';
import { formatCurrency, getTodayISO } from '../utils/formatters';
import Dropdown from '../components/Dropdown';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Settings2 } from 'lucide-react';

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

function PlanForm({
  initial, month, categoryOptions, onAddCategory, accountOptions, onAddAccount,
  onSave, onDelete, onClose, title = 'Planned Category',
}) {
  const [form, setForm] = useState(initial || { category: '', plannedAmount: '', section: SECTIONS[1], account: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const busy = isSaving || isDeleting;

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
            label="Account (optional)"
            options={accountOptions || []}
            value={form.account || ''}
            onChange={(v) => set('account', v)}
            onAddNew={onAddAccount}
          />
          <p className="text-xs text-gray-400 -mt-2">
            Leave blank to track Actual across every account for this category. Set an account to narrow it down
            (e.g. plan "EMI" specifically against HDFC).
          </p>

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
        } : null}
        onSave={async (entry) => {
          await onSave(editingItem, {
            category: entry.category, section: entry.section,
            defaultPlannedAmount: entry.plannedAmount, account: entry.account,
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
                  <p className="text-xs text-gray-400">{t.section}{t.account ? ` \u00b7 ${t.account}` : ''}</p>
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

export default function MonthlyPage() {
  const { monthly, cashBook, lists } = useAppData();
  const [month, setMonth] = useState(getTodayISO().slice(0, 7));
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [toast, setToast] = useState(null);
  const notify = (message, type = 'success') => setToast({ message, type });

  const categoryOptions = lists.lists.types || [];
  const handleAddCategory = (value) => lists.addListItem('types', value);
  const accountOptions = lists.lists.accounts || [];
  const handleAddAccount = (value) => lists.addListItem('accounts', value);

  // Actual for a plan with no Account set matches every account for that
  // Type (the pre-existing, still-supported behavior); a plan with an
  // Account set narrows to just that account.
  const actuals = computeMonthlyActuals(cashBook.rows, month);
  const actualForPlan = (p) => (p.account
    ? computeActualForPlan(cashBook.rows, month, p.category, p.account)
    : actuals.get(p.category) || 0);

  const monthPlans = monthly.plans.filter((p) => p.month === month);
  const hasPlans = monthPlans.length > 0;
  const previousMonth = shiftMonth(month, -1);
  const previousMonthPlans = monthly.plans.filter((p) => p.month === previousMonth);

  const totalPlanned = monthPlans.reduce((sum, p) => sum + p.plannedAmount, 0);
  const totalActual = monthPlans.reduce((sum, p) => sum + actualForPlan(p), 0);

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

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-500">Categories ({monthPlans.length})</h2>
        <div className="flex items-center gap-3">
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
                        {p.account && <p className="text-xs text-gray-400">{p.account}</p>}
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
            section: editingPlan.section, account: editingPlan.account,
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

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
