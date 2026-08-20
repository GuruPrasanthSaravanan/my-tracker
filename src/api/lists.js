import { readSheet } from './sheets';
import { SPREADSHEET_ID } from '../config';

/**
 * Fetch all dropdown lists from the Lists tab.
 * Lists tab layout: Col A = Accounts, Col B = Types, Col C = Vendors, Col D = Projects, Col E = MilestoneStatuses
 * Row 1 = headers, Row 2+ = values
 * @param {string} token
 * @returns {Promise<{ accounts: string[], types: string[], vendors: string[], projects: string[], milestoneStatuses: string[] }>}
 */
export async function fetchLists(token) {
  const rows = await readSheet(token, 'Lists!A2:E100');

  const accounts = [];
  const types = [];
  const vendors = [];
  const projects = [];
  const milestoneStatuses = [];

  for (const row of rows) {
    if (row[0]) accounts.push(row[0]);
    if (row[1]) types.push(row[1]);
    if (row[2]) vendors.push(row[2]);
    if (row[3]) projects.push(row[3]);
    if (row[4]) milestoneStatuses.push(row[4]);
  }

  return { accounts, types, vendors, projects, milestoneStatuses };
}

/**
 * Add a new value to a specific list column.
 * @param {string} token
 * @param {'accounts'|'types'|'vendors'|'projects'} listName
 * @param {string} value - The new value to add
 */
export async function addToList(token, listName, value) {
  const colMap = { accounts: 'A', types: 'B', vendors: 'C', projects: 'D', milestoneStatuses: 'E' };
  const col = colMap[listName];
  if (!col) throw new Error(`Unknown list: ${listName}`);

  // Find the next empty row in that column by reading existing data
  const rows = await readSheet(token, `Lists!${col}2:${col}100`);
  const nextRow = rows.length + 2; // +2 because data starts at row 2

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Lists!${col}${nextRow}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [[value]] }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error?.message || `Sheets API error: ${res.status}`);
  }
}
