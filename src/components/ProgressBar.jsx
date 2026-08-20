export default function ProgressBar({ value, max, color = 'primary', showLabel = true }) {
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const colorClasses = {
    primary: 'bg-primary',
    success: 'bg-success',
    danger: 'bg-danger',
    amber: 'bg-amber-500',
  };

  return (
    <div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${colorClasses[color] || colorClasses.primary}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-gray-500 mt-1">{Math.round(percent)}%</p>
      )}
    </div>
  );
}
