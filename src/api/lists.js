import { readSheet, updateRow, clearRow } from './sheets';

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
 * Trims whitespace and skips the write (no-op) if a case-insensitive duplicate
 * already exists in that column, to avoid near-duplicate entries like "Raju" / "raju ".
 * @param {string} token
 * @param {'accounts'|'types'|'vendors'|'projects'} listName
 * @param {string} value - The new value to add
 * @returns {Promise<{ added: boolean, value: string }>} the (possibly trimmed) value actually used, and whether a new row was written
 */
export async function addToList(token, listName, value) {
  const colMap = { accounts: 'A', types: 'B', vendors: 'C', projects: 'D', milestoneStatuses: 'E' };
  const col = colMap[listName];
  if (!col) throw new Error(`Unknown list: ${listName}`);

  const trimmed = value.trim();
  const rows = await readSheet(token, `Lists!${col}2:${col}100`);
  const existing = rows.map((r) => (r[0] || '').trim());

  const duplicate = existing.find((v) => v.toLowerCase() === trimmed.toLowerCase());
  if (duplicate) {
    // Already exists (case-insensitive) - don't write a near-duplicate row
    return { added: false, value: duplicate };
  }

  const nextRow = rows.length + 2; // +2 because data starts at row 2
  await updateRow(token, `Lists!${col}${nextRow}`, [trimmed]);
  return { added: true, value: trimmed };
}

/**
 * Removes a value from a list column (used by the Settings "Manage Lists"
 * screen). Clears the cell rather than shifting rows up, consistent with how
 * every other tab in the app "deletes" a row - see bugs-and-lessons.md §9.5
 * for why row gaps are an accepted, intentional trade-off here.
 * @param {string} token
 * @param {'accounts'|'types'|'vendors'|'projects'|'milestoneStatuses'} listName
 * @param {string} value
 * @returns {Promise<boolean>} whether a matching row was found and cleared
 */
export async function removeFromList(token, listName, value) {
  const colMap = { accounts: 'A', types: 'B', vendors: 'C', projects: 'D', milestoneStatuses: 'E' };
  const col = colMap[listName];
  if (!col) throw new Error(`Unknown list: ${listName}`);

  const rows = await readSheet(token, `Lists!${col}2:${col}100`);
  const rowIndex = rows.findIndex((r) => (r[0] || '').trim() === value);
  if (rowIndex === -1) return false;

  const sheetRow = rowIndex + 2;
  await clearRow(token, `Lists!${col}${sheetRow}`);
  return true;
}
