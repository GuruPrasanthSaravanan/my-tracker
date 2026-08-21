import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { formatCurrency, getTodayISO } from '../utils/formatters';
import CashBookLinkToggle from './CashBookLinkToggle';

export default function EMIPrepaymentForm({ loanName, outstandingBalance, defaultAccount, accountOptions = [], onAddAccount, initial, isEditing, onSave, onDelete, onClose }) {
  const [date, setDate] = useState(initial?.date || getTodayISO());
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [logToCashBook, setLogToCashBook] = useState(!isEditing);
  const [cashBookAccount, setCashBookAccount] = useState(defaultAccount || '');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const busy = isSaving || isDeleting;

  const handleSubmit = async () => {
    if (busy) return;
    if (!date) return setError('Please enter a date.');
    if (!amount) return setError('Please enter the part-payment amount.');
    if (logToCashBook && !cashBookAccount) return setError('Please choose an account to log this in CashBook, or uncheck the option.');
    setError('');
    setIsSaving(true);
    try {
      await onSave({
        date, amount: parseFloat(amount), notes,
        logToCashBook, cashBookAccount: logToCashBook ? cashBookAccount : null,
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
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{isEditing ? 'Edit' : 'Record'} Part-Payment: {loanName}</h2>
          <button onClick={onClose} disabled={busy} className="p-1"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          {error && <div className="bg-red-50 text-danger text-sm px-3 py-2 rounded-lg">{error}</div>}

          {outstandingBalance != null && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Current Outstanding Balance</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(outstandingBalance)}</p>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              disabled={busy} className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Extra Amount Paid (toward principal)</label>
            <input type="number" inputMode="numeric" value={amount}
              onChange={(e) => setAmount(e.target.value)} disabled={busy}
              placeholder="0" className="w-full border rounded-lg px-3 py-3 mt-0.5 text-xl font-bold text-center disabled:opacity-50" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy}
              className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>
          <p className="text-xs text-gray-400">
            This is on top of your regular EMI, and reduces the loan tenure automatically.
          </p>

          {!isEditing && (
            <CashBookLinkToggle
              checked={logToCashBook}
              onCheckedChange={setLogToCashBook}
              account={cashBookAccount}
              onAccountChange={setCashBookAccount}
              accountOptions={accountOptions}
              onAddAccount={onAddAccount}
              disabled={busy}
            />
          )}

          <button onClick={handleSubmit} disabled={busy}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-lg mt-2 disabled:opacity-60">
            {isSaving ? 'Saving...' : (isEditing ? 'Update Part-Payment' : 'Save Part-Payment')}
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
                <Trash2 size={16} /> Delete this part-payment
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
