import { SPREADSHEET_ID } from '../config';

const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

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
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error?.message || `Sheets API error: ${res.status}`);
  }
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
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error?.message || `Sheets API error: ${res.status}`);
  }
}
