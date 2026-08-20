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
  const { rows, isLoading, addEntry, editEntry, deleteEntry, totalBalance, accountBalances } = useCashBook();
  const { lists } = useLists();
  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState(null); // { index, data }
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

  const handleEdit = async (entry) => {
    try {
      await editEntry(editingRow.index, entry);
      setEditingRow(null);
      setToast({ message: 'Entry updated!', type: 'success' });
    } catch {
      setToast({ message: 'Failed to update.', type: 'error' });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteEntry(editingRow.index);
      setEditingRow(null);
      setToast({ message: 'Entry deleted.', type: 'success' });
    } catch {
      setToast({ message: 'Failed to delete.', type: 'error' });
    }
  };

  const openEdit = (originalIndex, row) => {
    const moneyIn = parseFloat(row[4]) || 0;
    setEditingRow({
      index: originalIndex,
      data: {
        date: row[0] || '',
        description: row[1] || '',
        account: row[2] || '',
        type: row[3] || '',
        amount: String(moneyIn || parseFloat(row[5]) || ''),
        direction: moneyIn ? 'in' : 'out',
      },
    });
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
          [...rows].map((row, i) => [row, i]).reverse().map(([row, originalIndex]) => (
            <div key={originalIndex} onClick={() => openEdit(originalIndex, row)} className="cursor-pointer">
              <TransactionRow
                date={row[0]}
                description={row[1]}
                badge={row[2]}
                amount={parseFloat(row[4]) || parseFloat(row[5]) || 0}
                isIncome={!!parseFloat(row[4])}
              />
            </div>
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

      {editingRow && (
        <EntryForm
          type="cashbook"
          lists={lists}
          isEditing
          initialData={editingRow.data}
          onSave={handleEdit}
          onDelete={handleDelete}
          onClose={() => setEditingRow(null)}
        />
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
