import { useState } from 'react';
import { useVendors } from '../hooks/useVendors';
import { useLists } from '../hooks/useLists';
import SummaryCard from '../components/SummaryCard';
import TransactionRow from '../components/TransactionRow';
import FAB from '../components/FAB';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EntryForm from '../components/EntryForm';
import { formatCurrency } from '../utils/formatters';

export default function VendorsPage() {
  const { rows, isLoading, addEntry, editEntry, deleteEntry, totalOwed, vendorBalances, projectBills } = useVendors();
  const { lists } = useLists();
  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [filterVendor, setFilterVendor] = useState(null);
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
    const bill = parseFloat(row[4]) || 0;
    setEditingRow({
      index: originalIndex,
      data: {
        date: row[0] || '',
        vendor: row[1] || '',
        description: row[2] || '',
        project: row[3] || '',
        amount: String(bill || parseFloat(row[5]) || ''),
        direction: bill ? 'in' : 'out',
      },
    });
  };

  // Build indexed rows for filtering while preserving original indices
  const indexedRows = rows.map((row, i) => ({ row, originalIndex: i }));
  const filteredRows = filterVendor
    ? indexedRows.filter(({ row }) => row[1] === filterVendor)
    : indexedRows;

  return (
    <div>
      {/* Vendor Summary */}
      <div className="sticky top-0 bg-gray-50 z-10 pb-3">
        <div className={`${totalOwed > 0 ? 'bg-danger' : 'bg-success'} text-white rounded-2xl p-4 mb-3`}>
          <p className="text-xs opacity-80">Total Owed to Vendors</p>
          <p className="text-2xl font-bold">{formatCurrency(totalOwed)}</p>
        </div>

        <div className="space-y-1">
          {Array.from(vendorBalances.entries())
            .filter(([, val]) => val !== 0)
            .sort((a, b) => b[1] - a[1])
            .map(([vendor, balance]) => (
              <button
                key={vendor}
                onClick={() => setFilterVendor(filterVendor === vendor ? null : vendor)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                  filterVendor === vendor ? 'bg-primary/10 border border-primary' : 'bg-white'
                }`}
              >
                <span className="font-medium">{vendor}</span>
                <span className={balance > 0 ? 'text-danger font-semibold' : 'text-success font-semibold'}>
                  {balance > 0 ? `Owe ${formatCurrency(balance)}` : `Adv ${formatCurrency(Math.abs(balance))}`}
                </span>
              </button>
            ))}
        </div>

        {/* Project Summary */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {Array.from(projectBills.entries())
            .filter(([proj]) => proj)
            .map(([proj, bills]) => (
              <SummaryCard key={proj} label={proj} amount={bills} color="blue" />
            ))}
        </div>
      </div>

      {/* Filter indicator */}
      {filterVendor && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
            Showing: {filterVendor}
          </span>
          <button onClick={() => setFilterVendor(null)} className="text-xs text-gray-400">Clear</button>
        </div>
      )}

      {/* Transaction List */}
      <div className="mt-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">
          Entries ({filteredRows.length})
        </h2>
        {isLoading ? (
          <LoadingSkeleton rows={8} />
        ) : filteredRows.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No entries yet. Tap + to add one.</p>
        ) : (
          [...filteredRows].reverse()
            .filter(({ row }) => row[0] || row[1] || row[4] || row[5]) // skip cleared rows
            .map(({ row, originalIndex }) => (
            <button key={originalIndex} onClick={() => openEdit(originalIndex, row)}
              className="w-full text-left active:bg-gray-50 transition">
              <TransactionRow
                date={row[0]}
                description={`${row[1]} - ${row[2]}`}
                badge={row[3]}
                amount={parseFloat(row[4]) || parseFloat(row[5]) || 0}
                isIncome={!!parseFloat(row[4])}
              />
            </button>
          ))
        )}
      </div>

      <FAB onClick={() => setShowForm(true)} />

      {showForm && (
        <EntryForm
          type="vendors"
          lists={lists}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}

      {editingRow && (
        <EntryForm
          type="vendors"
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
