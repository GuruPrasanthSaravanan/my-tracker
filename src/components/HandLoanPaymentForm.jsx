import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { formatCurrency, getTodayISO } from '../utils/formatters';
import { splitPayment, computeSimpleInterestAccrued } from '../utils/loanCalculations';
import CashBookLinkToggle from './CashBookLinkToggle';

export default function HandLoanPaymentForm({ loan, accountOptions = [], onAddAccount, initial, isEditing, onSave, onDelete, onClose }) {
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [date, setDate] = useState(initial?.date || getTodayISO());
  const [logToCashBook, setLogToCashBook] = useState(!isEditing);
  const [cashBookAccount, setCashBookAccount] = useState(loan.debitsFrom || '');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const busy = isSaving || isDeleting;

  // For new payments, preview the interest/principal split based on interest
  // accrued since the loan's last event. For edits, show the split that was
  // already recorded (recalculating live would shift other payments' history).
  const accruedInterest = !isEditing
    ? computeSimpleInterestAccrued(loan.state.outstandingPrincipal, loan.annualRate, loan.state.lastEventDate, date)
    : 0;
  const preview = !isEditing && amount ? splitPayment(parseFloat(amount) || 0, accruedInterest) : null;

  const handleSubmit = async () => {
    if (busy) return;
    if (!amount) return setError('Please enter a payment amount.');
    if (logToCashBook && !cashBookAccount) return setError('Please choose an account to log this in CashBook, or uncheck the option.');
    setError('');
    setIsSaving(true);
    try {
      await onSave(parseFloat(amount), date, logToCashBook, cashBookAccount);
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
          <h2 className="text-lg font-bold">{isEditing ? 'Edit' : 'Record'} Payment: {loan.name}</h2>
          <button onClick={onClose} disabled={busy} className="p-1"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          {error && <div className="bg-red-50 text-danger text-sm px-3 py-2 rounded-lg">{error}</div>}

          {!isEditing && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Outstanding Principal</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(loan.state.outstandingPrincipal)}</p>
            </div>
          )}
          {!isEditing && accruedInterest > 0.5 && (
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-xs text-amber-700">Interest Accrued (since last payment)</p>
              <p className="text-lg font-bold text-amber-600">{formatCurrency(accruedInterest)}</p>
            </div>
          )}
          {isEditing && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Recorded Interest Portion</span>
                <span className="font-semibold text-amber-600">{formatCurrency(initial.interestPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Recorded Principal Portion</span>
                <span className="font-semibold text-success">{formatCurrency(initial.principalPaid)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Editing the amount here changes the total payment but keeps the original interest/principal split.
                Delete and re-record the payment if you need to change the split itself.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500">Payment Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              disabled={busy} className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Payment Amount</label>
            <input type="number" inputMode="numeric" value={amount}
              onChange={(e) => setAmount(e.target.value)} disabled={busy}
              placeholder="0" className="w-full border rounded-lg px-3 py-3 mt-0.5 text-xl font-bold text-center disabled:opacity-50" />
          </div>

          {preview && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Applied to Interest</span>
                <span className="font-semibold text-amber-600">{formatCurrency(preview.interestPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Applied to Principal</span>
                <span className="font-semibold text-success">{formatCurrency(preview.principalPaid)}</span>
              </div>
              {preview.remainingInterestDue > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Interest Still Due</span>
                  <span className="font-semibold text-danger">{formatCurrency(preview.remainingInterestDue)}</span>
                </div>
              )}
            </div>
          )}

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
            {isSaving ? 'Saving...' : (isEditing ? 'Update Payment' : 'Save Payment')}
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
                <Trash2 size={16} /> Delete this payment
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
