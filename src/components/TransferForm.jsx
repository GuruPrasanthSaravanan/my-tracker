import { useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import Dropdown from './Dropdown';
import { getTodayISO } from '../utils/formatters';

/**
 * Records a self-transfer between two of the user's own CashBook accounts
 * (e.g. moving this month's "wants" allowance from ICICI to AXIS) as a
 * single matched pair of entries instead of two separate manual ones - see
 * bugs-and-lessons.md for why this needed its own flow rather than just
 * telling the user to add two CashBook entries themselves.
 */
export default function TransferForm({ accountOptions, onAddAccount, onSave, onClose }) {
  const [date, setDate] = useState(getTodayISO());
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (isSaving) return;
    if (!date) return setError('Please enter a date.');
    if (!fromAccount) return setError('Please choose the account to transfer from.');
    if (!toAccount) return setError('Please choose the account to transfer to.');
    if (fromAccount === toAccount) return setError('From and To accounts must be different.');
    if (!amount || parseFloat(amount) <= 0) return setError('Please enter an amount.');
    setError('');
    setIsSaving(true);
    try {
      await onSave({ date, fromAccount, toAccount, amount: parseFloat(amount), description });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Transfer Between Accounts</h2>
          <button onClick={onClose} disabled={isSaving} className="p-1"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          {error && <div className="bg-red-50 text-danger text-sm px-3 py-2 rounded-lg">{error}</div>}

          <div>
            <label className="text-xs text-gray-500">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              disabled={isSaving} className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Dropdown label="From" options={accountOptions} value={fromAccount} onChange={setFromAccount} onAddNew={onAddAccount} />
            </div>
            <ArrowRight size={18} className="text-gray-300 mt-4 shrink-0" />
            <div className="flex-1">
              <Dropdown label="To" options={accountOptions} value={toAccount} onChange={setToAccount} onAddNew={onAddAccount} />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Amount</label>
            <input type="number" inputMode="numeric" value={amount}
              onChange={(e) => setAmount(e.target.value)} disabled={isSaving}
              placeholder="0" className="w-full border rounded-lg px-3 py-3 mt-0.5 text-xl font-bold text-center disabled:opacity-50" />
          </div>

          <div>
            <label className="text-xs text-gray-500">Description (optional)</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Wants allowance for the month" disabled={isSaving}
              className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>

          <p className="text-xs text-gray-400">
            This creates two matched CashBook entries (Money Out from the source, Money In to the destination) so
            both account balances update together.
          </p>

          <button onClick={handleSubmit} disabled={isSaving}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-lg mt-2 disabled:opacity-60">
            {isSaving ? 'Saving...' : 'Save Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}
