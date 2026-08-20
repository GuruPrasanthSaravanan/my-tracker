import { formatCurrency } from '../utils/formatters';

export default function SummaryCard({ label, amount, color = 'gray' }) {
  const colorClasses = {
    green: 'text-success',
    red: 'text-danger',
    blue: 'text-primary',
    gray: 'text-gray-900',
  };

  return (
    <div className="bg-white rounded-xl p-3 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${colorClasses[color] || colorClasses.gray}`}>
        {formatCurrency(amount)}
      </p>
    </div>
  );
}
