import { formatCurrency, formatDate } from '../utils/formatters';

export default function TransactionRow({ date, description, badge, amount, isIncome }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{description}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-400">{formatDate(date)}</span>
          {badge && (
            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{badge}</span>
          )}
        </div>
      </div>
      <p className={`text-sm font-semibold ${isIncome ? 'text-success' : 'text-danger'}`}>
        {isIncome ? '+' : '-'}{formatCurrency(Math.abs(amount))}
      </p>
    </div>
  );
}
