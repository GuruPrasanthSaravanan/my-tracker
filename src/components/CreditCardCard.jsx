import { formatCurrency, formatDate } from '../utils/formatters';

export default function CreditCardCard({ card, onClick }) {
  const bill = card.latestBill;

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl p-4 shadow-sm text-left transition active:scale-[0.98]"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-900">{card.name}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          card.isPaidInFull ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {card.isPaidInFull ? 'Paid in Full' : 'Outstanding'}
        </span>
      </div>

      {bill ? (
        <>
          <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
            <span>Bill: {formatCurrency(bill.totalAmountDue)}</span>
            <span>Due: {formatDate(bill.dueDate)}</span>
          </div>
          {!card.isPaidInFull && (
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Min Due: {formatCurrency(bill.minimumAmountDue)}</span>
              <span>Outstanding: <span className="text-danger font-medium">{formatCurrency(card.outstanding)}</span></span>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-gray-400">No bills yet - tap to add one.</p>
      )}
    </button>
  );
}
