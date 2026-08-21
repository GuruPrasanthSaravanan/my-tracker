import { useState } from 'react';
import { X } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

/**
 * Lets the user reconcile an account's app-computed balance against the
 * actual bank balance (creating a correcting CashBook entry for the
 * difference), and separately set/update the account's minimum balance
 * threshold used for the low-balance warning on its summary card.
 */
export default function ReconcileModal({ account, currentBalance, minBalance, onSaveCorrection, onSaveMinBalance, onClose }) {
  const [actualBalance, setActualBalance] = useState(String(currentBalance));
  const [minBalanceInput, setMinBalanceInput] = useState(minBalance != null ? String(minBalance) : '');
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingMin, setIsSavingMin] = useState(false);

  const diff = (parseFloat(actualBalance) || 0) - currentBalance;
  const busy = isSaving || isSavingMin;

  const handleCorrect = async () => {
    if (!diff || busy) return;
    setIsSaving(true);
    try {
      await onSaveCorrection(diff);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveMin = async () => {
    if (busy) return;
    setIsSavingMin(true);
    try {
      await onSaveMinBalance(parseFloat(minBalanceInput) || 0);
    } finally {
      setIsSavingMin(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8 max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Reconcile {account}</h2>
          <button onClick={onClose} disabled={busy} className="p-1"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">App Balance (from CashBook entries)</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(currentBalance)}</p>
          </div>

          <div>
            <label className="text-xs text-gray-500">Actual Bank Balance</label>
            <input type="number" inputMode="numeric" value={actualBalance}
              onChange={(e) => setActualBalance(e.target.value)}
              disabled={busy}
              className="w-full border rounded-lg px-3 py-3 mt-1 text-xl font-bold text-center disabled:opacity-50" />
          </div>

          {diff !== 0 && (
            <p className="text-sm text-center">
              Correction needed:{' '}
              <span className={diff > 0 ? 'text-success font-semibold' : 'text-danger font-semibold'}>
                {diff > 0 ? '+' : ''}{formatCurrency(diff)}
              </span>
            </p>
          )}

          <button onClick={handleCorrect} disabled={!diff || busy}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Apply Correction'}
          </button>

          <hr className="border-gray-100" />

          <div>
            <label className="text-xs text-gray-500">Minimum Balance for this Account</label>
            <input type="number" inputMode="numeric" value={minBalanceInput}
              onChange={(e) => setMinBalanceInput(e.target.value)}
              placeholder="e.g., 5000"
              disabled={busy}
              className="w-full border rounded-lg px-3 py-2 mt-1 disabled:opacity-50" />
            <p className="text-xs text-gray-400 mt-1">
              You'll see a warning on this account's card if its balance drops below this amount.
            </p>
          </div>
          <button onClick={handleSaveMin} disabled={busy}
            className="w-full bg-gray-100 text-gray-700 py-2.5 rounded-xl font-medium text-sm disabled:opacity-50">
            {isSavingMin ? 'Saving...' : 'Save Minimum Balance'}
          </button>
        </div>
      </div>
    </div>
  );
}
