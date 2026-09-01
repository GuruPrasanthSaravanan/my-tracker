import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import PlanForm from './PlanForm';

/** "ICICI -> AXIS" for a Transfer plan with both sides set, else just the (From) account, else nothing. */
function accountLabel(item) {
  if (item.account && item.toAccount) return `${item.account} \u2192 ${item.toAccount}`;
  return item.account || '';
}

export default function TemplateManager({ template, categoryOptions, onAddCategory, accountOptions, onAddAccount, onSave, onDelete, onClose }) {
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
