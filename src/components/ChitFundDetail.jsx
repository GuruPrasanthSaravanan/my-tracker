import { Pencil, Plus, X } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';

export default function ChitFundDetail({ chit, onEdit, onAddMonth, onEditMonth, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8 max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{chit.name}</h2>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="p-1 text-gray-400"><Pencil size={18} /></button>
            <button onClick={onClose} className="p-1"><X size={20} /></button>
          </div>
        </div>

        <div className="text-sm text-gray-500 space-y-1 mb-4">
          <p>Total Value: <span className="text-gray-900 font-medium">{formatCurrency(chit.totalValue)}</span> over <span className="text-gray-900 font-medium">{chit.durationMonths} months</span></p>
          <p>Fixed Monthly Contribution: <span className="text-gray-900">{formatCurrency(chit.monthlyContribution)}</span></p>
          {chit.foremanCommissionPercent > 0 && <p>Foreman Commission: <span className="text-gray-900">{chit.foremanCommissionPercent}%</span></p>}
          {chit.debitsFrom && <p>Debits From: <span className="text-gray-900">{chit.debitsFrom}</span></p>}
        </div>

        <div className="space-y-3 mb-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Months Logged</p>
              <p className="text-lg font-bold text-gray-900">{chit.monthsLogged} / {chit.durationMonths}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Months Remaining</p>
              <p className="text-lg font-bold text-gray-900">{chit.monthsRemaining}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Total Contributed</p>
              <p className="text-lg font-bold text-danger">{formatCurrency(chit.totalContributed)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Total Dividends</p>
              <p className="text-lg font-bold text-success">{formatCurrency(chit.totalDividends)}</p>
            </div>
          </div>

          {chit.hasWon ? (
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-xs text-amber-700 font-semibold">Won this chit - {formatDate(chit.prizedMonth + '-01')}</p>
              <p className="text-lg font-bold text-amber-600">{formatCurrency(chit.prizeAmountReceived)}</p>
              <p className="text-xs text-gray-500 mt-1">
                Full monthly contribution is still due for every remaining month - winning early doesn't reduce it.
              </p>
            </div>
          ) : (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-blue-700">Haven't won (been prized) yet - still accumulating contributions.</p>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Net Position So Far (received - paid)</p>
            <p className={`text-lg font-bold ${chit.netPosition >= 0 ? 'text-success' : 'text-danger'}`}>
              {formatCurrency(chit.netPosition)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Naturally negative before winning - a chit is forced savings followed by a lump sum, not a loan from day one.
            </p>
          </div>

          {chit.isComplete && (
            <div className="bg-green-50 text-success text-sm font-medium rounded-lg p-3 text-center">
              Chit fund cycle complete! 🎉
            </div>
          )}
        </div>

        {chit.notes && (
          <p className="text-sm text-gray-500 mb-3">Notes: <span className="text-gray-900">{chit.notes}</span></p>
        )}

        {/* Monthly log */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-500">Monthly Log ({chit.months.length})</h3>
            <button onClick={onAddMonth} className="text-xs text-primary font-medium flex items-center gap-1">
              <Plus size={14} /> Log a Month
            </button>
          </div>
          {chit.months.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No months logged yet. Log each month's contribution (and dividend/win, if any) as it happens.</p>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">Month</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">Paid</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">Dividend</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">Won</th>
                  </tr>
                </thead>
                <tbody>
                  {[...chit.months].reverse().map((m, i) => (
                    <tr key={i} className="border-t border-gray-100 active:bg-gray-50 cursor-pointer"
                      onClick={() => onEditMonth(m)}>
                      <td className="px-3 py-2">{m.month}</td>
                      <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(m.contributionPaid)}</td>
                      <td className="px-3 py-2 text-right text-success">{m.dividendReceived > 0 ? formatCurrency(m.dividendReceived) : '-'}</td>
                      <td className="px-3 py-2 text-right text-amber-600 font-medium">{m.isPrizedMonth ? formatCurrency(m.prizeAmountReceived) : '-'}</td>
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
