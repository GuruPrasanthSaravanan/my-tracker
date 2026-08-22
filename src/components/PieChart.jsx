import { formatCurrency } from '../utils/formatters';

// A fixed, readable palette - cycles if there are more slices than colors.
const COLORS = [
  '#2563eb', '#f59e0b', '#16a34a', '#dc2626', '#7c3aed',
  '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5',
];

function polarToCartesian(cx, cy, r, angleDeg) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  // A full-circle single-slice can't be drawn as one arc (start===end), so
  // nudge it very slightly to force two distinct arc segments.
  const adjustedEnd = endAngle - startAngle >= 359.999 ? startAngle + 359.999 : endAngle;
  const start = polarToCartesian(cx, cy, r, adjustedEnd);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = adjustedEnd - startAngle <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

/**
 * Dependency-free SVG pie chart - the app has deliberately avoided pulling
 * in a charting library so far (see the Net Worth trend, which is a plain
 * list instead), so this hand-rolls the small amount of geometry needed for
 * a simple pie with a clickable legend, rather than adding a new dependency
 * just for one chart.
 * @param {{ label: string, value: number }[]} data - already sorted by caller if desired
 * @param {(label: string) => void} [onSliceClick] - called when a slice or legend row is tapped
 * @param {string} [selectedLabel] - highlights this slice/legend row if provided
 */
export default function PieChart({ data, onSliceClick, selectedLabel }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total <= 0) {
    return <p className="text-center text-gray-400 text-sm py-6">No spending to show for this view yet.</p>;
  }

  let cumulativeAngle = 0;
  const slices = data.map((d, i) => {
    const startAngle = cumulativeAngle;
    const angle = (d.value / total) * 360;
    cumulativeAngle += angle;
    return { ...d, startAngle, endAngle: cumulativeAngle, color: COLORS[i % COLORS.length] };
  });

  return (
    <div>
      <svg viewBox="0 0 100 100" className="w-40 h-40 mx-auto">
        {slices.map((s) => (
          <path
            key={s.label}
            d={describeArc(50, 50, 48, s.startAngle, s.endAngle)}
            fill={s.color}
            opacity={selectedLabel && selectedLabel !== s.label ? 0.35 : 1}
            onClick={() => onSliceClick?.(s.label)}
            className={onSliceClick ? 'cursor-pointer' : ''}
          />
        ))}
      </svg>
      <div className="mt-3 space-y-1.5">
        {slices.map((s) => (
          <button
            key={s.label}
            onClick={() => onSliceClick?.(s.label)}
            disabled={!onSliceClick}
            className={`w-full flex items-center justify-between text-sm px-2 py-1 rounded-lg ${
              selectedLabel === s.label ? 'bg-gray-100' : ''
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="truncate text-gray-700">{s.label}</span>
            </span>
            <span className="text-gray-500 shrink-0 ml-2">
              {formatCurrency(s.value)} ({Math.round((s.value / total) * 100)}%)
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
