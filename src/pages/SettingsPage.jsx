import { useState } from 'react';
import { useAppData } from '../contexts/DataContext';
import { useAuth } from '../auth/useAuth';
import { SPREADSHEET_ID } from '../config';
import { useSheetHealth } from '../hooks/useSheetHealth';
import { formatCurrency } from '../utils/formatters';
import Toast from '../components/Toast';
import { X, Pencil, Download, LogOut, ExternalLink, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

const LIST_TABS = [
  { key: 'accounts', label: 'Accounts' },
  { key: 'types', label: 'Types' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'projects', label: 'Projects' },
  { key: 'milestoneStatuses', label: 'Milestone Statuses' },
];

const ACCOUNT_TYPES = ['Savings', 'Current', 'Salary', 'Wallet/UPI', 'Cash', 'Other'];

function AccountInfoForm({ account, initial, onSave, onClose }) {
  const [form, setForm] = useState(initial);
  const [isSaving, setIsSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (isSaving) return;
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
          <h2 className="text-lg font-bold">{account}</h2>
          <button onClick={onClose} disabled={isSaving} className="p-1"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Minimum Balance</label>
              <input type="number" inputMode="numeric" value={form.minBalance}
                onChange={(e) => set('minBalance', e.target.value)} disabled={isSaving}
                placeholder="0" className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Account Type</label>
              <select value={form.accountType} onChange={(e) => set('accountType', e.target.value)} disabled={isSaving}
                className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50">
                <option value="">-</option>
                {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Purpose</label>
            <input type="text" value={form.purpose} onChange={(e) => set('purpose', e.target.value)}
              placeholder="e.g., Emergency Fund, Daily Use, Investments" disabled={isSaving}
              className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Account Number (last 4 recommended)</label>
              <input type="text" value={form.accountNumber} onChange={(e) => set('accountNumber', e.target.value)}
                disabled={isSaving} className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">IFSC</label>
              <input type="text" value={form.ifsc} onChange={(e) => set('ifsc', e.target.value)}
                disabled={isSaving} className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Branch</label>
            <input type="text" value={form.branch} onChange={(e) => set('branch', e.target.value)}
              disabled={isSaving} className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Relationship Manager</label>
              <input type="text" value={form.rmName} onChange={(e) => set('rmName', e.target.value)}
                disabled={isSaving} className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">RM Contact</label>
              <input type="text" value={form.rmContact} onChange={(e) => set('rmContact', e.target.value)}
                disabled={isSaving} className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
          </div>
          <p className="text-xs text-gray-400 flex items-start gap-1">
            <Info size={12} className="shrink-0 mt-0.5" />
            Stored in your private Google Sheet only, same as everything else in the app. Avoid storing full card
            numbers, PINs, or CVVs - not needed for tracking, and best kept out of any spreadsheet.
          </p>
          <button onClick={handleSubmit} disabled={isSaving}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-lg mt-2 disabled:opacity-60">
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Renames a list value everywhere it's used (see api/lists.js
 * CASCADE_TARGETS) - not just the dropdown. Warns (but doesn't block) if the
 * new name collides with another existing value in the same list, since
 * that would merge the two together - which could be intentional (e.g.
 * fixing "ICICI" and "Icici" into one) but shouldn't happen silently.
 */
function RenameListValueForm({ listLabel, oldValue, existingValues, onSave, onClose }) {
  const [newValue, setNewValue] = useState(oldValue);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const collision = existingValues.some((v) => v !== oldValue && v.toLowerCase() === newValue.trim().toLowerCase());

  const handleSubmit = async () => {
    if (isSaving) return;
    if (!newValue.trim()) return setError('Please enter a value.');
    setError('');
    setIsSaving(true);
    try {
      await onSave(newValue.trim());
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Rename {listLabel} Value</h2>
          <button onClick={onClose} disabled={isSaving} className="p-1"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          {error && <div className="bg-red-50 text-danger text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div>
            <label className="text-xs text-gray-500">New Value</label>
            <input type="text" value={newValue} onChange={(e) => setNewValue(e.target.value)}
              disabled={isSaving} autoFocus
              className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>
          {collision && (
            <p className="text-xs text-amber-600 flex items-start gap-1">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              "{newValue.trim()}" already exists in this list - saving will merge every "{oldValue}" entry into it.
            </p>
          )}
          <p className="text-xs text-gray-400">
            Updates every past entry that used "{oldValue}" across the whole app (CashBook, loans, monthly plans,
            etc.), not just this dropdown - so balances and totals stay correct after the rename.
          </p>
          <button onClick={handleSubmit} disabled={isSaving}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-lg mt-2 disabled:opacity-60">
            {isSaving ? 'Renaming...' : 'Rename'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Same shape as RenameListValueForm, but scoped to a single Type - a
 * sub-category rename only ever needs to check for collisions and cascade
 * within its own Type (see useSubCategories.jsx's renameSubCategory).
 */
function RenameSubCategoryForm({ type, oldValue, existingValues, onSave, onClose }) {
  const [newValue, setNewValue] = useState(oldValue);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const collision = existingValues.some((v) => v !== oldValue && v.toLowerCase() === newValue.trim().toLowerCase());

  const handleSubmit = async () => {
    if (isSaving) return;
    if (!newValue.trim()) return setError('Please enter a value.');
    setError('');
    setIsSaving(true);
    try {
      await onSave(newValue.trim());
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Rename Sub-Category</h2>
          <button onClick={onClose} disabled={isSaving} className="p-1"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          {error && <div className="bg-red-50 text-danger text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div>
            <label className="text-xs text-gray-500">New Name (under {type})</label>
            <input type="text" value={newValue} onChange={(e) => setNewValue(e.target.value)}
              disabled={isSaving} autoFocus
              className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>
          {collision && (
            <p className="text-xs text-amber-600 flex items-start gap-1">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              "{newValue.trim()}" already exists under {type} - saving will merge every "{oldValue}" entry into it.
            </p>
          )}
          <p className="text-xs text-gray-400">
            Updates every past CashBook entry tagged with "{oldValue}" under {type}, so the Monthly page's
            sub-category breakdown stays correct after the rename.
          </p>
          <button onClick={handleSubmit} disabled={isSaving}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-lg mt-2 disabled:opacity-60">
            {isSaving ? 'Renaming...' : 'Rename'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const {
    lists, cashBook, vendors, projects, emiLoans, handLoans, creditCards, chitFunds,
    monthly, netWorth, accountSettings, accountTypeFavorites, subCategories,
  } = useAppData();
  const { user, signOut } = useAuth();
  const sheetHealth = useSheetHealth();
  const [activeListTab, setActiveListTab] = useState('accounts');
  const [removing, setRemoving] = useState(null);
  const [renamingValue, setRenamingValue] = useState(null);
  const [editingAccount, setEditingAccount] = useState(null);
  const [newAccountName, setNewAccountName] = useState('');
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [confirmDeleteOrphan, setConfirmDeleteOrphan] = useState(null);
  const [isDeletingOrphan, setIsDeletingOrphan] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [activeSubCategoryType, setActiveSubCategoryType] = useState('');
  const [newSubCategoryName, setNewSubCategoryName] = useState('');
  const [isAddingSubCategory, setIsAddingSubCategory] = useState(false);
  const [removingSubCategory, setRemovingSubCategory] = useState(null);
  const [renamingSubCategory, setRenamingSubCategory] = useState(null);
  const [toast, setToast] = useState(null);
  const notify = (message, type = 'success') => setToast({ message, type });

  // Defaults to the first Type once the list loads, rather than staying
  // blank forever - mirrors activeListTab's fixed default above, just
  // computed since Types (unlike the fixed LIST_TABS) are user-defined.
  const subCategoryType = activeSubCategoryType || lists.lists.types?.[0] || '';

  const handleRemove = async (value) => {
    setRemoving(value);
    try {
      await lists.removeListItem(activeListTab, value);
      notify(`Removed "${value}"`);
    } catch {
      notify('Failed to remove. It may still be in use elsewhere.', 'error');
    } finally {
      setRemoving(null);
    }
  };

  // A rename cascades across most of the app's tabs (see api/lists.js
  // CASCADE_TARGETS), so every hook whose tab could have been touched needs
  // to refetch afterward - otherwise the rest of the app would keep showing
  // stale pre-rename values until the next navigation/reload.
  const handleRename = async (newValue) => {
    try {
      const result = await lists.renameListItem(activeListTab, renamingValue, newValue);
      if (!result.renamed) {
        notify('Could not find that value to rename.', 'error');
        return;
      }
      await Promise.all([
        cashBook.refresh(), vendors.refresh(), projects.refresh(), emiLoans.refresh(),
        handLoans.refresh(), creditCards.refresh(), chitFunds.refresh(), monthly.refresh(),
        accountSettings.refresh(), accountTypeFavorites.refresh(), subCategories.refresh(),
      ]);
      setRenamingValue(null);
      notify(`Renamed to "${newValue}"${result.cellsUpdated > 0 ? ` - updated ${result.cellsUpdated} other entr${result.cellsUpdated === 1 ? 'y' : 'ies'}.` : '.'}`);
    } catch {
      notify('Failed to rename. Please try again.', 'error');
    }
  };

  const handleAddSubCategory = async () => {
    if (isAddingSubCategory || !newSubCategoryName.trim() || !subCategoryType) return;
    setIsAddingSubCategory(true);
    try {
      await subCategories.addSubCategory(subCategoryType, newSubCategoryName.trim());
      setNewSubCategoryName('');
      notify('Sub-category added!');
    } catch {
      notify('Failed to add sub-category.', 'error');
    } finally {
      setIsAddingSubCategory(false);
    }
  };

  const handleRemoveSubCategory = async (value) => {
    setRemovingSubCategory(value);
    try {
      await subCategories.deleteSubCategory(subCategoryType, value);
      notify(`Removed "${value}"`);
    } catch {
      notify('Failed to remove.', 'error');
    } finally {
      setRemovingSubCategory(null);
    }
  };

  // Cascades into every past CashBook entry tagged with this sub-category
  // under this same Type (see useSubCategories.jsx renameSubCategory) - so
  // CashBook needs a refresh too, not just the sub-category list itself.
  const handleRenameSubCategory = async (newValue) => {
    try {
      const result = await subCategories.renameSubCategory(subCategoryType, renamingSubCategory, newValue);
      if (!result.renamed) {
        notify('Could not find that sub-category to rename.', 'error');
        return;
      }
      await cashBook.refresh();
      setRenamingSubCategory(null);
      notify(`Renamed to "${newValue}"${result.cellsUpdated > 0 ? ` - updated ${result.cellsUpdated} other entr${result.cellsUpdated === 1 ? 'y' : 'ies'}.` : '.'}`);
    } catch {
      notify('Failed to rename. Please try again.', 'error');
    }
  };

  const handleSaveAccountInfo = async (form) => {
    try {
      await accountSettings.setAccountInfo(editingAccount, form);
      setEditingAccount(null);
      notify('Account info saved!');
    } catch {
      notify('Failed to save.', 'error');
    }
  };

  // Adding/removing an account here is really just the Accounts list under
  // the hood (same as the "Accounts" tab in Manage Lists above) - surfaced
  // again in this section too so you don't have to scroll up to add a new
  // account before you can immediately tap in and fill its details.
  const handleAddAccount = async () => {
    if (isAddingAccount || !newAccountName.trim()) return;
    setIsAddingAccount(true);
    try {
      await lists.addListItem('accounts', newAccountName.trim());
      setNewAccountName('');
      notify('Account added!');
    } catch {
      notify('Failed to add account.', 'error');
    } finally {
      setIsAddingAccount(false);
    }
  };

  const handleDeleteAccount = async (account) => {
    if (isDeletingAccount) return;
    setIsDeletingAccount(true);
    try {
      await lists.removeListItem('accounts', account);
      setConfirmDeleteAccount(null);
      notify(`Removed "${account}".`);
    } catch {
      notify('Failed to remove. It may still be in use elsewhere.', 'error');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleDeleteOrphanTab = async (title) => {
    if (isDeletingOrphan) return;
    setIsDeletingOrphan(true);
    try {
      const deleted = await sheetHealth.deleteOrphanTab(title);
      notify(deleted ? `Deleted "${title}" tab.` : `No "${title}" tab found - already removed.`);
      setConfirmDeleteOrphan(null);
    } catch {
      notify('Failed to delete the tab.', 'error');
    } finally {
      setIsDeletingOrphan(false);
    }
  };

  const handleProvisionMissingTabs = async () => {
    if (isProvisioning) return;
    setIsProvisioning(true);
    try {
      await sheetHealth.provisionMissingTabs();
      notify('Missing tabs created!');
    } catch {
      notify('Failed to create missing tabs.', 'error');
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleExport = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      cashBook: cashBook.rows,
      vendors: vendors.rows,
      projects: projects.projects,
      milestones: projects.milestones,
      emiLoans: emiLoans.loans,
      handLoans: handLoans.loans,
      creditCards: creditCards.cards,
      monthlyPlans: monthly.plans,
      netWorthSnapshots: netWorth.snapshots,
      lists: lists.lists,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mytracker-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Export downloaded!');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-gray-900">Settings</h1>

      {/* Account */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          {user?.picture && <img src={user.picture} className="w-10 h-10 rounded-full" alt="" />}
          <div>
            <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
        </div>
        <button onClick={signOut}
          className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-medium">
          <LogOut size={16} /> Sign Out
        </button>
      </div>

      {/* Manage Lists */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-2">Manage Lists</h2>
        <div className="flex gap-1 overflow-x-auto pb-2 mb-2">
          {LIST_TABS.map((t) => (
            <button key={t.key} onClick={() => setActiveListTab(t.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                activeListTab === t.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="bg-white rounded-xl shadow-sm p-3">
          {lists.isLoading ? (
            <p className="text-sm text-gray-400 text-center py-2">Loading...</p>
          ) : (lists.lists[activeListTab] || []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-2">No values yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {lists.lists[activeListTab].map((value) => (
                <span key={value} className="flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2.5 py-1.5 rounded-full">
                  {value}
                  <button onClick={() => setRenamingValue(value)}
                    className="text-gray-400 hover:text-primary">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => handleRemove(value)} disabled={removing === value}
                    className="text-gray-400 hover:text-danger disabled:opacity-50">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Removing a value here only removes it from the dropdown - past entries that used it are unaffected.
          Renaming updates every past entry too, so balances and totals stay correct.
        </p>
      </div>

      {renamingValue && (
        <RenameListValueForm
          listLabel={LIST_TABS.find((t) => t.key === activeListTab)?.label || activeListTab}
          oldValue={renamingValue}
          existingValues={lists.lists[activeListTab] || []}
          onSave={handleRename}
          onClose={() => setRenamingValue(null)}
        />
      )}

      {/* Manage Sub-Categories - a second-level list scoped per-Type (e.g.
          Type=WANTS -> Dining/Shopping/Entertainment), so unlike Manage
          Lists above this needs a Type picker first, then the sub-category
          chips/add-input underneath it are all scoped to that Type. */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-2">Manage Sub-Categories</h2>
        {(lists.lists.types || []).length === 0 ? (
          <p className="text-sm text-gray-400 bg-white rounded-xl shadow-sm p-3">
            Add a Type under Manage Lists above first - sub-categories are scoped to a Type.
          </p>
        ) : (
          <>
            <div className="flex gap-1 overflow-x-auto pb-2 mb-2">
              {lists.lists.types.map((t) => (
                <button key={t} onClick={() => setActiveSubCategoryType(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                    subCategoryType === t ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="bg-white rounded-xl shadow-sm p-3 mb-2">
              {subCategories.isLoading ? (
                <p className="text-sm text-gray-400 text-center py-2">Loading...</p>
              ) : subCategories.subCategoriesForType(subCategoryType).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-2">No sub-categories under {subCategoryType} yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {subCategories.subCategoriesForType(subCategoryType).map((value) => (
                    <span key={value} className="flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2.5 py-1.5 rounded-full">
                      {value}
                      <button onClick={() => setRenamingSubCategory(value)}
                        className="text-gray-400 hover:text-primary">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => handleRemoveSubCategory(value)} disabled={removingSubCategory === value}
                        className="text-gray-400 hover:text-danger disabled:opacity-50">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newSubCategoryName} onChange={(e) => setNewSubCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSubCategory()}
                placeholder={`New sub-category under ${subCategoryType}`} disabled={isAddingSubCategory}
                className="flex-1 border rounded-lg px-3 py-2 text-sm disabled:opacity-50" />
              <button onClick={handleAddSubCategory} disabled={isAddingSubCategory || !newSubCategoryName.trim()}
                className="bg-primary text-white px-4 rounded-lg text-sm font-medium disabled:opacity-50">
                {isAddingSubCategory ? 'Adding...' : 'Add'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Removing a sub-category here only removes it from the dropdown - past entries that used it are
              unaffected. Renaming updates every past CashBook entry tagged with it under this Type.
            </p>
          </>
        )}
      </div>

      {renamingSubCategory && (
        <RenameSubCategoryForm
          type={subCategoryType}
          oldValue={renamingSubCategory}
          existingValues={subCategories.subCategoriesForType(subCategoryType)}
          onSave={handleRenameSubCategory}
          onClose={() => setRenamingSubCategory(null)}
        />
      )}

      {/* Account Info */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-2">Account Info</h2>
        <p className="text-xs text-gray-400 mb-2">
          Tap an account to add details like account number, IFSC, branch, relationship manager, and minimum
          balance (also settable from the Reconcile screen on CashBook).
        </p>
        <div className="flex gap-2 mb-2">
          <input type="text" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddAccount()}
            placeholder="New account name" disabled={isAddingAccount}
            className="flex-1 border rounded-lg px-3 py-2 text-sm disabled:opacity-50" />
          <button onClick={handleAddAccount} disabled={isAddingAccount || !newAccountName.trim()}
            className="bg-primary text-white px-4 rounded-lg text-sm font-medium disabled:opacity-50">
            {isAddingAccount ? 'Adding...' : 'Add'}
          </button>
        </div>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {(lists.lists.accounts || []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No accounts in your Lists tab yet.</p>
          ) : (
            lists.lists.accounts.map((account) => {
              const info = accountSettings.accountsInfo.get(account);
              return (
                <div key={account} className="flex items-center border-b border-gray-100 last:border-0">
                  <button onClick={() => setEditingAccount(account)}
                    className="flex-1 flex items-center justify-between px-3 py-2.5 text-left active:bg-gray-50">
                    <div>
                      <p className="text-sm text-gray-900">{account}</p>
                      {info?.purpose && <p className="text-xs text-gray-400">{info.purpose}</p>}
                    </div>
                    {info?.minBalance > 0 && (
                      <span className="text-xs text-gray-500">Min: {formatCurrency(info.minBalance)}</span>
                    )}
                  </button>
                  {confirmDeleteAccount === account ? (
                    <div className="flex items-center gap-1 pr-3">
                      <button onClick={() => handleDeleteAccount(account)} disabled={isDeletingAccount}
                        className="text-xs text-danger font-medium px-2 py-1 disabled:opacity-50">
                        {isDeletingAccount ? '...' : 'Confirm'}
                      </button>
                      <button onClick={() => setConfirmDeleteAccount(null)} disabled={isDeletingAccount}
                        className="text-xs text-gray-400 px-2 py-1">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteAccount(account)}
                      className="text-gray-300 hover:text-danger px-3 py-2.5">
                      <X size={14} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Export */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-2">Export</h2>
        <button onClick={handleExport}
          className="w-full flex items-center justify-center gap-2 bg-white text-gray-700 py-3 rounded-xl shadow-sm text-sm font-medium">
          <Download size={16} /> Download All Data (JSON)
        </button>
      </div>

      {/* About */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-2">About</h2>
        <div className="bg-white rounded-xl shadow-sm p-4 text-sm text-gray-500 space-y-2">
          <p>MyTracker - Personal Finance Tracker</p>
          <a
            href={`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary text-xs font-medium"
          >
            Open Google Sheet <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Sheet Health */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-2">Sheet Health</h2>
        <p className="text-xs text-gray-400 mb-2">
          Compares your spreadsheet's actual tabs against what this app expects, so nothing gets left behind or
          silently drifts out of sync (e.g. an old tab from before a feature was rebuilt, like the legacy "Debts"
          tab from before EMI Loans/Hand Loans/Credit Cards existed).
        </p>
        {sheetHealth.isLoading ? (
          <p className="text-sm text-gray-400 text-center py-2 bg-white rounded-xl shadow-sm">Checking...</p>
        ) : (
          <div className="space-y-2">
            {sheetHealth.orphanTabs.length === 0 && sheetHealth.missingTabs.length === 0 && (
              <div className="bg-green-50 rounded-xl p-4 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-success shrink-0" />
                <p className="text-sm text-gray-700">All good - no unexpected or missing tabs.</p>
              </div>
            )}

            {sheetHealth.orphanTabs.length > 0 && (
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-sm text-gray-700 mb-2">
                  These tabs exist in your spreadsheet but aren't used by the app anymore - safe to review and delete.
                </p>
                <div className="space-y-2">
                  {sheetHealth.orphanTabs.map((title) => (
                    <div key={title} className="bg-white rounded-lg p-2.5 flex items-center justify-between gap-2">
                      <span className="text-sm text-gray-900 font-medium">{title}</span>
                      {confirmDeleteOrphan === title ? (
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => handleDeleteOrphanTab(title)} disabled={isDeletingOrphan}
                            className="bg-danger text-white px-3 py-1.5 rounded-lg font-semibold text-xs disabled:opacity-60">
                            {isDeletingOrphan ? 'Deleting...' : 'Confirm'}
                          </button>
                          <button onClick={() => setConfirmDeleteOrphan(null)} disabled={isDeletingOrphan}
                            className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg font-semibold text-xs disabled:opacity-60">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteOrphan(title)}
                          className="flex items-center gap-1 text-danger text-xs font-medium shrink-0">
                          <AlertTriangle size={13} /> Delete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sheetHealth.missingTabs.length > 0 && (
              <div className="bg-amber-50 rounded-xl p-4">
                <p className="text-sm text-gray-700 mb-2">
                  These tabs are expected but weren't found (they'll normally be created automatically next time the
                  app loads): {sheetHealth.missingTabs.join(', ')}
                </p>
                <button onClick={handleProvisionMissingTabs} disabled={isProvisioning}
                  className="w-full bg-white text-amber-700 py-2 rounded-lg font-semibold text-sm disabled:opacity-60">
                  {isProvisioning ? 'Creating...' : 'Create Missing Tabs Now'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {editingAccount && (
        <AccountInfoForm
          account={editingAccount}
          initial={{
            minBalance: String(accountSettings.accountsInfo.get(editingAccount)?.minBalance || ''),
            accountNumber: accountSettings.accountsInfo.get(editingAccount)?.accountNumber || '',
            ifsc: accountSettings.accountsInfo.get(editingAccount)?.ifsc || '',
            branch: accountSettings.accountsInfo.get(editingAccount)?.branch || '',
            accountType: accountSettings.accountsInfo.get(editingAccount)?.accountType || '',
            purpose: accountSettings.accountsInfo.get(editingAccount)?.purpose || '',
            rmName: accountSettings.accountsInfo.get(editingAccount)?.rmName || '',
            rmContact: accountSettings.accountsInfo.get(editingAccount)?.rmContact || '',
          }}
          onSave={handleSaveAccountInfo}
          onClose={() => setEditingAccount(null)}
        />
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
