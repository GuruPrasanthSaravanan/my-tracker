import { formatCurrency } from '../utils/formatters';
import ProgressBar from './ProgressBar';

export default function EMILoanCard({ loan, onClick }) {
  const status = loan.emiStatus;

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl p-4 shadow-sm text-left transition active:scale-[0.98]"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-900">{loan.name}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          loan.status === 'Closed' ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'
        }`}>
          {status?.isComplete ? 'Completed' : loan.status}
        </span>
      </div>

      {status ? (
        <>
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>EMI: {formatCurrency(status.emi)}/mo</span>
            <span>{status.installmentsPaid}/{loan.tenureMonths} paid</span>
          </div>
          <ProgressBar
            value={status.installmentsPaid}
            max={loan.tenureMonths}
            color="primary"
            showLabel={false}
          />
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
            <span>Outstanding: <span className="text-gray-900 font-medium">{formatCurrency(status.outstandingBalance)}</span></span>
            <span>@ {loan.annualRate}%</span>
          </div>
        </>
      ) : (
        <p className="text-xs text-gray-400">Missing start date or tenure - tap to complete details</p>
      )}
    </button>
  );
}
