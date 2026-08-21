import { formatCurrency } from '../utils/formatters';
import { CheckCircle } from 'lucide-react';

export default function HandLoanRow({ loan, onClick }) {
  const isClosed = loan.status === 'Closed';
  const { outstandingPrincipal, accruedInterest } = loan.state;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between py-3 border-b border-gray-100 text-left active:bg-gray-50 ${isClosed ? 'opacity-50' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isClosed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {loan.name}
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
          <span>{formatCurrency(outstandingPrincipal)} principal</span>
          {loan.annualRate > 0 && <span>@ {loan.annualRate}%</span>}
        </div>
        {accruedInterest > 0.5 && (
          <p className="text-xs text-amber-600 mt-0.5">
            Interest accrued: {formatCurrency(accruedInterest)}
          </p>
        )}
      </div>
      {isClosed ? (
        <CheckCircle size={18} className="text-success" />
      ) : (
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          loan.direction === 'Lent' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
        }`}>
          {loan.direction === 'Lent' ? 'Lent' : 'Active'}
        </span>
      )}
    </button>
  );
}
