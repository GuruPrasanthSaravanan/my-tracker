import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import Dropdown from './Dropdown';
import CashBookLinkToggle from './CashBookLinkToggle';
import { getTodayISO } from '../utils/formatters';

const titles = {
  cashbook: 'CashBook Entry',
  vendors: 'Vendor Entry',
  project: 'Project',
  milestone: 'Milestone',
  'debt-payment': 'Debt Payment',
};

const placeholders = {
  cashbook: 'e.g., Salary, EMI, Paid vendor',
  vendors: 'e.g., Cement 50 bags, Labour week 1',
  project: 'e.g., House Construction, Land Purchase',
  milestone: 'e.g., Foundation complete, Roof done',
  'debt-payment': 'e.g., Home Loan, Friend\'s Loan',
};

const showDirection = { cashbook: true, vendors: true };
const showAmount = { cashbook: true, vendors: true, project: true, 'debt-payment': true };

/** Generate a unique project code from a name, avoiding collisions with existing codes. */
function makeUniqueProjectCode(name, existingCodes = []) {
  const base = name.toUpperCase().replace(/\s+/g, '-').slice(0, 16) || 'PROJECT';
  if (!existingCodes.includes(base)) return base;
  let i = 2;
  let candidate = `${base}-${i}`;
  while (existingCodes.includes(candidate)) {
    i++;
    candidate = `${base}-${i}`;
  }
  return candidate;
}

export default function EntryForm({ type, lists, onSave, onClose, initialData, onDelete, isEditing, onAddListItem, existingProjectCodes }) {
  const [form, setForm] = useState(initialData || {
    date: getTodayISO(),
    description: '',
    account: '',
    type: '',
    vendor: '',
    project: '',
    amount: '',
    direction: 'out',
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [logToCashBook, setLogToCashBook] = useState(!isEditing);
  const [cashBookAccount, setCashBookAccount] = useState('');

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  // Paying a vendor only updates the Vendors tab's own balance - it doesn't
  // touch CashBook, so without this a CashBook account balance can drift
  // from reality. Only offered for a brand-new "Paid" entry, not on edits
  // (to avoid re-logging the same payment every time it's corrected).
  const showCashBookLink = type === 'vendors' && form.direction === 'out' && !isEditing;

  // A CashBook entry only asks which project it's for when Type=PROJECT is
  // selected - money spent on a project directly via CashBook (not routed
  // through the Vendors tab) then counts toward that project's spend too.
  const showProjectField = type === 'cashbook' && form.type === 'PROJECT';

  const validate = () => {
    if (showAmount[type] && !form.amount) return 'Please enter an amount.';
    if (!showAmount[type] && !form.description) return 'Please enter a description.';
    if (type === 'cashbook' && !form.account) return 'Please select an Account.';
    if (type === 'cashbook' && !form.type) return 'Please select a Type.';
    if (showProjectField && !form.project) return 'Please select which project this is for.';
    if (type === 'vendors' && !form.vendor) return 'Please select a Vendor.';
    if (showCashBookLink && logToCashBook && !cashBookAccount) {
      return 'Please choose an account to log this payment in CashBook, or uncheck the option.';
    }
    if (type === 'project' && !form.description) return 'Please enter a project name.';
    return '';
  };

  const handleSubmit = async () => {
    if (isSaving || isDeleting) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');

    let payload;
    if (type === 'cashbook') {
      payload = {
        date: form.date,
        description: form.description,
        account: form.account,
        type: form.type,
        moneyIn: form.direction === 'in' ? form.amount : '',
        moneyOut: form.direction === 'out' ? form.amount : '',
        // Only ever set for Type=PROJECT entries - see isProjectType below -
        // so this money counts toward that project's spend alongside Vendors bills.
        project: form.type === 'PROJECT' ? form.project : '',
      };
    } else if (type === 'vendors') {
      payload = {
        date: form.date,
        vendor: form.vendor,
        description: form.description,
        project: form.project,
        bill: form.direction === 'in' ? form.amount : '',
        paid: form.direction === 'out' ? form.amount : '',
        logToCashBook: showCashBookLink && logToCashBook,
        cashBookAccount: showCashBookLink && logToCashBook ? cashBookAccount : null,
      };
    } else if (type === 'project') {
      payload = {
        code: isEditing && initialData?.code
          ? initialData.code
          : makeUniqueProjectCode(form.description, existingProjectCodes || []),
        name: form.description,
        budget: form.amount || '',
        estLabour: '', estMaterial: '', estMachine: '', estOther: '',
        startDate: form.date,
        endDatePlanned: '',
        manager: '',
        status: 'Not Started',
        notes: '',
      };
    } else if (type === 'milestone') {
      payload = {
        milestone: form.description,
        plannedDate: form.date,
        actualDate: '',
        status: 'Not Started',
        notes: '',
      };
    } else if (type === 'debt-payment') {
      payload = {
        description: form.description,
        date: form.date,
        amount: form.amount,
      };
    }

    setIsSaving(true);
    try {
      await onSave(payload);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isSaving || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  const busy = isSaving || isDeleting;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8 max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{isEditing ? 'Edit' : 'New'} {titles[type] || 'Entry'}</h2>
          <button onClick={onClose} className="p-1" disabled={busy}><X size={20} /></button>
        </div>

        <div className="space-y-3">
          {error && (
            <div className="bg-red-50 text-danger text-sm px-3 py-2 rounded-lg">{error}</div>
          )}

          <div>
            <label className="text-xs text-gray-500">Date</label>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)}
              disabled={busy}
              className="w-full border rounded-lg px-3 py-2 mt-1 disabled:opacity-50" />
          </div>

          {type === 'cashbook' && (
            <>
              <Dropdown label="Account" options={lists.accounts} value={form.account} onChange={(v) => set('account', v)}
                onAddNew={onAddListItem ? (v) => onAddListItem('accounts', v) : undefined} />
              <Dropdown label="Type" options={lists.types} value={form.type} onChange={(v) => set('type', v)}
                onAddNew={onAddListItem ? (v) => onAddListItem('types', v) : undefined} />
              {showProjectField && (
                <Dropdown label="Project" options={lists.projects} value={form.project} onChange={(v) => set('project', v)}
                  onAddNew={onAddListItem ? (v) => onAddListItem('projects', v) : undefined} />
              )}
            </>
          )}

          {type === 'vendors' && (
            <>
              <Dropdown label="Vendor" options={lists.vendors} value={form.vendor} onChange={(v) => set('vendor', v)}
                onAddNew={onAddListItem ? (v) => onAddListItem('vendors', v) : undefined} />
              <Dropdown label="Project" options={lists.projects} value={form.project} onChange={(v) => set('project', v)}
                onAddNew={onAddListItem ? (v) => onAddListItem('projects', v) : undefined} />
            </>
          )}

          <div>
            <label className="text-xs text-gray-500">
              {type === 'project' ? 'Project Name' : type === 'milestone' ? 'Milestone' : 'Description'}
            </label>
            <input type="text" value={form.description} onChange={(e) => set('description', e.target.value)}
              placeholder={placeholders[type] || ''}
              disabled={busy}
              className="w-full border rounded-lg px-3 py-2 mt-1 disabled:opacity-50" />
          </div>

          {showDirection[type] && (
            <div>
              <label className="text-xs text-gray-500">
                {type === 'cashbook' ? 'Money Direction' : 'Transaction Type'}
              </label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={() => set('direction', 'in')}
                  disabled={busy}
                  className={`py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                    form.direction === 'in' ? 'bg-success text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {type === 'cashbook' ? 'Money IN' : 'Bill (they gave)'}
                </button>
                <button
                  onClick={() => set('direction', 'out')}
                  disabled={busy}
                  className={`py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                    form.direction === 'out' ? 'bg-danger text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {type === 'cashbook' ? 'Money OUT' : 'Paid (I gave)'}
                </button>
              </div>
            </div>
          )}

          {showAmount[type] && (
            <div>
              <label className="text-xs text-gray-500">
                {type === 'project' ? 'Budget' : 'Amount'}
              </label>
              <input type="number" inputMode="numeric" value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
                placeholder="0"
                disabled={busy}
                className="w-full border rounded-lg px-3 py-3 mt-1 text-xl font-bold text-center disabled:opacity-50" />
            </div>
          )}

          {showCashBookLink && (
            <CashBookLinkToggle
              checked={logToCashBook}
              onCheckedChange={setLogToCashBook}
              account={cashBookAccount}
              onAccountChange={setCashBookAccount}
              accountOptions={lists.accounts}
              onAddAccount={onAddListItem ? (v) => onAddListItem('accounts', v) : undefined}
              disabled={busy}
            />
          )}

          <button onClick={handleSubmit} disabled={busy}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-lg active:scale-98 transition mt-2 disabled:opacity-60">
            {isSaving ? 'Saving...' : (isEditing ? 'Update' : 'Save')}
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
                <Trash2 size={16} /> Delete this entry
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
