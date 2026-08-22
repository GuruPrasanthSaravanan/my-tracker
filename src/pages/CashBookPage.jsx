import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppData } from '../contexts/DataContext';
import SummaryCard from '../components/SummaryCard';
import TransactionRow from '../components/TransactionRow';
import FAB from '../components/FAB';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EntryForm from '../components/EntryForm';
import ReconcileModal from '../components/ReconcileModal';
import TransferForm from '../components/TransferForm';
import { formatCurrency, getTodayISO, shiftMonth, monthLabel } from '../utils/formatters';
import { ArrowLeftRight, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

export default function CashBookPage() {
  const { cashBook, lists: listsData, accountSettings, accountTypeFavorites, subCategories } = useAppData();
  const { rows, isLoading, addEntry, editEntry, deleteEntry, addTransfer, totalBalance, accountBalances } = cashBook;
  const { lists, addListItem } = listsData;
  const { minBalances, setMinBalance } = accountSettings;
  const [showForm, setShowForm] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferPrefill, setTransferPrefill] = useState(null);
  const [editingRow, setEditingRow] = useState(null); // { index, data }
  const [reconcileAccount, setReconcileAccount] = useState(null);
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [toast, setToast] = useState(null);

  // Transaction list filters - default to the current month across all
  // accounts, narrowed down from there. Kept separate from the summary
  // cards' account balances above (those are always all-time, all-account).
  const [filterMonth, setFilterMonth] = useState(getTodayISO().slice(0, 7));
  const [filterAccount, setFilterAccount] = useState('');

  // Dashboard's Quick Actions (and the funding-warning "Transfer Now"
  // shortcut) navigate here with state telling us to open a form
  // immediately, instead of landing on the page and requiring a second tap.
  // Consumed once and cleared from history state so it doesn't re-trigger
  // on a later back/forward navigation or refresh.
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (location.state?.openForm) setShowForm(true);
    if (location.state?.openTransfer) {
      setShowTransferForm(true);
      if (location.state?.transferPrefill) setTransferPrefill(location.state.transferPrefill);
    }
    if (location.state?.openForm || location.state?.openTransfer) {
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveTransfer = async (transfer) => {
    try {
      await addTransfer(transfer);
      setShowTransferForm(false);
      setTransferPrefill(null);
      setToast({ message: 'Transfer recorded!', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save transfer. Check internet.', type: 'error' });
    }
  };

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
        project: row[6] || '',
        subCategory: row[7] || '',
      },
    });
  };

  const handleSaveCorrection = async (diff) => {
    try {
      await addEntry({
        date: getTodayISO(),
        description: 'Balance correction',
        account: reconcileAccount,
        type: 'ADJUSTMENT',
        moneyIn: diff > 0 ? diff : '',
        moneyOut: diff < 0 ? Math.abs(diff) : '',
      });
      // Best-effort: register ADJUSTMENT as a known Type for future manual entries.
      addListItem('types', 'ADJUSTMENT').catch(() => {});
      setToast({ message: 'Balance corrected!', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save correction.', type: 'error' });
    }
  };

  const handleSaveMinBalance = async (value) => {
    try {
      await setMinBalance(reconcileAccount, value);
      setToast({ message: 'Minimum balance saved!', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save minimum balance.', type: 'error' });
    }
  };

  const filteredRows = rows.map((row, i) => [row, i])
    .filter(([row]) => row[0] || row[1] || row[4] || row[5]) // skip cleared rows
    .filter(([row]) => !filterMonth || (row[0] || '').startsWith(filterMonth))
    .filter(([row]) => !filterAccount || row[2] === filterAccount);
  const filteredSpend = filteredRows.reduce((sum, [row]) => sum + (parseFloat(row[5]) || 0), 0);

  const nonZeroAccounts = Array.from(accountBalances.entries())
    .filter(([, val]) => val !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const ACCOUNT_PREVIEW_COUNT = 6;
  const previewAccounts = nonZeroAccounts.slice(0, ACCOUNT_PREVIEW_COUNT);
  const hasMoreAccounts = nonZeroAccounts.length > ACCOUNT_PREVIEW_COUNT;

  return (
    <div>
      {/* Summary Section - kept compact (top N accounts) since it's sticky;
          "Show all" expands into a separate, normally-scrolling section
          below instead of growing the sticky box itself. */}
      <div className="sticky top-0 bg-gray-50 z-10 pb-3">
        <div className="bg-primary text-white rounded-2xl p-4 mb-3">
          <p className="text-xs opacity-80">Total Balance</p>
          <p className="text-2xl font-bold">{formatCurrency(totalBalance)}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {previewAccounts.map(([account, balance]) => (
            <SummaryCard
              key={account}
              label={account}
              amount={balance}
              color={balance > 0 ? 'green' : balance < 0 ? 'red' : 'gray'}
              minBalance={minBalances.get(account)}
              onClick={() => setReconcileAccount(account)}
            />
          ))}
        </div>

        {hasMoreAccounts && (
          <button onClick={() => setShowAllAccounts((v) => !v)}
            className="w-full text-center text-xs text-primary font-medium mt-2">
            {showAllAccounts ? 'Hide extra accounts' : `Show all ${nonZeroAccounts.length} accounts`}
          </button>
        )}
      </div>

      {/* Remaining accounts beyond the sticky preview above - non-sticky, so
          it doesn't grow the sticky header, and deliberately only the
          leftover accounts (not the full list again) to avoid showing the
          same preview accounts twice. */}
      {showAllAccounts && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {nonZeroAccounts.slice(ACCOUNT_PREVIEW_COUNT).map(([account, balance]) => (
            <SummaryCard
              key={account}
              label={account}
              amount={balance}
              color={balance > 0 ? 'green' : balance < 0 ? 'red' : 'gray'}
              minBalance={minBalances.get(account)}
              onClick={() => setReconcileAccount(account)}
            />
          ))}
        </div>
      )}

      {/* Transaction List - filterable by month and account, since "what did
          I spend from X account in August" is a common question that
          scrolling the full, unbounded list doesn't answer well. */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setFilterMonth(shiftMonth(filterMonth, -1))} className="p-1"><ChevronLeft size={18} /></button>
          <h2 className="text-sm font-semibold text-gray-900">{monthLabel(filterMonth)}</h2>
          <button onClick={() => setFilterMonth(shiftMonth(filterMonth, 1))} className="p-1"><ChevronRight size={18} /></button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">All accounts</option>
            {lists.accounts.map((acc) => <option key={acc} value={acc}>{acc}</option>)}
          </select>
          <button onClick={() => setFilterMonth(getTodayISO().slice(0, 7))}
            className="text-xs text-primary font-medium px-2 whitespace-nowrap">
            This month
          </button>
        </div>

        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-500">
            Transactions ({filteredRows.length})
            {filterAccount ? ` \u00b7 ${filterAccount}` : ''}
          </h2>
          <span className="text-sm font-semibold text-danger">
            {formatCurrency(filteredSpend)} spent
          </span>
        </div>

        {isLoading ? (
          <LoadingSkeleton rows={8} />
        ) : filteredRows.length === 0 ? (
          <p className="text-center text-gray-400 py-8">
            {rows.length === 0 ? 'No entries yet. Tap + to add one.' : 'No entries match this filter.'}
          </p>
        ) : (
          [...filteredRows].reverse().map(([row, originalIndex]) => (
            <button key={originalIndex} onClick={() => openEdit(originalIndex, row)}
              className="w-full text-left active:bg-gray-50 transition">
              <TransactionRow
                date={row[0]}
                description={row[1]}
                badge={row[2]}
                amount={parseFloat(row[4]) || parseFloat(row[5]) || 0}
                isIncome={!!parseFloat(row[4])}
              />
            </button>
          ))
        )}
      </div>

      <FAB actions={[
        { label: 'Add Entry', icon: Plus, onClick: () => setShowForm(true) },
        { label: 'Transfer', icon: ArrowLeftRight, onClick: () => setShowTransferForm(true) },
      ]} />

      {showForm && (
        <EntryForm
          type="cashbook"
          lists={lists}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
          onAddListItem={addListItem}
          cashBookRows={rows}
          favoritesForAccount={accountTypeFavorites.favoritesForAccount}
          onToggleFavorite={accountTypeFavorites.toggleFavorite}
          subCategoriesForType={subCategories.subCategoriesForType}
          onAddSubCategory={subCategories.addSubCategory}
        />
      )}

      {editingRow && (
        <EntryForm
          type="cashbook"
          lists={lists}
          isEditing
          onAddListItem={addListItem}
          initialData={editingRow.data}
          onSave={handleEdit}
          onDelete={handleDelete}
          onClose={() => setEditingRow(null)}
          cashBookRows={rows}
          favoritesForAccount={accountTypeFavorites.favoritesForAccount}
          onToggleFavorite={accountTypeFavorites.toggleFavorite}
          subCategoriesForType={subCategories.subCategoriesForType}
          onAddSubCategory={subCategories.addSubCategory}
        />
      )}

      {showTransferForm && (
        <TransferForm
          accountOptions={lists.accounts}
          onAddAccount={(v) => addListItem('accounts', v)}
          initial={transferPrefill}
          onSave={handleSaveTransfer}
          onClose={() => { setShowTransferForm(false); setTransferPrefill(null); }}
        />
      )}

      {reconcileAccount && (
        <ReconcileModal
          account={reconcileAccount}
          currentBalance={accountBalances.get(reconcileAccount) || 0}
          minBalance={minBalances.get(reconcileAccount)}
          onSaveCorrection={handleSaveCorrection}
          onSaveMinBalance={handleSaveMinBalance}
          onClose={() => setReconcileAccount(null)}
        />
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
