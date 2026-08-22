import { useState } from 'react';
import { Plus, X } from 'lucide-react';

/**
 * Bottom-right floating action button. Two modes:
 *  - `onClick` (default, used by most pages): a single tap opens one form.
 *  - `actions` (e.g. CashBook's Add Entry + Transfer): tapping the FAB
 *    expands a short stack of labeled mini-buttons above it instead of
 *    immediately opening something - used when a page has more than one
 *    primary action, so two full-size circular buttons don't end up stacked
 *    on top of each other looking like duplicates of the same action (see
 *    bugs-and-lessons.md §25).
 */
export default function FAB({ onClick, actions }) {
  const [expanded, setExpanded] = useState(false);

  if (!actions) {
    return (
      <button
        onClick={onClick}
        className="fixed bottom-20 right-4 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition z-10"
      >
        <Plus size={24} />
      </button>
    );
  }

  return (
    <>
      {expanded && (
        <div className="fixed inset-0 z-10" onClick={() => setExpanded(false)} />
      )}
      <div className="fixed bottom-20 right-4 z-20 flex flex-col items-end gap-3">
        {expanded && actions.map(({ label, icon: Icon, onClick: actionClick }) => (
          <button
            key={label}
            onClick={() => { setExpanded(false); actionClick(); }}
            className="flex items-center gap-2 bg-white text-gray-700 shadow-lg rounded-full pl-4 pr-2 py-2 active:scale-95 transition"
          >
            <span className="text-sm font-medium whitespace-nowrap">{label}</span>
            <span className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
              <Icon size={18} />
            </span>
          </button>
        ))}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition"
        >
          {expanded ? <X size={24} /> : <Plus size={24} />}
        </button>
      </div>
    </>
  );
}
