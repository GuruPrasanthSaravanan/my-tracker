import { useState } from 'react';
import { useDebts } from '../hooks/useDebts';
import ProgressBar from '../components/ProgressBar';
import DebtRow from '../components/DebtRow';
import FAB from '../components/FAB';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EntryForm from '../components/EntryForm';
import { formatCurrency } from '../utils/formatters';

export default function DebtsPage() {
  const { debtRows, payoffRows, isLoading, addPayment, progress } = useDebts();
  const [showForm, setShowForm] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [toast, setToast] = useState(null);

  const handleSave = async (entry) => {
    try {
      await addPayment({
        debtName: selectedDebt || entry.description,
        month: entry.date,
        payment: entry.amount,
        remaining: '',
      });
      setShowForm(false);
      setToast({ message: 'Payment recorded!', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save.', type: 'error' });
    }
  };

  const currentTarget = progress.activeDebts.length > 0
    ? progress.activeDebts.sort((a, b) => a.priority - b.priority)[0]
    : null;

  const displayDebt = selectedDebt || currentTarget?.name;
  const debtPayoffs = payoffRows.filter((r) => r.debtName === displayDebt);

  // Build full list: active debts + cleared debts, sorted by priority
  const allDebts = [
    ...progress.activeDebts,
    ...debtRows
      .filter((r) => (r[6] || '').toLowerCase() === 'cleared')
      .map((r) => ({
        priority: parseInt(r[0]) || 0,
        name: r[1] || '',
        originalAmount: parseFloat(r[2]) || 0,
        interestRate: parseFloat(r[3]) || 0,
        targetDate: r[4] || '',
        debitsFrom: r[5] || '',
        status: 'Cleared',
      })),
  ].sort((a, b) => a.priority - b.priority);

  return (
    <div>
      {/* Progress Header */}
      <div className="sticky top-0 bg-gray-50 z-10 pb-3">
        <div className="bg-gradient-to-r from-primary to-blue-700 text-white rounded-2xl p-4 mb-3">
          <p className="text-xs opacity-80">Debt Freedom Progress</p>
          <p className="text-2xl font-bold">{Math.round(progress.percentCleared)}% Cleared</p>
          <ProgressBar
            value={progress.totalCleared}
            max={progress.totalOriginal}
            color="success"
            showLabel={false}
          />
          <div className="flex justify-between text-xs opacity-80 mt-2">
            <span>Cleared: {formatCurrency(progress.totalCleared)}</span>
            <span>Total: {formatCurrency(progress.totalOriginal)}</span>
          </div>
          {currentTarget && (
            <p className="text-xs mt-2 opacity-90">
              Currently attacking: <span className="font-semibold">{currentTarget.name}</span>
              {currentTarget.interestRate > 0 && ` (${currentTarget.interestRate}%)`}
            </p>
          )}
        </div>
      </div>

      {/* Priority List */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">
          Debt Priority List ({allDebts.length})
        </h2>
        {isLoading ? (
          <LoadingSkeleton rows={6} />
        ) : allDebts.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No debts tracked yet.</p>
        ) : (
          allDebts.map((debt) => (
            <div key={debt.name} onClick={() => setSelectedDebt(selectedDebt === debt.name ? null : debt.name)}>
              <DebtRow debt={debt} isCleared={debt.status === 'Cleared'} />
            </div>
          ))
        )}
      </div>

      {/* Payoff Tracker */}
      {displayDebt && debtPayoffs.length > 0 && (
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">
            Payoff History: {displayDebt}
          </h2>
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
        </div>
      )}

      <FAB onClick={() => setShowForm(true)} />

      {showForm && (
        <EntryForm
          type="debt-payment"
          lists={{ accounts: [], types: [], vendors: [], projects: [] }}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
