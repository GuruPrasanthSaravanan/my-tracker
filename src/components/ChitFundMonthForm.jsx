import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { formatCurrency, getTodayISO } from '../utils/formatters';

/**
 * Logs the actual outcome for one month of a chit fund - deliberately just
 * records what happened (contribution paid, dividend if any, whether this
 * was the prized/winning month and how much was received) rather than
 * calculating it, since the auction/dividend/commission math varies by chit
 * and this app doesn't try to simulate it - see chitFundCalculations.js.
 */
export default function ChitFundMonthForm({ chit, initial, isEditing, onSave, onDelete, onClose }) {
  const [month, setMonth] = useState(initial?.month || getTodayISO().slice(0, 7));
  const [contributionPaid, setContributionPaid] = useState(
    initial?.contributionPaid != null ? String(initial.contributionPaid) : String(chit.monthlyContribution || '')
  );
  const [dividendReceived, setDividendReceived] = useState(initial?.dividendReceived != null ? String(initial.dividendReceived) : '');
  const [isPrizedMonth, setIsPrizedMonth] = useState(initial?.isPrizedMonth || false);
  const [prizeAmountReceived, setPrizeAmountReceived] = useState(initial?.prizeAmountReceived != null ? String(initial.prizeAmountReceived) : '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const busy = isSaving || isDeleting;

  const handleSubmit = async () => {
    if (busy) return;
    if (!month) return setError('Please enter the month.');
    if (!contributionPaid) return setError('Please enter the contribution paid.');
    if (isPrizedMonth && !prizeAmountReceived) return setError('Please enter the prize amount received.');
    setError('');
    setIsSaving(true);
    try {
      await onSave({
        chitName: chit.name, month,
        contributionPaid: parseFloat(contributionPaid),
        dividendReceived: parseFloat(dividendReceived) || 0,
        isPrizedMonth,
        prizeAmountReceived: isPrizedMonth ? parseFloat(prizeAmountReceived) || 0 : 0,
        notes,
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
          <h2 className="text-lg font-bold">{isEditing ? 'Edit' : 'Log'} Month: {chit.name}</h2>
          <button onClick={onClose} disabled={busy} className="p-1"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          {error && <div className="bg-red-50 text-danger text-sm px-3 py-2 rounded-lg">{error}</div>}

          <div>
            <label className="text-xs text-gray-500">Month</label>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
              disabled={busy} className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>

          <div>
            <label className="text-xs text-gray-500">Contribution Paid</label>
            <input type="number" inputMode="numeric" value={contributionPaid}
              onChange={(e) => setContributionPaid(e.target.value)} disabled={busy}
              placeholder={String(chit.monthlyContribution || 0)}
              className="w-full border rounded-lg px-3 py-3 mt-0.5 text-xl font-bold text-center disabled:opacity-50" />
            <p className="text-xs text-gray-400 mt-1">
              May be less than the fixed {formatCurrency(chit.monthlyContribution)} contribution if a dividend reduced it this month.
            </p>
          </div>

          <div>
            <label className="text-xs text-gray-500">Dividend Received (if any)</label>
            <input type="number" inputMode="numeric" value={dividendReceived}
              onChange={(e) => setDividendReceived(e.target.value)} disabled={busy}
              placeholder="0" className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
            <input type="checkbox" checked={isPrizedMonth}
              onChange={(e) => setIsPrizedMonth(e.target.checked)} disabled={busy} />
            I won (was prized) this month
          </label>

          {isPrizedMonth && (
            <div>
              <label className="text-xs text-gray-500">Prize Amount Received</label>
              <input type="number" inputMode="numeric" value={prizeAmountReceived}
                onChange={(e) => setPrizeAmountReceived(e.target.value)} disabled={busy}
                placeholder={String(chit.totalValue || 0)}
                className="w-full border rounded-lg px-3 py-3 mt-0.5 text-xl font-bold text-center disabled:opacity-50" />
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500">Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy}
              className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>

          <button onClick={handleSubmit} disabled={busy}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-lg mt-2 disabled:opacity-60">
            {isSaving ? 'Saving...' : 'Save'}
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
                <Trash2 size={16} /> Delete this month
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
