import { useState } from 'react';
import { X } from 'lucide-react';
import Dropdown from './Dropdown';

const titles = {
  cashbook: 'New CashBook Entry',
  vendors: 'New Vendor Entry',
  project: 'New Project',
  milestone: 'New Milestone',
  'debt-payment': 'Record Debt Payment',
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

export default function EntryForm({ type, lists, onSave, onClose }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    date: today,
    description: '',
    account: '',
    type: '',
    vendor: '',
    project: '',
    amount: '',
    direction: 'out',
  });

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = () => {
    if (showAmount[type] && !form.amount) return;
    if (!showAmount[type] && !form.description) return;

    if (type === 'cashbook') {
      onSave({
        date: form.date,
        description: form.description,
        account: form.account,
        type: form.type,
        moneyIn: form.direction === 'in' ? form.amount : '',
        moneyOut: form.direction === 'out' ? form.amount : '',
      });
    } else if (type === 'vendors') {
      onSave({
        date: form.date,
        vendor: form.vendor,
        description: form.description,
        project: form.project,
        bill: form.direction === 'in' ? form.amount : '',
        paid: form.direction === 'out' ? form.amount : '',
      });
    } else if (type === 'project') {
      onSave({
        code: form.description.toUpperCase().replace(/\s+/g, '-').slice(0, 10),
        name: form.description,
        budget: form.amount || '',
        estLabour: '', estMaterial: '', estMachine: '', estOther: '',
        startDate: form.date,
        endDatePlanned: '',
        manager: '',
        status: 'Not Started',
        notes: '',
      });
    } else if (type === 'milestone') {
      onSave({
        milestone: form.description,
        plannedDate: form.date,
        actualDate: '',
        status: 'Not Started',
        notes: '',
      });
    } else if (type === 'debt-payment') {
      onSave({
        description: form.description,
        date: form.date,
        amount: form.amount,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8 max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{titles[type] || 'New Entry'}</h2>
          <button onClick={onClose} className="p-1"><X size={20} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Date</label>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mt-1" />
          </div>

          {type === 'cashbook' && (
            <>
              <Dropdown label="Account" options={lists.accounts} value={form.account} onChange={(v) => set('account', v)} />
              <Dropdown label="Type" options={lists.types} value={form.type} onChange={(v) => set('type', v)} />
            </>
          )}

          {type === 'vendors' && (
            <>
              <Dropdown label="Vendor" options={lists.vendors} value={form.vendor} onChange={(v) => set('vendor', v)} />
              <Dropdown label="Project" options={lists.projects} value={form.project} onChange={(v) => set('project', v)} />
            </>
          )}

          <div>
            <label className="text-xs text-gray-500">
              {type === 'project' ? 'Project Name' : type === 'milestone' ? 'Milestone' : 'Description'}
            </label>
            <input type="text" value={form.description} onChange={(e) => set('description', e.target.value)}
              placeholder={placeholders[type] || ''}
              className="w-full border rounded-lg px-3 py-2 mt-1" />
          </div>

          {showDirection[type] && (
            <div>
              <label className="text-xs text-gray-500">
                {type === 'cashbook' ? 'Money Direction' : 'Transaction Type'}
              </label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={() => set('direction', 'in')}
                  className={`py-2 rounded-lg text-sm font-medium transition ${
                    form.direction === 'in' ? 'bg-success text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {type === 'cashbook' ? 'Money IN' : 'Bill (they gave)'}
                </button>
                <button
                  onClick={() => set('direction', 'out')}
                  className={`py-2 rounded-lg text-sm font-medium transition ${
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
                className="w-full border rounded-lg px-3 py-3 mt-1 text-xl font-bold text-center" />
            </div>
          )}

          <button onClick={handleSubmit}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-lg active:scale-98 transition mt-2">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
