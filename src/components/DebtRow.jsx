import { formatCurrency } from '../utils/formatters';
import { CheckCircle } from 'lucide-react';

export default function DebtRow({ debt, isCleared, paid = 0 }) {
  const outstanding = Math.max(debt.originalAmount - paid, 0);
  const hasPayments = paid > 0;

  return (
    <div className={`flex items-center justify-between py-3 border-b border-gray-100 ${isCleared ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-xs font-bold text-gray-400 w-5">{debt.priority}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isCleared ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {debt.name}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
            {hasPayments && debt.originalAmount > 0 ? (
              <span className="text-gray-600 font-medium">
                {formatCurrency(outstanding)} left
              </span>
            ) : (
              <span>{formatCurrency(debt.originalAmount)}</span>
            )}
            {debt.interestRate > 0 && <span>@ {debt.interestRate}%</span>}
            {debt.targetDate && <span>by {debt.targetDate}</span>}
          </div>
          {hasPayments && debt.originalAmount > 0 && (
            <div className="text-xs text-success mt-0.5">
              Paid {formatCurrency(paid)} of {formatCurrency(debt.originalAmount)}
            </div>
          )}
        </div>
      </div>
      {isCleared ? (
        <CheckCircle size={18} className="text-success" />
      ) : (
        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Active</span>
      )}
    </div>
  );
}
