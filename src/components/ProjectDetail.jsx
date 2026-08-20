import { X } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';
import ProgressBar from './ProgressBar';
import MilestoneRow from './MilestoneRow';
import SummaryCard from './SummaryCard';

export default function ProjectDetail({ project, spent, milestones, vendorRows, onAddMilestone, onClose }) {
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
  const onCredit = vendorRows
    .filter((r) => r[3] === project.code)
    .reduce((sum, r) => sum + (parseFloat(r[4]) || 0) - (parseFloat(r[5]) || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 pb-8 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{project.name || project.code}</h2>
          <button onClick={onClose} className="p-1"><X size={20} /></button>
        </div>

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
        <div className="text-sm text-gray-500 space-y-1 mb-4">
          {project.manager && <p>Manager: <span className="text-gray-900">{project.manager}</span></p>}
          {project.startDate && <p>Start: <span className="text-gray-900">{formatDate(project.startDate)}</span></p>}
          {project.endDatePlanned && <p>End (Planned): <span className="text-gray-900">{formatDate(project.endDatePlanned)}</span></p>}
          {project.endDateActual && <p>End (Actual): <span className="text-gray-900">{formatDate(project.endDateActual)}</span></p>}
          {project.notes && <p>Notes: <span className="text-gray-900">{project.notes}</span></p>}
        </div>

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
      </div>
    </div>
  );
}
