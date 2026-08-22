import { SPREADSHEET_ID } from '../config';

const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

/**
 * Shared response handler for all Sheets API calls.
 * - On 401 (expired/invalid token): dispatches a 'mytracker:auth-expired' event so
 *   useAuth can sign the user out and show a clear "session expired" message,
 *   instead of every caller showing a generic "Failed to save" toast.
 * - On 429 (rate limited): throws a specific, user-actionable message.
 */
async function handleResponse(res) {
  if (res.ok) return res;

  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('mytracker:auth-expired'));
    throw new Error('Your session expired. Please sign in again.');
  }

  if (res.status === 429) {
    throw new Error('Too many requests right now. Please wait a moment and try again.');
  }

  const error = await res.json().catch(() => ({}));
  throw new Error(error.error?.message || `Sheets API error: ${res.status}`);
}

// Matches the exact "YYYY-MM-DD" strings produced by every <input type="date">
// and date-helper function in this app.
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Protects plain ISO date strings ("2026-08-21") from Google Sheets' automatic
 * type detection when writing with valueInputOption=USER_ENTERED.
 *
 * Without this, Sheets auto-detects a string that looks like a date and
 * converts the cell to its internal Date type, then re-formats it for display
 * (and for later FORMATTED_VALUE reads) according to the *spreadsheet's own
 * locale* setting - which may not be "YYYY-MM-DD" (e.g. a US-locale sheet
 * reformats it to "8/21/2026"). If that reformatted string is later re-parsed
 * anywhere with `new Date(...)`, non-ISO formats are parsed as *local* time
 * rather than UTC, and converting back to a date-only string via
 * `toISOString().split('T')[0]` (UTC-based) can then shift the date backward
 * by one day for any timezone ahead of UTC (e.g. IST) - this is exactly the
 * "statement date changes when edited" bug this fixes.
 *
 * Prefixing with a leading apostrophe is the standard Sheets convention for
 * "store this literal text, don't auto-detect a type" - the apostrophe itself
 * is never stored or returned, so reads always get back the exact same
 * "YYYY-MM-DD" string that was written, regardless of spreadsheet locale.
 * @param {any[]} values - a single row of values about to be written
 */
function protectIsoDates(values) {
  return values.map((v) => (typeof v === 'string' && ISO_DATE_PATTERN.test(v) ? `'${v}` : v));
}

/**
 * Read a range from the spreadsheet.
 * @param {string} token - OAuth access token
 * @param {string} range - e.g., "CashBook!A2:G"
 * @returns {Promise<string[][]>} 2D array of cell values
 */
export async function readSheet(token, range) {
  const url = `${BASE_URL}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleResponse(res);
  const data = await res.json();
  return data.values || [];
}

/**
 * Append a row to the spreadsheet.
 *
 * CAUTION: The Sheets API's `:append` endpoint auto-detects "the table" within
 * the given range and appends after it, anchored to whatever column that
 * detected table happens to start at - not necessarily column A. If a row
 * anywhere in the range has stray content only in a later column (e.g. a
 * leftover value in a "blank" row that wasn't fully cleared, or a manual
 * edit), the appended row can land shifted several columns to the right of
 * where it should be, corrupting the data silently. Prefer `appendRowAt`
 * below, which writes to an explicitly computed row/column range instead of
 * relying on this auto-detection. Kept for the few callers where the
 * existing row count isn't readily available.
 * @param {string} token - OAuth access token
 * @param {string} range - e.g., "CashBook!A:G"
 * @param {string[]} values - single row of values
 */
export async function appendRow(token, range, values) {
  const url = `${BASE_URL}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [protectIsoDates(values)] }),
  });
  await handleResponse(res);
}

/**
 * Writes a new row to an explicit, unambiguous row/column range instead of
 * relying on the Sheets API's auto-detected table boundaries (see the
 * warning on `appendRow` above). This is the preferred way to add a new row
 * - callers should pass the current number of data rows already read (e.g.
 * from the hook's own state), and this computes the next row deterministically.
 * @param {string} token - OAuth access token
 * @param {string} sheetName - e.g. "HandLoans"
 * @param {string} lastCol - last column letter of the row's data, e.g. "H"
 * @param {number} currentRowCount - number of existing data rows (excluding the header)
 * @param {string[]} values - row values to write
 */
export async function appendRowAt(token, sheetName, lastCol, currentRowCount, values) {
  const rowNumber = currentRowCount + 2; // +2: row 1 is the header, data starts at row 2
  await updateRow(token, `${sheetName}!A${rowNumber}:${lastCol}${rowNumber}`, values);
}

/**
 * Update a specific row in the spreadsheet.
 * @param {string} token - OAuth access token
 * @param {string} range - e.g., "CashBook!A5:F5" (specific row)
 * @param {string[]} values - row values to write
 */
export async function updateRow(token, range, values) {
  const url = `${BASE_URL}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [protectIsoDates(values)] }),
  });
  await handleResponse(res);
}

/**
 * Writes multiple row ranges in a single request via the Sheets API's
 * `values:batchUpdate` endpoint. Used whenever two or more rows must land
 * together as a single logical action (e.g. a self-transfer between two
 * CashBook accounts, which needs a matching Money Out row and Money In row) -
 * a single HTTP call either succeeds or fails as a whole, which is far safer
 * than issuing separate sequential `updateRow` calls that could leave one
 * leg written and the other missing if the second call fails.
 * @param {string} token - OAuth access token
 * @param {{ range: string, values: string[] }[]} updates - one entry per row to write
 */
export async function batchUpdateRows(token, updates) {
  const url = `${BASE_URL}/${SPREADSHEET_ID}/values:batchUpdate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: updates.map(({ range, values }) => ({ range, values: [protectIsoDates(values)] })),
    }),
  });
  await handleResponse(res);
}

/**
 * Clear a specific row (effectively deleting it visually).
 * @param {string} token - OAuth access token
 * @param {string} range - e.g., "CashBook!A5:F5"
 */
export async function clearRow(token, range) {
  const url = `${BASE_URL}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}:clear`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleResponse(res);
}

/**
 * Returns the names of every tab (sheet) that currently exists in the spreadsheet.
 * @param {string} token - OAuth access token
 */
export async function getSheetTitles(token) {
  const url = `${BASE_URL}/${SPREADSHEET_ID}?fields=sheets.properties.title`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  await handleResponse(res);
  const data = await res.json();
  return (data.sheets || []).map((s) => s.properties.title);
}

/**
 * Creates a new tab (sheet) via the Sheets API's batchUpdate addSheet request.
 * @param {string} token - OAuth access token
 * @param {string} title - name of the new tab
 */
export async function createSheetTab(token, title) {
  const url = `${BASE_URL}/${SPREADSHEET_ID}:batchUpdate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
  });
  await handleResponse(res);
}

/**
 * Permanently deletes a tab (sheet) from the spreadsheet via batchUpdate.
 * Irreversible through this app (Google Sheets version history may allow
 * manual recovery within the Sheets UI, but don't rely on it) - callers
 * should always confirm with the user before invoking this.
 * @param {string} token - OAuth access token
 * @param {string} title - name of the tab to delete
 * @returns {Promise<boolean>} whether a matching tab was found and deleted
 */
export async function deleteSheetTab(token, title) {
  const url = `${BASE_URL}/${SPREADSHEET_ID}?fields=sheets.properties`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  await handleResponse(res);
  const data = await res.json();
  const sheet = (data.sheets || []).find((s) => s.properties.title === title);
  if (!sheet) return false;

  const batchUrl = `${BASE_URL}/${SPREADSHEET_ID}:batchUpdate`;
  const res2 = await fetch(batchUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ deleteSheet: { sheetId: sheet.properties.sheetId } }] }),
  });
  await handleResponse(res2);
  return true;
}

/**
 * Ensures every tab in `schemas` exists in the spreadsheet, creating any that
 * are missing (with their header row) via the Sheets API directly - so the
 * user never has to manually create a tab in the Google Sheets UI. Safe to
 * call on every app load: a single `getSheetTitles` read up front means tabs
 * that already exist cost nothing extra.
 * @param {string} token - OAuth access token
 * @param {Object<string, string[]>} schemas - tabName -> array of header column names
 */
export async function ensureTabsExist(token, schemas) {
  const existingTitles = await getSheetTitles(token);
  const missing = Object.entries(schemas).filter(([name]) => !existingTitles.includes(name));
  if (missing.length === 0) return;

  for (const [tabName, headers] of missing) {
    await createSheetTab(token, tabName);
    await updateRow(token, `${tabName}!A1`, headers);
  }
}
