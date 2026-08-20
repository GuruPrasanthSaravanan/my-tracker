import { formatCurrency } from '../utils/formatters';
import { CheckCircle } from 'lucide-react';

export default function DebtRow({ debt, isCleared }) {
  return (
    <div className={`flex items-center justify-between py-3 border-b border-gray-100 ${isCleared ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-xs font-bold text-gray-400 w-5">{debt.priority}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isCleared ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {debt.name}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
            <span>{formatCurrency(debt.originalAmount)}</span>
            {debt.interestRate > 0 && <span>@ {debt.interestRate}%</span>}
            {debt.targetDate && <span>by {debt.targetDate}</span>}
          </div>
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
