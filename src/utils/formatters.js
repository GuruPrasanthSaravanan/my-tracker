/**
 * Format number in Indian currency style (no rupee symbol).
 * 153000 -> "1,53,000"
 */
export function formatCurrency(num) {
  if (num === 0) return '0';
  const isNegative = num < 0;
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Format a date string for display.
 * "2026-09-01" -> "1 Sep"
 */
export function formatDate(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = date.toLocaleString('en', { month: 'short' });
  return `${day} ${month}`;
}
