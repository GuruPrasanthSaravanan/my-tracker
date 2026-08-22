import { formatCurrency } from '../utils/formatters';

/**
 * Dependency-free Planned vs. Actual bar chart - plain divs sized by
 * percentage width rather than SVG/a charting library, consistent with
 * PieChart.jsx's reasoning for hand-rolling charts in this app. Renders one
 * row per category with two stacked bars (Planned, Actual) scaled against
 * the largest value across every row, so bars are comparable at a glance
 * both within a row and across rows.
 * @param {{ label: string, planned: number, actual: number }[]} data
 */
export default function BarChart({ data }) {
  if (data.length === 0) {
    return <p className="text-center text-gray-400 text-sm py-6">No planned categories to compare yet.</p>;
  }

  const maxValue = Math.max(1, ...data.flatMap((d) => [d.planned, d.actual]));

  return (
    <div>
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> Planned</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-success" /> Actual (under/on plan)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-danger" /> Actual (over plan)</span>
      </div>
      <div className="space-y-3">
        {data.map((d) => (
          <div key={d.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-900 font-medium truncate">{d.label}</span>
              <span className="text-gray-400 shrink-0 ml-2">{formatCurrency(d.planned)} / {formatCurrency(d.actual)}</span>
            </div>
            <div className="space-y-1">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${(d.planned / maxValue) * 100}%` }} />
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${d.actual > d.planned ? 'bg-danger' : 'bg-success'}`}
                  style={{ width: `${(d.actual / maxValue) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
