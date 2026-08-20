import { useState } from 'react';
import { useCashBook } from '../hooks/useCashBook';
import { useLists } from '../hooks/useLists';
import SummaryCard from '../components/SummaryCard';
import TransactionRow from '../components/TransactionRow';
import FAB from '../components/FAB';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EntryForm from '../components/EntryForm';
import { formatCurrency } from '../utils/formatters';

export default function CashBookPage() {
  const { rows, isLoading, addEntry, totalBalance, accountBalances } = useCashBook();
  const { lists } = useLists();
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState(null);

  const handleSave = async (entry) => {
    try {
      await addEntry(entry);
      setShowForm(false);
      setToast({ message: 'Entry saved!', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save. Check internet.', type: 'error' });
    }
  };

  return (
    <div>
      {/* Summary Section */}
      <div className="sticky top-0 bg-gray-50 z-10 pb-3">
        <div className="bg-primary text-white rounded-2xl p-4 mb-3">
          <p className="text-xs opacity-80">Total Balance</p>
          <p className="text-2xl font-bold">{formatCurrency(totalBalance)}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {Array.from(accountBalances.entries())
            .filter(([, val]) => val !== 0)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
            .slice(0, 6)
            .map(([account, balance]) => (
              <SummaryCard
                key={account}
                label={account}
                amount={balance}
                color={balance > 0 ? 'green' : balance < 0 ? 'red' : 'gray'}
              />
            ))}
        </div>
      </div>

      {/* Transaction List */}
      <div className="mt-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">
          Recent Transactions ({rows.length})
        </h2>
        {isLoading ? (
          <LoadingSkeleton rows={8} />
        ) : rows.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No entries yet. Tap + to add one.</p>
        ) : (
          [...rows].reverse().map((row, i) => (
            <TransactionRow
              key={i}
              date={row[0]}
              description={row[1]}
              badge={row[2]}
              amount={parseFloat(row[4]) || parseFloat(row[5]) || 0}
              isIncome={!!parseFloat(row[4])}
            />
          ))
        )}
      </div>

      <FAB onClick={() => setShowForm(true)} />

      {showForm && (
        <EntryForm
          type="cashbook"
          lists={lists}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
