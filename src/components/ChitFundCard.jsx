import { formatCurrency } from '../utils/formatters';
import ProgressBar from './ProgressBar';

export default function ChitFundCard({ chit, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl p-4 shadow-sm text-left transition active:scale-[0.98]"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-900">{chit.name}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          chit.status === 'Closed' ? 'bg-gray-100 text-gray-500' : chit.hasWon ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {chit.isComplete ? 'Completed' : chit.hasWon ? 'Won' : chit.status}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
        <span>Contribution: {formatCurrency(chit.monthlyContribution)}/mo</span>
        <span>{chit.monthsLogged}/{chit.durationMonths} months</span>
      </div>
      <ProgressBar value={chit.monthsLogged} max={chit.durationMonths} color="primary" showLabel={false} />
      <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
        <span>Contributed: <span className="text-gray-900 font-medium">{formatCurrency(chit.totalContributed)}</span></span>
        {chit.hasWon && <span>Won: <span className="text-amber-600 font-medium">{formatCurrency(chit.prizeAmountReceived)}</span></span>}
      </div>
    </button>
  );
}
