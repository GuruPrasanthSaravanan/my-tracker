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
    body: JSON.stringify({ values: [values] }),
  });
  await handleResponse(res);
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
    body: JSON.stringify({ values: [values] }),
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
