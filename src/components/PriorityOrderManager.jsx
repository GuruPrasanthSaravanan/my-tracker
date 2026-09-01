import { useState } from 'react';
import { ChevronUp, ChevronDown, Plus, Minus } from 'lucide-react';
import { buildPriorityOrderItems, savePriorityOrder } from '../utils/priorityOrdering';

const KIND_LABELS = { hand: 'Hand Loan', emi: 'EMI Loan', project: 'Project' };
const KIND_COLORS = {
  hand: 'bg-amber-100 text-amber-700',
  emi: 'bg-blue-100 text-blue-700',
  project: 'bg-green-100 text-green-700',
};

/**
 * A single reorderable list for Payoff Priority, replacing the old "type a
 * number into each item's own form" UI (which was hard to update since the
 * same shared ordering was scattered across three unrelated forms on two
 * different pages - see bugs-and-lessons.md). Up/Down buttons move an
 * included item within the ordered list; +/- moves an item between the
 * ordered list and the "not ranked" pool. Nothing is written until "Save
 * Order" is tapped, so rearranging several items only costs one batch of
 * writes instead of one per click.
 */
export default function PriorityOrderManager({ handLoans, emiLoans, projects }) {
  const eligibleHandLoans = handLoans.debts.filter((l) => l.status !== 'Closed');
  const eligibleEMILoans = emiLoans.loans.filter((l) => l.status !== 'Closed' && !l.emiStatus?.isComplete);
  const eligibleProjects = projects.projects.filter((p) => p.status !== 'Completed' && !p.endDateActual);

  const initial = buildPriorityOrderItems({ handLoans: eligibleHandLoans, emiLoans: eligibleEMILoans, projects: eligibleProjects });
  const [included, setIncluded] = useState(initial.included);
  const [excluded, setExcluded] = useState(initial.excluded);
  const [dirty, setDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const moveUp = (idx) => {
    if (idx === 0) return;
    setIncluded((list) => {
      const next = [...list];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
    setDirty(true);
    setSaved(false);
  };

  const moveDown = (idx) => {
    setIncluded((list) => {
      if (idx === list.length - 1) return list;
      const next = [...list];
      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
      return next;
    });
    setDirty(true);
    setSaved(false);
  };

  const includeItem = (item) => {
    setExcluded((list) => list.filter((i) => i !== item));
    setIncluded((list) => [...list, item]);
    setDirty(true);
    setSaved(false);
  };

  const excludeItem = (item) => {
    setIncluded((list) => list.filter((i) => i !== item));
    setExcluded((list) => [...list, item]);
    setDirty(true);
    setSaved(false);
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await savePriorityOrder(included, excluded, { handLoans, emiLoans, projects });
      setDirty(false);
      setSaved(true);
    } finally {
      setIsSaving(false);
    }
  };

  const hasAnyItems = included.length > 0 || excluded.length > 0;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
      <h2 className="text-sm font-semibold text-gray-500 mb-1">Payoff Priority Order</h2>
      <p className="text-xs text-gray-400 mb-3">
        Reorder with the arrows below - the Debt Payoff Trajectory attacks items top to bottom. Use +/- to include
        or leave out an item entirely.
      </p>

      {!hasAnyItems ? (
        <p className="text-sm text-gray-400">No active Hand Loans, EMI Loans, or Projects to order yet.</p>
      ) : (
        <>
          {included.length > 0 && (
            <div className="bg-gray-50 rounded-xl overflow-hidden mb-3">
              {included.map((item, idx) => (
                <div key={`${item.kind}:${item.rowIndex}`}
                  className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 last:border-0">
                  <span className="text-xs font-semibold text-gray-400 w-5">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{item.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${KIND_COLORS[item.kind]}`}>
                      {KIND_LABELS[item.kind]}
                    </span>
                  </div>
                  <button onClick={() => moveUp(idx)} disabled={idx === 0}
                    className="p-1.5 text-gray-500 disabled:opacity-30"><ChevronUp size={16} /></button>
                  <button onClick={() => moveDown(idx)} disabled={idx === included.length - 1}
                    className="p-1.5 text-gray-500 disabled:opacity-30"><ChevronDown size={16} /></button>
                  <button onClick={() => excludeItem(item)} className="p-1.5 text-danger"><Minus size={16} /></button>
                </div>
              ))}
            </div>
          )}

          {excluded.length > 0 && (
            <>
              <p className="text-xs text-gray-400 mb-1">Not ranked</p>
              <div className="bg-gray-50 rounded-xl overflow-hidden mb-3">
                {excluded.map((item) => (
                  <div key={`${item.kind}:${item.rowIndex}`}
                    className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{item.name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${KIND_COLORS[item.kind]}`}>
                        {KIND_LABELS[item.kind]}
                      </span>
                    </div>
                    <button onClick={() => includeItem(item)} className="p-1.5 text-primary"><Plus size={16} /></button>
                  </div>
                ))}
              </div>
            </>
          )}

          <button onClick={handleSave} disabled={!dirty || isSaving}
            className="w-full bg-primary text-white py-2.5 rounded-xl font-medium text-sm disabled:opacity-40">
            {isSaving ? 'Saving...' : saved ? 'Saved!' : 'Save Order'}
          </button>
        </>
      )}
    </div>
  );
}
