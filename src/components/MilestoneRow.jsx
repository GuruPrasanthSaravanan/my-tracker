import { CheckCircle, Circle, Clock, XCircle } from 'lucide-react';
import { formatDate } from '../utils/formatters';

const statusConfig = {
  'Done': { icon: CheckCircle, color: 'text-success' },
  'In Progress': { icon: Clock, color: 'text-primary' },
  'Not Started': { icon: Circle, color: 'text-gray-300' },
  'Delayed': { icon: Clock, color: 'text-danger' },
  'Cancelled': { icon: XCircle, color: 'text-gray-400' },
};

export default function MilestoneRow({ milestone }) {
  const config = statusConfig[milestone.status] || statusConfig['Not Started'];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 py-2">
      <Icon size={18} className={`mt-0.5 ${config.color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{milestone.milestone}</p>
        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
          {milestone.plannedDate && <span>Plan: {formatDate(milestone.plannedDate)}</span>}
          {milestone.actualDate && <span>Done: {formatDate(milestone.actualDate)}</span>}
        </div>
      </div>
    </div>
  );
}
