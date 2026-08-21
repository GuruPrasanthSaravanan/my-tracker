import Dropdown from './Dropdown';

/**
 * Shared "also log this payment in CashBook" opt-in, used by EMI Prepayment,
 * Hand Loan Payment, and Credit Card Bill forms. Recording a payment in
 * those tabs only updates that tab's own outstanding balance - it doesn't
 * touch CashBook, so without this, a CashBook account balance can silently
 * drift from reality unless the user separately re-enters the same payment
 * there. Checked by default since keeping CashBook accurate is the point;
 * the account defaults to the loan/card's own DebitsFrom.
 */
export default function CashBookLinkToggle({ checked, onCheckedChange, account, onAccountChange, accountOptions, onAddAccount, disabled }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} disabled={disabled} />
        Also log this in CashBook
      </label>
      {checked && (
        <div className="mt-2">
          <Dropdown label="Account" options={accountOptions} value={account} onChange={onAccountChange} onAddNew={onAddAccount} />
        </div>
      )}
    </div>
  );
}
