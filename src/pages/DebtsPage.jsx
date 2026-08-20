import { useState } from 'react';
import { useDebts } from '../hooks/useDebts';
import { useLists } from '../hooks/useLists';
import ProgressBar from '../components/ProgressBar';
import DebtRow from '../components/DebtRow';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { formatCurrency } from '../utils/formatters';
import { X, Plus, Pencil } from 'lucide-react';

function DebtForm({ title, initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || {
    priority: '', name: '', originalAmount: '', interestRate: '',
    targetDate: '', debitsFrom: '', status: 'Active',
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8 max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="p-1"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Priority</label>
              <input type="number" inputMode="numeric" value={form.priority}
                onChange={(e) => set('priority', e.target.value)}
                placeholder="1" className="w-full border rounded-lg px-3 py-2 mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 mt-0.5">
                <option value="Active">Active</option>
                <option value="Cleared">Cleared</option>
                <option value="Lent">Lent (I gave)</option>
                <option value="Recovered">Recovered</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Name / Description</label>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="e.g., Friend's Loan, Gold Loan, Lent to Raju"
              className="w-full border rounded-lg px-3 py-2 mt-0.5" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Amount</label>
              <input type="number" inputMode="numeric" value={form.originalAmount}
                onChange={(e) => set('originalAmount', e.target.value)}
                placeholder="0" className="w-full border rounded-lg px-3 py-2 mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Interest %</label>
              <input type="number" inputMode="decimal" value={form.interestRate}
                onChange={(e) => set('interestRate', e.target.value)}
                placeholder="0" className="w-full border rounded-lg px-3 py-2 mt-0.5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Target Date</label>
              <input type="text" value={form.targetDate} onChange={(e) => set('targetDate', e.target.value)}
                placeholder="e.g., Sep 2027" className="w-full border rounded-lg px-3 py-2 mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Debits From</label>
              <input type="text" value={form.debitsFrom} onChange={(e) => set('debitsFrom', e.target.value)}
                placeholder="e.g., HDFC, CASH" className="w-full border rounded-lg px-3 py-2 mt-0.5" />
            </div>
          </div>
          <button onClick={() => onSave(form)}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-lg mt-2">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentForm({ debtName, onSave, onClose }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ month: today, amount: '', remaining: '' });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Record Payment: {debtName}</h2>
          <button onClick={onClose} className="p-1"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Month / Date</label>
            <input type="text" value={form.month} onChange={(e) => setForm(f => ({ ...f, month: e.target.value }))}
              placeholder="e.g., Sep 2026" className="w-full border rounded-lg px-3 py-2 mt-0.5" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Payment Amount</label>
            <input type="number" inputMode="numeric" value={form.amount}
              onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="0" className="w-full border rounded-lg px-3 py-3 mt-0.5 text-xl font-bold text-center" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Remaining Balance (optional)</label>
            <input type="number" inputMode="numeric" value={form.remaining}
              onChange={(e) => setForm(f => ({ ...f, remaining: e.target.value }))}
              placeholder="0" className="w-full border rounded-lg px-3 py-2 mt-0.5" />
          </div>
          <button onClick={() => onSave({ debtName, month: form.month, payment: form.amount, remaining: form.remaining })}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-lg mt-2">
            Save Payment
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DebtsPage() {
  const { debtRows, debts, lends, payoffRows, isLoading, addDebt, editDebt, addPayment, progress, _debtIndexOf } = useDebts();
  const { lists } = useLists();
  const [showForm, setShowForm] = useState(null); // null | 'add-debt' | 'add-lend' | 'payment' | 'edit'
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [editingDebt, setEditingDebt] = useState(null); // { index, data }
  const [toast, setToast] = useState(null);

  const handleAddDebt = async (entry) => {
    try {
      await addDebt(entry);
      setShowForm(null);
      setToast({ message: 'Debt added!', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save.', type: 'error' });
    }
  };

  const handleEditDebt = async (entry) => {
    try {
      await editDebt(editingDebt.index, entry);
      setShowForm(null);
      setEditingDebt(null);
      setToast({ message: 'Debt updated!', type: 'success' });
    } catch {
      setToast({ message: 'Failed to update.', type: 'error' });
    }
  };

  const handlePayment = async (entry) => {
    try {
      await addPayment(entry);
      setShowForm(null);
      setToast({ message: 'Payment recorded!', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save.', type: 'error' });
    }
  };

  const openEdit = (row) => {
    const idx = _debtIndexOf(row);
    setEditingDebt({
      index: idx,
      data: {
        priority: row[0] || '',
        name: row[1] || '',
        originalAmount: row[2] || '',
        interestRate: row[3] || '',
        targetDate: row[4] || '',
        debitsFrom: row[5] || '',
        status: row[6] || 'Active',
      },
    });
    setShowForm('edit');
  };

  const currentTarget = progress.activeDebts.length > 0
    ? progress.activeDebts.sort((a, b) => a.priority - b.priority)[0]
    : null;

  const displayDebt = selectedDebt || currentTarget?.name;
  const debtPayoffs = payoffRows.filter((r) => r.debtName === displayDebt);

  // Parse all debts (not lends) for display
  const allDebts = debtRows
    .filter((r) => (r[6] || '').toLowerCase() !== 'lent' && (r[6] || '').toLowerCase() !== 'recovered')
    .map((r) => ({
      _raw: r,
      priority: parseInt(r[0]) || 0,
      name: r[1] || '',
      originalAmount: parseFloat(r[2]) || 0,
      interestRate: parseFloat(r[3]) || 0,
      targetDate: r[4] || '',
      debitsFrom: r[5] || '',
      status: r[6] || 'Active',
    }))
    .sort((a, b) => a.priority - b.priority);

  // Parse lends
  const allLends = debtRows
    .filter((r) => (r[6] || '').toLowerCase() === 'lent' || (r[6] || '').toLowerCase() === 'recovered')
    .map((r) => ({
      _raw: r,
      priority: parseInt(r[0]) || 0,
      name: r[1] || '',
      originalAmount: parseFloat(r[2]) || 0,
      interestRate: parseFloat(r[3]) || 0,
      targetDate: r[4] || '',
      debitsFrom: r[5] || '',
      status: r[6] || 'Lent',
    }))
    .sort((a, b) => a.priority - b.priority);

  const totalLent = allLends.filter(l => l.status === 'Lent').reduce((s, l) => s + l.originalAmount, 0);

  return (
    <div>
      {/* Progress Header */}
      <div className="sticky top-0 bg-gray-50 z-10 pb-3">
        <div className="bg-gradient-to-r from-primary to-blue-700 text-white rounded-2xl p-4 mb-3">
          <p className="text-xs opacity-80">Debt Freedom Progress</p>
          <p className="text-2xl font-bold">{Math.round(progress.percentCleared)}% Cleared</p>
          <ProgressBar value={progress.totalCleared} max={progress.totalOriginal} color="success" showLabel={false} />
          <div className="flex justify-between text-xs opacity-80 mt-2">
            <span>Cleared: {formatCurrency(progress.totalCleared)}</span>
            <span>Total: {formatCurrency(progress.totalOriginal)}</span>
          </div>
          {currentTarget && (
            <p className="text-xs mt-2 opacity-90">
              Attacking: <span className="font-semibold">{currentTarget.name}</span>
              {currentTarget.interestRate > 0 && ` (${currentTarget.interestRate}%)`}
            </p>
          )}
        </div>
      </div>

      {/* Debts I Owe */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-500">Debts I Owe ({allDebts.length})</h2>
          <button onClick={() => setShowForm('add-debt')} className="text-xs text-primary font-medium flex items-center gap-1">
            <Plus size={14} /> Add Debt
          </button>
        </div>
        {isLoading ? (
          <LoadingSkeleton rows={6} />
        ) : allDebts.length === 0 ? (
          <p className="text-center text-gray-400 py-4">No debts tracked.</p>
        ) : (
          allDebts.map((debt) => (
            <div key={debt.name} className="flex items-center">
              <button className="flex-1 text-left active:bg-gray-50"
                onClick={() => setSelectedDebt(selectedDebt === debt.name ? null : debt.name)}>
                <DebtRow debt={debt} isCleared={debt.status === 'Cleared'} />
              </button>
              <button onClick={() => openEdit(debt._raw)} className="p-2 text-gray-400">
                <Pencil size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Payoff Tracker */}
      {displayDebt && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-500">
              {debtPayoffs.length > 0 ? `Payoff: ${displayDebt}` : displayDebt}
            </h2>
            <button onClick={() => { setSelectedDebt(displayDebt); setShowForm('payment'); }}
              className="text-xs text-primary font-medium flex items-center gap-1">
              <Plus size={14} /> Record Payment
            </button>
          </div>
          {debtPayoffs.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">Month</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">Payment</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {debtPayoffs.map((row, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-3 py-2">{row.month}</td>
                      <td className="px-3 py-2 text-right text-success font-medium">{formatCurrency(row.payment)}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{row.remaining ? formatCurrency(row.remaining) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Money I Lent */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-500">Money I Lent ({allLends.length})</h2>
          <button onClick={() => setShowForm('add-lend')} className="text-xs text-primary font-medium flex items-center gap-1">
            <Plus size={14} /> Add Lend
          </button>
        </div>
        {totalLent > 0 && (
          <div className="bg-amber-50 rounded-lg p-3 mb-2">
            <p className="text-xs text-amber-700">Total Outstanding Lends</p>
            <p className="text-lg font-bold text-amber-600">{formatCurrency(totalLent)}</p>
          </div>
        )}
        {allLends.length === 0 ? (
          <p className="text-center text-gray-400 py-4">No money lent out.</p>
        ) : (
          allLends.map((lend) => (
            <div key={lend.name} className="flex items-center">
              <button className="flex-1 text-left active:bg-gray-50"
                onClick={() => setSelectedDebt(selectedDebt === lend.name ? null : lend.name)}>
                <DebtRow debt={lend} isCleared={lend.status === 'Recovered'} />
              </button>
              <button onClick={() => openEdit(lend._raw)} className="p-2 text-gray-400">
                <Pencil size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Forms */}
      {showForm === 'add-debt' && (
        <DebtForm title="Add New Debt" onSave={handleAddDebt} onClose={() => setShowForm(null)} />
      )}

      {showForm === 'add-lend' && (
        <DebtForm
          title="Record Money Lent"
          initial={{ priority: '', name: '', originalAmount: '', interestRate: '0', targetDate: '', debitsFrom: '', status: 'Lent' }}
          onSave={handleAddDebt}
          onClose={() => setShowForm(null)}
        />
      )}

      {showForm === 'edit' && editingDebt && (
        <DebtForm title="Edit Debt/Lend" initial={editingDebt.data} onSave={handleEditDebt} onClose={() => { setShowForm(null); setEditingDebt(null); }} />
      )}

      {showForm === 'payment' && displayDebt && (
        <PaymentForm debtName={displayDebt} onSave={handlePayment} onClose={() => setShowForm(null)} />
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
