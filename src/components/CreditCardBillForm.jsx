import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { computeMinimumDue } from '../utils/loanCalculations';

const today = () => new Date().toISOString().split('T')[0];

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function CreditCardBillForm({ cardName, initial, isEditing, prefillTotalAmountDue, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(initial || {
    statementDate: today(),
    dueDate: addDays(today(), 20), // Indian banks: ~20 days after statement date
    totalAmountDue: prefillTotalAmountDue != null ? String(Math.round(prefillTotalAmountDue)) : '',
    minimumAmountDue: '',
    paymentMade: '',
    paymentDate: '',
    notes: prefillTotalAmountDue != null ? 'Amount estimated from CashBook spend - verify against your actual statement.' : '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const busy = isSaving || isDeleting;

  const suggestedMinDue = form.totalAmountDue
    ? computeMinimumDue({ totalAmountDue: parseFloat(form.totalAmountDue) || 0 })
    : 0;

  const handleSubmit = async () => {
    if (busy) return;
    if (!form.statementDate) return setError('Please enter the statement date.');
    if (!form.dueDate) return setError('Please enter the due date.');
    if (!form.totalAmountDue) return setError('Please enter the total amount due.');
    setError('');
    setIsSaving(true);
    try {
      await onSave({
        ...form,
        cardName,
        minimumAmountDue: form.minimumAmountDue || suggestedMinDue,
        // Only a brand-new bill created from the CashBook projection shortcut is
        // marked estimated; editing an existing bill always confirms/corrects it
        // (see useCreditCards.editBill, which clears this regardless of what's passed).
        isEstimated: !isEditing && prefillTotalAmountDue != null,
      });
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
          <h2 className="text-lg font-bold">{isEditing ? 'Edit' : 'New'} Bill: {cardName}</h2>
          <button onClick={onClose} disabled={busy} className="p-1"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          {error && <div className="bg-red-50 text-danger text-sm px-3 py-2 rounded-lg">{error}</div>}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Statement Date</label>
              <input type="date" value={form.statementDate}
                onChange={(e) => set('statementDate', e.target.value)} disabled={busy}
                className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Due Date</label>
              <input type="date" value={form.dueDate}
                onChange={(e) => set('dueDate', e.target.value)} disabled={busy}
                className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Total Amount Due</label>
            <input type="number" inputMode="numeric" value={form.totalAmountDue}
              onChange={(e) => set('totalAmountDue', e.target.value)} disabled={busy}
              placeholder="0" className="w-full border rounded-lg px-3 py-3 mt-0.5 text-xl font-bold text-center disabled:opacity-50" />
          </div>

          <div>
            <label className="text-xs text-gray-500">
              Minimum Amount Due {form.totalAmountDue && !form.minimumAmountDue && `(suggested: ${suggestedMinDue.toLocaleString('en-IN')})`}
            </label>
            <input type="number" inputMode="numeric" value={form.minimumAmountDue}
              onChange={(e) => set('minimumAmountDue', e.target.value)} disabled={busy}
              placeholder={String(suggestedMinDue || 0)} className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Payment Made</label>
              <input type="number" inputMode="numeric" value={form.paymentMade}
                onChange={(e) => set('paymentMade', e.target.value)} disabled={busy}
                placeholder="0" className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Payment Date</label>
              <input type="date" value={form.paymentDate}
                onChange={(e) => set('paymentDate', e.target.value)} disabled={busy}
                className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Notes</label>
            <input type="text" value={form.notes} onChange={(e) => set('notes', e.target.value)} disabled={busy}
              className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>

          <p className="text-xs text-gray-400">
            Paying less than the full amount loses the interest-free period - interest accrues on the
            remaining balance until fully paid.
          </p>

          <button onClick={handleSubmit} disabled={busy}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-lg mt-2 disabled:opacity-60">
            {isSaving ? 'Saving...' : 'Save Bill'}
          </button>

          {isEditing && onDelete && (
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
                <Trash2 size={16} /> Delete this bill
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
