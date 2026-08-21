import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { getTodayISO } from '../utils/formatters';

export default function EMILoanForm({ initial, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(initial || {
    name: '', principal: '', annualRate: '', tenureMonths: '',
    startDate: getTodayISO(), debitsFrom: '', status: 'Active', notes: '',
    emiDate: '', actualEMI: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const busy = isSaving || isDeleting;

  const handleSubmit = async () => {
    if (busy) return;
    if (!form.name.trim()) return setError('Please enter a loan name.');
    if (!form.principal) return setError('Please enter the principal amount you originally borrowed.');
    if (!form.tenureMonths) return setError('Please enter the tenure in months.');
    if (!form.startDate) return setError('Please enter the date you took the loan.');
    if (form.emiDate && (form.emiDate < 1 || form.emiDate > 31)) return setError('EMI Date must be between 1 and 31.');
    setError('');
    setIsSaving(true);
    try {
      await onSave(form);
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
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8 max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{initial ? 'Edit' : 'New'} EMI Loan</h2>
          <button onClick={onClose} disabled={busy} className="p-1"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          {error && <div className="bg-red-50 text-danger text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div>
            <label className="text-xs text-gray-500">Loan Name</label>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="e.g., Land Loan, Car Loan" disabled={busy}
              className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Principal Amount (borrowed)</label>
              <input type="number" inputMode="numeric" value={form.principal}
                onChange={(e) => set('principal', e.target.value)} disabled={busy}
                placeholder="0" className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Interest Rate % (annual)</label>
              <input type="number" inputMode="decimal" value={form.annualRate}
                onChange={(e) => set('annualRate', e.target.value)} disabled={busy}
                placeholder="0" className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Tenure (months)</label>
              <input type="number" inputMode="numeric" value={form.tenureMonths}
                onChange={(e) => set('tenureMonths', e.target.value)} disabled={busy}
                placeholder="e.g., 84" className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Date Loan Taken</label>
              <input type="date" value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)} disabled={busy}
                className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">EMI Date (day of month)</label>
              <input type="number" inputMode="numeric" min="1" max="31" value={form.emiDate}
                onChange={(e) => set('emiDate', e.target.value)} disabled={busy}
                placeholder="e.g., 5" className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Actual EMI (if different from calculated)</label>
              <input type="number" inputMode="numeric" value={form.actualEMI}
                onChange={(e) => set('actualEMI', e.target.value)} disabled={busy}
                placeholder="leave blank to use calculated" className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
          </div>
          <p className="text-xs text-gray-400 -mt-1">
            EMI Date helps count installments accurately near month boundaries. Actual EMI lets you match
            your bank statement exactly if it's rounded differently from the calculated value.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Debits From</label>
              <input type="text" value={form.debitsFrom} onChange={(e) => set('debitsFrom', e.target.value)}
                placeholder="e.g., HDFC" disabled={busy}
                className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)} disabled={busy}
                className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50">
                <option value="Active">Active</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Notes</label>
            <input type="text" value={form.notes} onChange={(e) => set('notes', e.target.value)} disabled={busy}
              className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>

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
                <Trash2 size={16} /> Delete this loan
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
