import { Pencil, Plus, X } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';

export default function CreditCardDetail({ card, projectedSpend, onEdit, onAddBill, onAddBillWithPrefill, onEditBill, onClose }) {
  const bill = card.latestBill;
  const projection = card.projection;
  const priorUnpaid = card.outstanding || 0;
  const projectedNextBill = priorUnpaid + (projectedSpend?.spend || 0);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8 max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{card.name}</h2>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="p-1 text-gray-400"><Pencil size={18} /></button>
            <button onClick={onClose} className="p-1"><X size={20} /></button>
          </div>
        </div>

        <div className="text-sm text-gray-500 space-y-1 mb-4">
          {card.creditLimit > 0 && <p>Credit Limit: <span className="text-gray-900">{formatCurrency(card.creditLimit)}</span></p>}
          <p>Interest Rate: <span className="text-gray-900">{card.interestRateMonthly}% per month</span></p>
          {card.debitsFrom && <p>Debits From: <span className="text-gray-900">{card.debitsFrom}</span></p>}
        </div>

        {bill ? (
          <div className="space-y-3 mb-4">
            <div className={`rounded-lg p-3 ${card.isPaidInFull ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center justify-between">
                <p className={`text-xs ${card.isPaidInFull ? 'text-green-700' : 'text-red-700'}`}>
                  {card.isPaidInFull ? 'Paid in Full' : 'Outstanding Balance'}
                </p>
                {bill.isEstimated && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Estimated</span>
                )}
              </div>
              <p className={`text-xl font-bold ${card.isPaidInFull ? 'text-success' : 'text-danger'}`}>
                {formatCurrency(card.isPaidInFull ? bill.totalAmountDue : card.outstanding)}
              </p>
              {bill.isEstimated && (
                <button onClick={() => onEditBill(bill)} className="text-xs text-blue-700 font-medium mt-1">
                  Confirm with actual statement amount →
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Total Amount Due</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(bill.totalAmountDue)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Minimum Due</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(bill.minimumAmountDue)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Statement Date</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(bill.statementDate)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Due Date</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(bill.dueDate)}</p>
              </div>
            </div>

            {/* Due-date-aware interest messaging: banks only withdraw the interest-free
                grace period once the due date passes without full payment - paying part
                of the bill before the due date doesn't itself trigger interest. */}
            {!card.isPaidInFull && !card.interestAccruing && (
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  Pay the full amount by <span className="font-semibold">{formatDate(bill.dueDate)}</span> to avoid interest.
                </p>
                {projection && !projection.neverPaysOff && (
                  <p className="text-xs text-gray-500 mt-1">
                    If you miss the due date and pay only the minimum after that, it could take{' '}
                    <span className="font-semibold">{projection.monthsToPayoff} months</span> and cost{' '}
                    <span className="font-semibold text-danger">{formatCurrency(projection.totalInterestPaid)}</span> in interest.
                  </p>
                )}
              </div>
            )}

            {!card.isPaidInFull && card.interestAccruing && (
              <div className="bg-amber-50 rounded-lg p-3">
                <p className="text-xs text-amber-700 font-semibold mb-1">
                  Interest accruing since {formatDate(bill.dueDate)} ({card.daysPastDue} {card.daysPastDue === 1 ? 'day' : 'days'} overdue)
                </p>
                <p className="text-sm text-gray-700 mb-2">
                  Interest so far: <span className="font-bold text-danger">{formatCurrency(card.accruedInterestSinceDue)}</span>
                </p>
                <p className="text-xs text-amber-700 font-semibold mb-1">If you pay only the Minimum Due each month from here:</p>
                {projection?.neverPaysOff ? (
                  <p className="text-sm text-danger font-medium">
                    This balance will never be paid off - minimum due doesn't cover the monthly interest.
                    Pay more than the minimum to make progress.
                  </p>
                ) : projection && (
                  <>
                    <p className="text-sm text-gray-700">
                      Payoff time: <span className="font-bold text-amber-700">{projection.monthsToPayoff} months</span>
                      {' '}({Math.floor(projection.monthsToPayoff / 12)}y {projection.monthsToPayoff % 12}m)
                    </p>
                    <p className="text-sm text-gray-700">
                      Total interest you'd pay from here: <span className="font-bold text-danger">{formatCurrency(projection.totalInterestPaid)}</span>
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 mb-4">No bills recorded yet.</p>
        )}

        {projectedSpend && (
          <div className="bg-blue-50 rounded-lg p-3 mb-4">
            <p className="text-xs text-blue-700 font-semibold mb-1">
              Projected from CashBook (since {bill ? 'last statement' : 'first tracked spend'})
            </p>
            <p className="text-sm text-gray-700">
              New spend this cycle: <span className="font-bold text-gray-900">{formatCurrency(projectedSpend.spend)}</span>
              {' '}({projectedSpend.transactionCount} {projectedSpend.transactionCount === 1 ? 'entry' : 'entries'})
            </p>
            {priorUnpaid > 0 && (
              <p className="text-sm text-gray-700">
                Plus unpaid balance: <span className="font-bold text-gray-900">{formatCurrency(priorUnpaid)}</span>
              </p>
            )}
            <p className="text-sm text-gray-700 mt-1">
              Estimated next bill: <span className="font-bold text-primary">{formatCurrency(projectedNextBill)}</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              This is an estimate from CashBook entries tagged Account = "{card.name}". Your actual statement
              may differ due to fees, interest, or transactions not logged in CashBook.
            </p>
            {projectedNextBill > 0 && (
              <button onClick={() => onAddBillWithPrefill(projectedNextBill)}
                className="text-xs text-primary font-medium mt-2">
                Use this estimate to add a new bill →
              </button>
            )}
          </div>
        )}

        <button onClick={onAddBill}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-semibold text-sm mb-4">
          <Plus size={18} /> Add New Bill
        </button>

        {card.bills.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-2">Bill History ({card.bills.length})</h3>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">Statement</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">Total Due</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {card.bills.map((b, i) => (
                    <tr key={i} className="border-t border-gray-100 active:bg-gray-50 cursor-pointer"
                      onClick={() => onEditBill(b)}>
                      <td className="px-3 py-2">
                        {formatDate(b.statementDate)}
                        {b.isEstimated && <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Est.</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(b.totalAmountDue)}</td>
                      <td className="px-3 py-2 text-right text-success">{formatCurrency(b.paymentMade)}</td>
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
