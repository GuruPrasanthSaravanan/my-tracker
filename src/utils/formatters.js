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
 * Falls back to returning the raw string if it can't be parsed as a date
 * (e.g. free-text values like "Aug 2028" used elsewhere in the app), instead
 * of rendering "NaN undefined".
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = date.getDate();
  const month = date.toLocaleString('en', { month: 'short' });
  return `${day} ${month}`;
}

/**
 * Formats a Date object as a local "YYYY-MM-DD" string using local calendar
 * getters (getFullYear/getMonth/getDate), NOT `toISOString()`.
 *
 * `toISOString()` always converts to UTC first - for a timezone ahead of UTC
 * (e.g. IST, UTC+5:30), calling it on "local midnight" or any local time
 * before the UTC offset has elapsed rolls back to the *previous* calendar day
 * in UTC, so `new Date().toISOString().split('T')[0]` can silently return
 * yesterday's date for a few hours after midnight local time. This helper
 * reads the date in the browser's own local timezone instead, so "today" is
 * always today, and is safe to use as the single source of truth for date
 * arithmetic (e.g. addDaysISO) that should stay anchored to local calendar days.
 */
export function toLocalISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Today's date as a local "YYYY-MM-DD" string (see toLocalISODate). */
export function getTodayISO() {
  return toLocalISODate(new Date());
}

/**
 * Adds `days` to an ISO date string, staying in local-calendar-day
 * arithmetic throughout (parses as local midnight, not UTC).
 */
export function addDaysISO(dateStr, days) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  return toLocalISODate(d);
}
