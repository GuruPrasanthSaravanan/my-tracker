import { useState } from 'react';
import { useAppData } from '../contexts/DataContext';
import EMILoanCard from '../components/EMILoanCard';
import HandLoanRow from '../components/HandLoanRow';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { formatCurrency, formatDate } from '../utils/formatters';
import { splitPayment, computeSimpleInterestAccrued } from '../utils/loanCalculations';
import { X, Plus, Pencil, Trash2 } from 'lucide-react';

const today = () => new Date().toISOString().split('T')[0];

// ---------- EMI Loan Form ----------
function EMILoanForm({ initial, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(initial || {
    name: '', principal: '', annualRate: '', tenureMonths: '',
    startDate: today(), debitsFrom: '', status: 'Active', notes: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const busy = isSaving || isDeleting;

  const handleSubmit = async () => {
    if (busy) return;
    if (!form.name.trim()) return setError('Please enter a loan name.');
    if (!form.principal) return setError('Please enter the principal amount.');
    if (!form.tenureMonths) return setError('Please enter the tenure in months.');
    if (!form.startDate) return setError('Please enter the loan start date.');
    setError('');
    setIsSaving(true);
    try {
      await onSave(form);
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
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8 max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{initial ? 'Edit' : 'New'} EMI Loan</h2>
          <button onClick={onClose} disabled={busy} className="p-1"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          {error && <div className="bg-red-50 text-danger text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div>
            <label className="text-xs text-gray-500">Loan Name</label>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="e.g., Land Loan, Car Loan" disabled={busy}
              className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Principal Amount</label>
              <input type="number" inputMode="numeric" value={form.principal}
                onChange={(e) => set('principal', e.target.value)} disabled={busy}
                placeholder="0" className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Interest Rate % (annual)</label>
              <input type="number" inputMode="decimal" value={form.annualRate}
                onChange={(e) => set('annualRate', e.target.value)} disabled={busy}
                placeholder="0" className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Tenure (months)</label>
              <input type="number" inputMode="numeric" value={form.tenureMonths}
                onChange={(e) => set('tenureMonths', e.target.value)} disabled={busy}
                placeholder="e.g., 84" className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Loan Start Date</label>
              <input type="date" value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)} disabled={busy}
                className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Debits From</label>
              <input type="text" value={form.debitsFrom} onChange={(e) => set('debitsFrom', e.target.value)}
                placeholder="e.g., HDFC" disabled={busy}
                className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)} disabled={busy}
                className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50">
                <option value="Active">Active</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Notes</label>
            <input type="text" value={form.notes} onChange={(e) => set('notes', e.target.value)} disabled={busy}
              className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>

          <button onClick={handleSubmit} disabled={busy}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-lg mt-2 disabled:opacity-60">
            {isSaving ? 'Saving...' : 'Save'}
          </button>

          {initial && onDelete && (
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
                <Trash2 size={16} /> Delete this loan
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- EMI Loan Detail ----------
function EMILoanDetail({ loan, onEdit, onClose }) {
  const status = loan.emiStatus;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8 max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{loan.name}</h2>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="p-1 text-gray-400"><Pencil size={18} /></button>
            <button onClick={onClose} className="p-1"><X size={20} /></button>
          </div>
        </div>

        {status ? (
          <div className="space-y-3">
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Monthly EMI</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(status.emi)}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Outstanding Balance</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(status.outstandingBalance)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Installments</p>
                <p className="text-lg font-bold text-gray-900">{status.installmentsPaid} / {loan.tenureMonths}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Interest Paid So Far</p>
                <p className="text-lg font-bold text-danger">{formatCurrency(status.totalInterestPaid)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Principal Paid So Far</p>
                <p className="text-lg font-bold text-success">{formatCurrency(status.totalPrincipalPaid)}</p>
              </div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-xs text-amber-700">Total Interest Payable (Full Tenure)</p>
              <p className="text-lg font-bold text-amber-600">{formatCurrency(status.totalInterestPayable)}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Add a start date and tenure to see amortization details.</p>
        )}

        <div className="text-sm text-gray-500 space-y-1 mt-4">
          <p>Principal: <span className="text-gray-900">{formatCurrency(loan.principal)}</span></p>
          <p>Interest Rate: <span className="text-gray-900">{loan.annualRate}% per annum</span></p>
          <p>Loan Taken: <span className="text-gray-900">{formatDate(loan.startDate)}</span></p>
          {loan.debitsFrom && <p>Debits From: <span className="text-gray-900">{loan.debitsFrom}</span></p>}
          {loan.notes && <p>Notes: <span className="text-gray-900">{loan.notes}</span></p>}
        </div>
      </div>
    </div>
  );
}

// ---------- Hand Loan Form ----------
function HandLoanForm({ initial, direction, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(initial || {
    name: '', principal: '', annualRate: '0', startDate: today(),
    direction: direction || 'Owe', debitsFrom: '', status: 'Active', notes: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const busy = isSaving || isDeleting;

  const handleSubmit = async () => {
    if (busy) return;
    if (!form.name.trim()) return setError('Please enter a name/description.');
    if (!form.principal) return setError('Please enter the amount.');
    if (!form.startDate) return setError('Please enter the date.');
    setError('');
    setIsSaving(true);
    try {
      await onSave(form);
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
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8 max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            {initial ? 'Edit' : 'New'} {form.direction === 'Lent' ? 'Lend' : 'Hand Loan'}
          </h2>
          <button onClick={onClose} disabled={busy} className="p-1"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          {error && <div className="bg-red-50 text-danger text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div>
            <label className="text-xs text-gray-500">Name / Description</label>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="e.g., Friend's Loan, Gold Loan, Lent to Raju" disabled={busy}
              className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Amount</label>
              <input type="number" inputMode="numeric" value={form.principal}
                onChange={(e) => set('principal', e.target.value)} disabled={busy}
                placeholder="0" className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Interest % (annual, simple)</label>
              <input type="number" inputMode="decimal" value={form.annualRate}
                onChange={(e) => set('annualRate', e.target.value)} disabled={busy}
                placeholder="0" className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Date {form.direction === 'Lent' ? 'Lent' : 'Taken'}</label>
              <input type="date" value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)} disabled={busy}
                className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)} disabled={busy}
                className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50">
                <option value="Active">Active</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">{form.direction === 'Lent' ? 'Given From' : 'Debits From'}</label>
            <input type="text" value={form.debitsFrom} onChange={(e) => set('debitsFrom', e.target.value)}
              placeholder="e.g., HDFC, CASH" disabled={busy}
              className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Notes</label>
            <input type="text" value={form.notes} onChange={(e) => set('notes', e.target.value)} disabled={busy}
              className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>

          <button onClick={handleSubmit} disabled={busy}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-lg mt-2 disabled:opacity-60">
            {isSaving ? 'Saving...' : 'Save'}
          </button>

          {initial && onDelete && (
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
                <Trash2 size={16} /> Delete
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Hand Loan Payment Form ----------
function HandLoanPaymentForm({ loan, onSave, onClose }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const accruedInterest = computeSimpleInterestAccrued(
    loan.state.outstandingPrincipal, loan.annualRate, loan.state.lastEventDate, date
  );
  const preview = amount ? splitPayment(parseFloat(amount) || 0, accruedInterest) : null;

  const handleSubmit = async () => {
    if (isSaving) return;
    if (!amount) return setError('Please enter a payment amount.');
    setError('');
    setIsSaving(true);
    try {
      await onSave(parseFloat(amount), date);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Record Payment: {loan.name}</h2>
          <button onClick={onClose} disabled={isSaving} className="p-1"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          {error && <div className="bg-red-50 text-danger text-sm px-3 py-2 rounded-lg">{error}</div>}

          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Outstanding Principal</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(loan.state.outstandingPrincipal)}</p>
          </div>
          {accruedInterest > 0.5 && (
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-xs text-amber-700">Interest Accrued (since last payment)</p>
              <p className="text-lg font-bold text-amber-600">{formatCurrency(accruedInterest)}</p>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500">Payment Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              disabled={isSaving} className="w-full border rounded-lg px-3 py-2 mt-0.5 disabled:opacity-50" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Payment Amount</label>
            <input type="number" inputMode="numeric" value={amount}
              onChange={(e) => setAmount(e.target.value)} disabled={isSaving}
              placeholder="0" className="w-full border rounded-lg px-3 py-3 mt-0.5 text-xl font-bold text-center disabled:opacity-50" />
          </div>

          {preview && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Applied to Interest</span>
                <span className="font-semibold text-amber-600">{formatCurrency(preview.interestPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Applied to Principal</span>
                <span className="font-semibold text-success">{formatCurrency(preview.principalPaid)}</span>
              </div>
              {preview.remainingInterestDue > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Interest Still Due</span>
                  <span className="font-semibold text-danger">{formatCurrency(preview.remainingInterestDue)}</span>
                </div>
              )}
            </div>
          )}

          <button onClick={handleSubmit} disabled={isSaving}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-lg mt-2 disabled:opacity-60">
            {isSaving ? 'Saving...' : 'Save Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Hand Loan Detail ----------
function HandLoanDetail({ loan, onRecordPayment, onEdit, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8 max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{loan.name}</h2>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="p-1 text-gray-400"><Pencil size={18} /></button>
            <button onClick={onClose} className="p-1"><X size={20} /></button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Outstanding Principal</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(loan.state.outstandingPrincipal)}</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3">
            <p className="text-xs text-amber-700">Interest Accrued</p>
            <p className="text-lg font-bold text-amber-600">{formatCurrency(loan.state.accruedInterest)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Total Interest Paid</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(loan.state.totalInterestPaid)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Total Principal Paid</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(loan.state.totalPrincipalPaid)}</p>
          </div>
        </div>

        <div className="text-sm text-gray-500 space-y-1 mb-4">
          <p>Original Amount: <span className="text-gray-900">{formatCurrency(loan.principal)}</span></p>
          <p>Interest Rate: <span className="text-gray-900">{loan.annualRate}% per annum (simple interest)</span></p>
          <p>{loan.direction === 'Lent' ? 'Lent On' : 'Taken On'}: <span className="text-gray-900">{formatDate(loan.startDate)}</span></p>
          {loan.debitsFrom && <p>{loan.direction === 'Lent' ? 'Given From' : 'Debits From'}: <span className="text-gray-900">{loan.debitsFrom}</span></p>}
          {loan.notes && <p>Notes: <span className="text-gray-900">{loan.notes}</span></p>}
        </div>

        <button onClick={onRecordPayment}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-semibold text-sm mb-4">
          <Plus size={18} /> Record {loan.direction === 'Lent' ? 'Repayment Received' : 'Payment'}
        </button>

        {loan.state.payments.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-2">Payment History ({loan.state.payments.length})</h3>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">Date</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">Interest</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">Principal</th>
                  </tr>
                </thead>
                <tbody>
                  {[...loan.state.payments].reverse().map((p, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-3 py-2">{formatDate(p.date)}</td>
                      <td className="px-3 py-2 text-right text-amber-600">{formatCurrency(p.interestPaid)}</td>
                      <td className="px-3 py-2 text-right text-success">{formatCurrency(p.principalPaid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Main Page ----------
export default function DebtsPage() {
  const { emiLoans, handLoans } = useAppData();
  const [section, setSection] = useState('emi'); // 'emi' | 'hand'
  const [toast, setToast] = useState(null);

  // EMI state
  const [showEMIForm, setShowEMIForm] = useState(false);
  const [selectedEMILoan, setSelectedEMILoan] = useState(null);
  const [editingEMILoan, setEditingEMILoan] = useState(false);

  // Hand loan state
  const [showHandForm, setShowHandForm] = useState(null); // null | 'Owe' | 'Lent'
  const [selectedHandLoan, setSelectedHandLoan] = useState(null);
  const [editingHandLoan, setEditingHandLoan] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  // ----- EMI handlers -----
  const handleSaveEMI = async (entry) => {
    try {
      if (editingEMILoan && selectedEMILoan) {
        await emiLoans.editLoan(selectedEMILoan._rowIndex, entry);
      } else {
        await emiLoans.addLoan(entry);
      }
      setShowEMIForm(false);
      setEditingEMILoan(false);
      setSelectedEMILoan(null);
      setToast({ message: 'EMI loan saved!', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save.', type: 'error' });
    }
  };

  const handleDeleteEMI = async () => {
    try {
      await emiLoans.deleteLoan(selectedEMILoan._rowIndex);
      setShowEMIForm(false);
      setEditingEMILoan(false);
      setSelectedEMILoan(null);
      setToast({ message: 'EMI loan deleted.', type: 'success' });
    } catch {
      setToast({ message: 'Failed to delete.', type: 'error' });
    }
  };

  // ----- Hand loan handlers -----
  const handleSaveHandLoan = async (entry) => {
    try {
      if (editingHandLoan && selectedHandLoan) {
        await handLoans.editLoan(selectedHandLoan._rowIndex, entry);
      } else {
        await handLoans.addLoan(entry);
      }
      setShowHandForm(null);
      setEditingHandLoan(false);
      setSelectedHandLoan(null);
      setToast({ message: 'Saved!', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save.', type: 'error' });
    }
  };

  const handleDeleteHandLoan = async () => {
    try {
      await handLoans.deleteLoan(selectedHandLoan._rowIndex);
      setShowHandForm(null);
      setEditingHandLoan(false);
      setSelectedHandLoan(null);
      setToast({ message: 'Deleted.', type: 'success' });
    } catch {
      setToast({ message: 'Failed to delete.', type: 'error' });
    }
  };

  const handleRecordPayment = async (amount, date) => {
    try {
      await handLoans.addPayment(selectedHandLoan.name, amount, date);
      setShowPaymentForm(false);
      setSelectedHandLoan(null);
      setToast({ message: 'Payment recorded!', type: 'success' });
    } catch {
      setToast({ message: 'Failed to record payment.', type: 'error' });
    }
  };

  return (
    <div>
      {/* Segmented Toggle */}
      <div className="sticky top-0 bg-gray-50 z-10 pb-3">
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button onClick={() => setSection('emi')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
              section === 'emi' ? 'bg-white shadow-sm text-primary' : 'text-gray-500'
            }`}>
            EMI Loans
          </button>
          <button onClick={() => setSection('hand')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
              section === 'hand' ? 'bg-white shadow-sm text-primary' : 'text-gray-500'
            }`}>
            Hand Loans & Lending
          </button>
        </div>
      </div>

      {/* ----- EMI Loans Section ----- */}
      {section === 'emi' && (
        <div>
          <div className="bg-primary text-white rounded-2xl p-4 mb-3">
            <p className="text-xs opacity-80">Total EMI Outstanding</p>
            <p className="text-2xl font-bold">{formatCurrency(emiLoans.totalOutstanding)}</p>
            <p className="text-xs opacity-80 mt-1">Monthly EMI: {formatCurrency(emiLoans.totalMonthlyEMI)}</p>
          </div>

          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-500">EMI Loans ({emiLoans.loans.length})</h2>
            <button onClick={() => { setEditingEMILoan(false); setSelectedEMILoan(null); setShowEMIForm(true); }}
              className="text-xs text-primary font-medium flex items-center gap-1">
              <Plus size={14} /> Add EMI Loan
            </button>
          </div>

          {emiLoans.isLoading ? (
            <LoadingSkeleton rows={4} />
          ) : emiLoans.loans.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No EMI loans yet. Tap "Add EMI Loan" to add one.</p>
          ) : (
            <div className="space-y-3">
              {emiLoans.loans.map((loan) => (
                <EMILoanCard key={loan._rowIndex} loan={loan} onClick={() => setSelectedEMILoan(loan)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ----- Hand Loans Section ----- */}
      {section === 'hand' && (
        <div>
          <div className="bg-danger text-white rounded-2xl p-4 mb-3">
            <p className="text-xs opacity-80">Total Owed (Principal + Accrued Interest)</p>
            <p className="text-2xl font-bold">{formatCurrency(handLoans.totalOwed)}</p>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-500">Debts I Owe ({handLoans.debts.length})</h2>
              <button onClick={() => setShowHandForm('Owe')} className="text-xs text-primary font-medium flex items-center gap-1">
                <Plus size={14} /> Add Debt
              </button>
            </div>
            {handLoans.isLoading ? (
              <LoadingSkeleton rows={4} />
            ) : handLoans.debts.length === 0 ? (
              <p className="text-center text-gray-400 py-4">No hand loans tracked.</p>
            ) : (
              handLoans.debts.map((loan) => (
                <HandLoanRow key={loan._rowIndex} loan={loan} onClick={() => setSelectedHandLoan(loan)} />
              ))
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-500">Money I Lent ({handLoans.lends.length})</h2>
              <button onClick={() => setShowHandForm('Lent')} className="text-xs text-primary font-medium flex items-center gap-1">
                <Plus size={14} /> Add Lend
              </button>
            </div>
            {handLoans.totalLent > 0 && (
              <div className="bg-amber-50 rounded-lg p-3 mb-2">
                <p className="text-xs text-amber-700">Total Outstanding Lends</p>
                <p className="text-lg font-bold text-amber-600">{formatCurrency(handLoans.totalLent)}</p>
              </div>
            )}
            {handLoans.lends.length === 0 ? (
              <p className="text-center text-gray-400 py-4">No money lent out.</p>
            ) : (
              handLoans.lends.map((loan) => (
                <HandLoanRow key={loan._rowIndex} loan={loan} onClick={() => setSelectedHandLoan(loan)} />
              ))
            )}
          </div>
        </div>
      )}

      {/* ----- EMI Modals ----- */}
      {showEMIForm && !editingEMILoan && (
        <EMILoanForm onSave={handleSaveEMI} onClose={() => setShowEMIForm(false)} />
      )}

      {selectedEMILoan && !editingEMILoan && !showEMIForm && (
        <EMILoanDetail
          loan={selectedEMILoan}
          onEdit={() => setEditingEMILoan(true)}
          onClose={() => setSelectedEMILoan(null)}
        />
      )}

      {selectedEMILoan && editingEMILoan && (
        <EMILoanForm
          initial={{
            name: selectedEMILoan.name,
            principal: String(selectedEMILoan.principal),
            annualRate: String(selectedEMILoan.annualRate),
            tenureMonths: String(selectedEMILoan.tenureMonths),
            startDate: selectedEMILoan.startDate,
            debitsFrom: selectedEMILoan.debitsFrom,
            status: selectedEMILoan.status,
            notes: selectedEMILoan.notes,
          }}
          onSave={handleSaveEMI}
          onDelete={handleDeleteEMI}
          onClose={() => { setEditingEMILoan(false); setSelectedEMILoan(null); }}
        />
      )}

      {/* ----- Hand Loan Modals ----- */}
      {showHandForm && !editingHandLoan && (
        <HandLoanForm direction={showHandForm} onSave={handleSaveHandLoan} onClose={() => setShowHandForm(null)} />
      )}

      {selectedHandLoan && !editingHandLoan && !showPaymentForm && (
        <HandLoanDetail
          loan={selectedHandLoan}
          onRecordPayment={() => setShowPaymentForm(true)}
          onEdit={() => setEditingHandLoan(true)}
          onClose={() => setSelectedHandLoan(null)}
        />
      )}

      {selectedHandLoan && editingHandLoan && (
        <HandLoanForm
          initial={{
            name: selectedHandLoan.name,
            principal: String(selectedHandLoan.principal),
            annualRate: String(selectedHandLoan.annualRate),
            startDate: selectedHandLoan.startDate,
            direction: selectedHandLoan.direction,
            debitsFrom: selectedHandLoan.debitsFrom,
            status: selectedHandLoan.status,
            notes: selectedHandLoan.notes,
          }}
          onSave={handleSaveHandLoan}
          onDelete={handleDeleteHandLoan}
          onClose={() => { setEditingHandLoan(false); setSelectedHandLoan(null); }}
        />
      )}

      {selectedHandLoan && showPaymentForm && (
        <HandLoanPaymentForm
          loan={selectedHandLoan}
          onSave={handleRecordPayment}
          onClose={() => setShowPaymentForm(false)}
        />
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
