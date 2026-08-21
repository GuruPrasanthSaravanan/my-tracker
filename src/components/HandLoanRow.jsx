import { formatCurrency } from '../utils/formatters';
import ProgressBar from './ProgressBar';

export default function HandLoanRow({ loan, onClick }) {
  const isClosed = loan.status === 'Closed';
  const { outstandingPrincipal, accruedInterest, totalPrincipalPaid } = loan.state;
  const isLent = loan.direction === 'Lent';

  return (
    <button
      onClick={onClick}
      className={`w-full bg-white rounded-xl p-4 shadow-sm text-left transition active:scale-[0.98] ${isClosed ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className={`font-semibold ${isClosed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {loan.name}
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          isClosed ? 'bg-gray-100 text-gray-500' : isLent ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
        }`}>
          {isClosed ? 'Closed' : isLent ? 'Lent' : 'Active'}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
        <span>{loan.annualRate > 0 ? `@ ${loan.annualRate}%` : 'Interest-free'}</span>
        <span>{formatCurrency(totalPrincipalPaid)}/{formatCurrency(loan.principal)} repaid</span>
      </div>

      <ProgressBar
        value={totalPrincipalPaid}
        max={loan.principal}
        color={isLent ? 'amber' : 'primary'}
        showLabel={false}
      />

      <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
        <span>Outstanding: <span className="text-gray-900 font-medium">{formatCurrency(outstandingPrincipal)}</span></span>
        {accruedInterest > 0.5 && (
          <span className="text-amber-600">Interest accrued: {formatCurrency(accruedInterest)}</span>
        )}
      </div>
    </button>
  );
}
