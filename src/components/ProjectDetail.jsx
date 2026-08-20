import { useState } from 'react';
import { X, Plus, Pencil } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';
import ProgressBar from './ProgressBar';
import MilestoneRow from './MilestoneRow';
import SummaryCard from './SummaryCard';
import TransactionRow from './TransactionRow';

export default function ProjectDetail({ project, spent, milestones, vendorRows, onAddMilestone, onAddExpense, onEditProject, onClose }) {
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState({
    budget: String(project.budget || ''),
    endDatePlanned: project.endDatePlanned || '',
    endDateActual: project.endDateActual || '',
    manager: project.manager || '',
    status: project.status || 'Not Started',
    notes: project.notes || '',
  });

  let labour = 0, material = 0, machine = 0, other = 0;
  for (const row of vendorRows) {
    if (row[3] === project.code) {
      const desc = (row[2] || '').toLowerCase();
      const amount = parseFloat(row[4]) || 0;
      if (desc.includes('labour') || desc.includes('labor') || desc.includes('work')) {
        labour += amount;
      } else if (desc.includes('material') || desc.includes('cement') || desc.includes('brick') || desc.includes('sand') || desc.includes('steel')) {
        material += amount;
      } else if (desc.includes('machine') || desc.includes('jcb') || desc.includes('crane') || desc.includes('mixer')) {
        machine += amount;
      } else {
        other += amount;
      }
    }
  }

  const projectMilestones = milestones.filter((m) => m.project === project.code);
  const projectExpenses = vendorRows.filter((r) => r[3] === project.code);
  const onCredit = projectExpenses.reduce((sum, r) => sum + (parseFloat(r[4]) || 0) - (parseFloat(r[5]) || 0), 0);

  const handleSaveEdit = () => {
    onEditProject({
      ...project,
      budget: editForm.budget,
      endDatePlanned: editForm.endDatePlanned,
      endDateActual: editForm.endDateActual,
      manager: editForm.manager,
      status: editForm.status,
      notes: editForm.notes,
    });
    setShowEditForm(false);
  };

  const statusOptions = ['Not Started', 'In Progress', 'Completed', 'Ongoing'];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{project.name || project.code}</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowEditForm(!showEditForm)} className="p-1 text-gray-400">
              <Pencil size={18} />
            </button>
            <button onClick={onClose} className="p-1"><X size={20} /></button>
          </div>
        </div>

        {/* Edit Form (toggled) */}
        {showEditForm && (
          <div className="bg-blue-50 rounded-xl p-3 mb-4 space-y-2">
            <h3 className="text-sm font-semibold text-primary">Edit Project</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">Budget</label>
                <input type="number" inputMode="numeric" value={editForm.budget}
                  onChange={(e) => setEditForm(f => ({ ...f, budget: e.target.value }))}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Status</label>
                <select value={editForm.status}
                  onChange={(e) => setEditForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5">
                  {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">End (Planned)</label>
                <input type="date" value={editForm.endDatePlanned}
                  onChange={(e) => setEditForm(f => ({ ...f, endDatePlanned: e.target.value }))}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5" />
              </div>
              <div>
                <label className="text-xs text-gray-500">End (Actual)</label>
                <input type="date" value={editForm.endDateActual}
                  onChange={(e) => setEditForm(f => ({ ...f, endDateActual: e.target.value }))}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Manager</label>
                <input type="text" value={editForm.manager}
                  onChange={(e) => setEditForm(f => ({ ...f, manager: e.target.value }))}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Notes</label>
                <input type="text" value={editForm.notes}
                  onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5" />
              </div>
            </div>
            <button onClick={handleSaveEdit}
              className="w-full bg-primary text-white py-2 rounded-lg text-sm font-medium mt-2">
              Save Changes
            </button>
          </div>
        )}

        {/* Budget vs Actual */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Budget vs Spent</span>
            <span className="font-semibold">{formatCurrency(spent)} / {formatCurrency(project.budget)}</span>
          </div>
          <ProgressBar
            value={spent}
            max={project.budget}
            color={spent > project.budget ? 'danger' : spent > project.budget * 0.8 ? 'amber' : 'primary'}
          />
        </div>

        {/* Cost Breakdown */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <SummaryCard label="Labour" amount={labour} color={labour > project.estLabour ? 'red' : 'gray'} />
          <SummaryCard label="Material" amount={material} color={material > project.estMaterial ? 'red' : 'gray'} />
          <SummaryCard label="Machine" amount={machine} color={machine > project.estMachine ? 'red' : 'gray'} />
          <SummaryCard label="Other" amount={other} color={other > project.estOther ? 'red' : 'gray'} />
        </div>

        {/* On Credit */}
        {onCredit > 0 && (
          <div className="bg-red-50 rounded-lg p-3 mb-4">
            <p className="text-xs text-red-600">On Credit (Unpaid to Vendors)</p>
            <p className="text-lg font-bold text-danger">{formatCurrency(onCredit)}</p>
          </div>
        )}

        {/* Project Info */}
        {!showEditForm && (
          <div className="text-sm text-gray-500 space-y-1 mb-4">
            {project.manager && <p>Manager: <span className="text-gray-900">{project.manager}</span></p>}
            {project.startDate && <p>Start: <span className="text-gray-900">{formatDate(project.startDate)}</span></p>}
            {project.endDatePlanned && <p>End (Planned): <span className="text-gray-900">{formatDate(project.endDatePlanned)}</span></p>}
            {project.endDateActual && <p>End (Actual): <span className="text-gray-900">{formatDate(project.endDateActual)}</span></p>}
            {project.status && <p>Status: <span className="text-gray-900">{project.status}</span></p>}
            {project.notes && <p>Notes: <span className="text-gray-900">{project.notes}</span></p>}
          </div>
        )}

        {/* Milestones */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-500">Milestones ({projectMilestones.length})</h3>
            <button onClick={onAddMilestone} className="text-xs text-primary font-medium">+ Add</button>
          </div>
          {projectMilestones.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No milestones yet.</p>
          ) : (
            projectMilestones.map((ms, i) => <MilestoneRow key={i} milestone={ms} />)
          )}
        </div>

        {/* Add Expense Button */}
        <button onClick={onAddExpense}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-semibold text-sm mb-4">
          <Plus size={18} /> Add Expense to {project.code}
        </button>

        {/* Recent Expenses */}
        {projectExpenses.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-2">
              Recent Expenses ({projectExpenses.length})
            </h3>
            {[...projectExpenses].reverse().slice(0, 10).map((row, i) => (
              <TransactionRow
                key={i}
                date={row[0]}
                description={`${row[1]} - ${row[2]}`}
                badge={row[3]}
                amount={parseFloat(row[4]) || parseFloat(row[5]) || 0}
                isIncome={!!parseFloat(row[4])}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
