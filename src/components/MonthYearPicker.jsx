import { useRef } from 'react';
import { Calendar } from 'lucide-react';

/**
 * Formats a native <input type="date"> value ("2028-08-15") into the
 * human-readable "MMM YYYY" format used throughout the Debts tab ("Aug 2028"),
 * discarding the day (we only care about month/year here).
 *
 * Note: we deliberately use type="date" instead of type="month" for the
 * underlying picker - Safari (all versions, incl. iOS, our primary target)
 * does not support <input type="month"> at all; it silently renders as a
 * plain text box with no picker. type="date" is universally supported.
 */
function formatMonthYear(isoDate) {
  if (!isoDate) return '';
  const [year, month] = isoDate.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString('en', { month: 'short', year: 'numeric' });
}

/**
 * A free-text field (keeps existing "Aug 2028" / "2030" style values intact,
 * both for display and backward compatibility with historical sheet data)
 * paired with a calendar icon that opens a native date picker. Picking any
 * day formats its month/year as "MMM YYYY" and fills the text field, so users
 * can either type freely or tap the calendar for a guided selection.
 */
export default function MonthYearPicker({ label, value, onChange, placeholder, disabled }) {
  const hiddenInputRef = useRef(null);

  const handlePickerChange = (e) => {
    const iso = e.target.value; // "yyyy-mm-dd"
    if (iso) onChange(formatMonthYear(iso));
  };

  const openPicker = () => {
    if (disabled) return;
    const input = hiddenInputRef.current;
    if (input?.showPicker) {
      try {
        input.showPicker();
        return;
      } catch {
        // fall through to focus()
      }
    }
    input?.focus();
  };

  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <div className="relative mt-0.5">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full border rounded-lg px-3 py-2 pr-9 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          aria-label={`Pick ${label} from calendar`}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 disabled:opacity-50"
        >
          <Calendar size={16} />
        </button>
        {/* Visually hidden but still interactive - triggered via showPicker()/focus() above */}
        <input
          ref={hiddenInputRef}
          type="date"
          onChange={handlePickerChange}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
        />
      </div>
    </div>
  );
}
