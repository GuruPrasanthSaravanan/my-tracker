import { formatCurrency } from '../utils/formatters';
import ProgressBar from './ProgressBar';

export default function ProjectCard({ project, spent, onClick }) {
  const statusColors = {
    'Not Started': 'bg-gray-100 text-gray-600',
    'In Progress': 'bg-blue-100 text-blue-700',
    'Completed': 'bg-green-100 text-green-700',
    'Ongoing': 'bg-amber-100 text-amber-700',
  };

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl p-4 shadow-sm text-left transition active:scale-[0.98]"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-900">{project.name || project.code}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[project.status] || statusColors['Not Started']}`}>
          {project.status || 'Not Started'}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
        <span>Spent: {formatCurrency(spent)}</span>
        <span>Budget: {formatCurrency(project.budget)}</span>
      </div>
      <ProgressBar
        value={spent}
        max={project.budget}
        color={spent > project.budget ? 'danger' : spent > project.budget * 0.8 ? 'amber' : 'primary'}
        showLabel={false}
      />
    </button>
  );
}
