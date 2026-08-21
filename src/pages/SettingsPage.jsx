import { useState } from 'react';
import { useAppData } from '../contexts/DataContext';
import { useAuth } from '../auth/useAuth';
import { SPREADSHEET_ID } from '../config';
import Toast from '../components/Toast';
import { X, Download, LogOut, ExternalLink } from 'lucide-react';

const LIST_TABS = [
  { key: 'accounts', label: 'Accounts' },
  { key: 'types', label: 'Types' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'projects', label: 'Projects' },
  { key: 'milestoneStatuses', label: 'Milestone Statuses' },
];

export default function SettingsPage() {
  const { lists, cashBook, vendors, projects, emiLoans, handLoans, creditCards, monthly, netWorth } = useAppData();
  const { user, signOut } = useAuth();
  const [activeListTab, setActiveListTab] = useState('accounts');
  const [removing, setRemoving] = useState(null);
  const [toast, setToast] = useState(null);
  const notify = (message, type = 'success') => setToast({ message, type });

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
        </p>
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

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
