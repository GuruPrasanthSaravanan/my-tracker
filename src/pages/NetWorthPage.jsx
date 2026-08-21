import { useState } from 'react';
import { useAppData } from '../contexts/DataContext';
import { formatCurrency, formatDate, getTodayISO } from '../utils/formatters';
import Toast from '../components/Toast';
import { Plus, X, Trash2 } from 'lucide-react';

function SnapshotForm({ assetsTotal, liabilitiesTotal, onSave, onClose }) {
  const [date, setDate] = useState(getTodayISO());
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (isSaving) return;
    if (!date) return setError('Please enter a date.');
    setError('');
    setIsSaving(true);
    try {
      await onSave({ date, assetsTotal, liabilitiesTotal, notes });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Log Net Worth Snapshot</h2>
          <button onClick={onClose} disabled={isSaving} className="p-1"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          {error && <div className="bg-red-50 text-danger text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Assets</span>
              <span className="font-semibold text-success">{formatCurrency(assetsTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Liabilities</span>
              <span className="font-semibold text-danger">{formatCurrency(liabilitiesTotal)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold mt-1 pt-1 border-t border-gray-200">
              <span>Net Worth</span>
              <span>{formatCurrency(assetsTotal - liabilitiesTotal)}</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              disabled={isSaving} className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              disabled={isSaving} className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>
          <button onClick={handleSubmit} disabled={isSaving}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-lg mt-2 disabled:opacity-60">
            {isSaving ? 'Saving...' : 'Save Snapshot'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NetWorthPage() {
  const { cashBook, vendors, emiLoans, handLoans, creditCards, netWorth } = useAppData();
  const [showForm, setShowForm] = useState(false);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState(null);
  const [toast, setToast] = useState(null);
  const notify = (message, type = 'success') => setToast({ message, type });

  // Assets: only positive CashBook account balances (an overdrawn/negative account is a liability, not an asset).
  const assetsTotal = Array.from(cashBook.accountBalances.values())
    .filter((v) => v > 0)
    .reduce((sum, v) => sum + v, 0);

  // Liabilities: negative CashBook balances + everything owed across all debt models + net vendor owed.
  const negativeCashBalances = Array.from(cashBook.accountBalances.values())
    .filter((v) => v < 0)
    .reduce((sum, v) => sum + Math.abs(v), 0);
  const liabilitiesTotal = negativeCashBalances
    + emiLoans.totalOutstanding
    + handLoans.totalOwed
    + creditCards.totalOutstanding
    + Math.max(vendors.totalOwed, 0);

  const currentNetWorth = assetsTotal - liabilitiesTotal;

  const handleSaveSnapshot = async (entry) => {
    try {
      await netWorth.addSnapshot(entry);
      setShowForm(false);
      notify('Snapshot logged!');
    } catch {
      notify('Failed to save.', 'error');
    }
  };

  const handleDeleteSnapshot = async (rowIndex) => {
    try {
      await netWorth.deleteSnapshot(rowIndex);
      setConfirmDeleteIndex(null);
      notify('Deleted.');
    } catch {
      notify('Failed to delete.', 'error');
    }
  };

  return (
    <div>
      <h1 className="text-lg font-bold text-gray-900 mb-4">Net Worth</h1>

      <div className="bg-primary text-white rounded-2xl p-4 mb-3">
        <p className="text-xs opacity-80">Net Worth (Right Now)</p>
        <p className="text-2xl font-bold">{formatCurrency(currentNetWorth)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Assets</p>
          <p className="text-lg font-bold text-success">{formatCurrency(assetsTotal)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Liabilities</p>
          <p className="text-lg font-bold text-danger">{formatCurrency(liabilitiesTotal)}</p>
        </div>
      </div>

      <button onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-semibold text-sm mb-4">
        <Plus size={18} /> Log a Snapshot
      </button>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-2">Trend ({netWorth.snapshots.length})</h2>
        {netWorth.isLoading ? (
          <p className="text-center text-gray-400 py-4">Loading...</p>
        ) : netWorth.snapshots.length === 0 ? (
          <p className="text-center text-gray-400 py-8">
            No snapshots logged yet. Log one periodically (e.g. quarterly) to see your net worth trend over time.
          </p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {[...netWorth.snapshots].reverse().map((s) => (
              <div key={s._rowIndex} className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm text-gray-900">{formatDate(s.date)}</p>
                  {s.notes && <p className="text-xs text-gray-400">{s.notes}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(s.netWorth)}</span>
                  {confirmDeleteIndex === s._rowIndex ? (
                    <div className="flex gap-1">
                      <button onClick={() => handleDeleteSnapshot(s._rowIndex)} className="text-xs text-danger font-medium">Confirm</button>
                      <button onClick={() => setConfirmDeleteIndex(null)} className="text-xs text-gray-400">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteIndex(s._rowIndex)} className="text-gray-300">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <SnapshotForm
          assetsTotal={assetsTotal}
          liabilitiesTotal={liabilitiesTotal}
          onSave={handleSaveSnapshot}
          onClose={() => setShowForm(false)}
        />
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
