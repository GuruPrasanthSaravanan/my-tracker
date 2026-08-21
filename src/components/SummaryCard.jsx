import { AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export default function SummaryCard({ label, amount, color = 'gray', minBalance, onClick }) {
  const colorClasses = {
    green: 'text-success',
    red: 'text-danger',
    blue: 'text-primary',
    gray: 'text-gray-900',
  };

  const belowMin = minBalance != null && minBalance > 0 && amount < minBalance;
  const wrapperClass = `bg-white rounded-xl p-3 shadow-sm ${belowMin ? 'ring-1 ring-amber-400' : ''}`;

  const content = (
    <>
      <div className="flex items-center justify-between gap-1">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        {belowMin && <AlertTriangle size={12} className="text-amber-500 shrink-0" />}
      </div>
      <p className={`text-lg font-bold ${colorClasses[color] || colorClasses.gray}`}>
        {formatCurrency(amount)}
      </p>
      {belowMin && (
        <p className="text-[10px] text-amber-600 mt-0.5">Below min {formatCurrency(minBalance)}</p>
      )}
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={`w-full text-left active:bg-gray-50 transition ${wrapperClass}`}>
        {content}
      </button>
    );
  }

  return <div className={wrapperClass}>{content}</div>;
}
