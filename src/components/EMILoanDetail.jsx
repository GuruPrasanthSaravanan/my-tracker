import { Pencil, Plus, X } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';

export default function EMILoanDetail({ loan, onEdit, onAddPrepayment, onEditPrepayment, onClose }) {
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

        {/* Where are we now */}
        <div className="text-sm text-gray-500 space-y-1 mb-4">
          <p>Principal Taken: <span className="text-gray-900 font-medium">{formatCurrency(loan.principal)}</span> on <span className="text-gray-900 font-medium">{formatDate(loan.startDate)}</span></p>
          <p>Interest Rate: <span className="text-gray-900">{loan.annualRate}% per annum (reducing balance)</span></p>
          {loan.emiDate && <p>EMI Date: <span className="text-gray-900">{loan.emiDate}{loan.emiDate === 1 ? 'st' : loan.emiDate === 2 ? 'nd' : loan.emiDate === 3 ? 'rd' : 'th'} of every month</span></p>}
          {loan.actualEMI && <p>Actual EMI (per bank): <span className="text-gray-900">{formatCurrency(loan.actualEMI)}</span></p>}
          {loan.debitsFrom && <p>Debits From: <span className="text-gray-900">{loan.debitsFrom}</span></p>}
        </div>

        {status ? (
          <div className="space-y-3">
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Monthly EMI</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(status.emi)}</p>
              {status.nextDueDate && (
                <p className="text-xs text-gray-500 mt-1">Next EMI due: {formatDate(status.nextDueDate)}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Outstanding Balance</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(status.outstandingBalance)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Installments</p>
                <p className="text-lg font-bold text-gray-900">
                  {status.installmentsPaid} / {status.effectiveTenureMonths}
                  {status.effectiveTenureMonths < status.originalTenureMonths && (
                    <span className="text-xs text-success font-normal ml-1">(was {status.originalTenureMonths})</span>
                  )}
                </p>
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
            {status.isComplete && (
              <div className="bg-green-50 text-success text-sm font-medium rounded-lg p-3 text-center">
                Loan fully paid off! 🎉
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Add a start date and tenure to see amortization details.</p>
        )}

        {loan.notes && (
          <p className="text-sm text-gray-500 mt-3">Notes: <span className="text-gray-900">{loan.notes}</span></p>
        )}

        {/* Part-payments */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-500">Part-Payments ({loan.prepayments.length})</h3>
            <button onClick={onAddPrepayment} className="text-xs text-primary font-medium flex items-center gap-1">
              <Plus size={14} /> Add Part-Payment
            </button>
          </div>
          {loan.prepayments.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No part-payments recorded. Making extra payments reduces your tenure and total interest.</p>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">Date</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {[...loan.prepayments].reverse().map((p, i) => (
                    <tr key={i} className="border-t border-gray-100 active:bg-gray-50 cursor-pointer"
                      onClick={() => onEditPrepayment(p)}>
                      <td className="px-3 py-2">{formatDate(p.date)}</td>
                      <td className="px-3 py-2 text-right text-success font-medium">{formatCurrency(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
