import { useState } from 'react';
import { useAppData } from '../contexts/DataContext';
import ProgressBar from '../components/ProgressBar';
import DebtRow from '../components/DebtRow';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import MonthYearPicker from '../components/MonthYearPicker';
import { formatCurrency } from '../utils/formatters';
import { X, Plus, Pencil, Trash2 } from 'lucide-react';

function DebtForm({ title, initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || {
    priority: '', name: '', originalAmount: '', interestRate: '',
    targetDate: '', debitsFrom: '', status: 'Active',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (isSaving) return;
    if (!form.name.trim()) {
      setError('Please enter a name/description.');
      return;
    }
    if (!form.originalAmount) {
      setError('Please enter an amount.');
      return;
    }
    setError('');
    setIsSaving(true);
    try {
      await onSave(form);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8 max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="p-1" disabled={isSaving}><X size={20} /></button>
        </div>
        <div className="space-y-3">
          {error && (
            <div className="bg-red-50 text-danger text-sm px-3 py-2 rounded-lg">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Priority</label>
              <input type="number" inputMode="numeric" value={form.priority}
                onChange={(e) => set('priority', e.target.value)}
                disabled={isSaving}
                placeholder="1" className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)}
                disabled={isSaving}
                className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50">
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
              disabled={isSaving}
              className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Amount</label>
              <input type="number" inputMode="numeric" value={form.originalAmount}
                onChange={(e) => set('originalAmount', e.target.value)}
                disabled={isSaving}
                placeholder="0" className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Interest %</label>
              <input type="number" inputMode="decimal" value={form.interestRate}
                onChange={(e) => set('interestRate', e.target.value)}
                disabled={isSaving}
                placeholder="0" className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MonthYearPicker
              label="Target Date"
              value={form.targetDate}
              onChange={(v) => set('targetDate', v)}
              placeholder="e.g., Sep 2027"
              disabled={isSaving}
            />
            <div>
              <label className="text-xs text-gray-500">Debits From</label>
              <input type="text" value={form.debitsFrom} onChange={(e) => set('debitsFrom', e.target.value)}
                disabled={isSaving}
                placeholder="e.g., HDFC, CASH" className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
          </div>
          <button onClick={handleSubmit} disabled={isSaving}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-lg mt-2 disabled:opacity-60">
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentForm({ debtName, outstanding = 0, initial, isEditing, onSave, onDelete, onClose }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState(initial || { month: today, amount: '', remaining: '' });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const currentOutstanding = Math.max(outstanding - (parseFloat(form.amount) || 0), 0);
  const busy = isSaving || isDeleting;

  const handleSubmit = async () => {
    if (busy) return;
    if (!form.amount) {
      setError('Please enter a payment amount.');
      return;
    }
    setError('');
    setIsSaving(true);
    try {
      await onSave({
        debtName, month: form.month, payment: form.amount,
        remaining: isEditing ? form.remaining : (outstanding > 0 ? String(currentOutstanding) : form.remaining),
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
          <h2 className="text-lg font-bold">{isEditing ? 'Edit' : 'Record'} Payment: {debtName}</h2>
          <button onClick={onClose} className="p-1" disabled={busy}><X size={20} /></button>
        </div>
        <div className="space-y-3">
          {error && (
            <div className="bg-red-50 text-danger text-sm px-3 py-2 rounded-lg">{error}</div>
          )}
          {!isEditing && outstanding > 0 && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Current Outstanding</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(outstanding)}</p>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500">Payment Date</label>
            <input type="date" value={form.month} onChange={(e) => setForm(f => ({ ...f, month: e.target.value }))}
              disabled={busy}
              className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Payment Amount</label>
            <input type="number" inputMode="numeric" value={form.amount}
              onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
              disabled={busy}
              placeholder="0" className="w-full border rounded-lg px-3 py-3 mt-0.5 text-xl font-bold text-center disabled:opacity-50" />
          </div>
          {isEditing && (
            <div>
              <label className="text-xs text-gray-500">Remaining Balance</label>
              <input type="number" inputMode="numeric" value={form.remaining}
                onChange={(e) => setForm(f => ({ ...f, remaining: e.target.value }))}
                disabled={busy}
                placeholder="0" className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
          )}
          {!isEditing && form.amount && outstanding > 0 && (
            <p className="text-xs text-gray-500 text-center">
              Remaining after payment: <span className="font-semibold text-gray-900">{formatCurrency(currentOutstanding)}</span>
            </p>
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

export default function DebtsPage() {
  const { debts: debtsData } = useAppData();
  const {
    debtRows, debts, lends, payoffRows, isLoading,
    addDebt, editDebt, addPayment, editPayment, deletePayment,
    progress, paidByDebt, _debtIndexOf, _paymentIndexOf,
  } = debtsData;
  const [showForm, setShowForm] = useState(null); // null | 'add-debt' | 'add-lend' | 'payment' | 'edit' | 'edit-payment'
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [editingDebt, setEditingDebt] = useState(null); // { index, data }
  const [editingPayment, setEditingPayment] = useState(null); // { index, data }
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

  const handleEditPayment = async (entry) => {
    try {
      await editPayment(editingPayment.index, entry);
      setShowForm(null);
      setEditingPayment(null);
      setToast({ message: 'Payment updated!', type: 'success' });
    } catch {
      setToast({ message: 'Failed to update.', type: 'error' });
    }
  };

  const handleDeletePayment = async () => {
    try {
      await deletePayment(editingPayment.index);
      setShowForm(null);
      setEditingPayment(null);
      setToast({ message: 'Payment deleted.', type: 'success' });
    } catch {
      setToast({ message: 'Failed to delete.', type: 'error' });
    }
  };

  const openEditPayment = (payoffRow) => {
    const idx = _paymentIndexOf(payoffRow);
    setEditingPayment({
      index: idx,
      data: {
        month: payoffRow.month || '',
        amount: String(payoffRow.payment || ''),
        remaining: String(payoffRow.remaining || ''),
      },
    });
    setShowForm('edit-payment');
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
                <DebtRow debt={debt} isCleared={debt.status === 'Cleared'} paid={paidByDebt[debt.name] || 0} />
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
                    <tr key={i} className="border-t border-gray-100 active:bg-gray-50 cursor-pointer"
                      onClick={() => openEditPayment(row)}>
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
                <DebtRow debt={lend} isCleared={lend.status === 'Recovered'} paid={paidByDebt[lend.name] || 0} />
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
        <PaymentForm
          debtName={displayDebt}
          outstanding={(() => {
            const d = debtRows.find((r) => r[1] === displayDebt);
            const orig = d ? parseFloat(d[2]) || 0 : 0;
            return Math.max(orig - (paidByDebt[displayDebt] || 0), 0);
          })()}
          onSave={handlePayment}
          onClose={() => setShowForm(null)}
        />
      )}

      {showForm === 'edit-payment' && editingPayment && (
        <PaymentForm
          debtName={displayDebt}
          isEditing
          initial={editingPayment.data}
          onSave={handleEditPayment}
          onDelete={handleDeletePayment}
          onClose={() => { setShowForm(null); setEditingPayment(null); }}
        />
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
