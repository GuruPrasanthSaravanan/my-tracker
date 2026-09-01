import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import Dropdown from './Dropdown';

export const SECTIONS = ['Income', 'My Outflows', 'Wife Outflows', 'Projects'];

export default function PlanForm({
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
