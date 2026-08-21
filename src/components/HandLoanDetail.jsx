import { formatCurrency, formatDate } from '../utils/formatters';
import { Pencil, Plus, X } from 'lucide-react';

export default function HandLoanDetail({ loan, onRecordPayment, onEditPayment, onEdit, onClose }) {
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
                    <tr key={i} className="border-t border-gray-100 active:bg-gray-50 cursor-pointer"
                      onClick={() => onEditPayment(p)}>
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
