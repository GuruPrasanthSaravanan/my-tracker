import { readSheet, updateRow, clearRow, batchUpdateRows } from './sheets';

/**
 * Every other tab/column that stores a list value as an exact-match string
 * reference, keyed by list name. Used by `renameListValue` to cascade a
 * rename everywhere the old value appears, so a rename can never silently
 * split a balance/spend total between the old and new name (e.g. renaming
 * an Account without this would make CashBook rows written before the
 * rename invisible to the renamed account's balance). `maxRow` mirrors the
 * read range each hook already uses (see e.g. useCashBook.jsx, useEMILoans.jsx)
 * so this stays consistent with the rest of the app's bounded-read approach.
 */
const CASCADE_TARGETS = {
  accounts: [
    { tab: 'CashBook', col: 'C', maxRow: 5000 },
    { tab: 'EMILoans', col: 'F', maxRow: 500 },
    { tab: 'HandLoans', col: 'F', maxRow: 500 },
    { tab: 'CreditCards', col: 'D', maxRow: 200 },
    { tab: 'ChitFunds', col: 'G', maxRow: 200 },
    { tab: 'AccountSettings', col: 'A', maxRow: 500 },
    { tab: 'MonthlyPlans', col: 'E', maxRow: 2000 },
    { tab: 'MonthlyTemplate', col: 'D', maxRow: 200 },
    { tab: 'AccountTypeFavorites', col: 'A', maxRow: 500 },
  ],
  types: [
    { tab: 'CashBook', col: 'D', maxRow: 5000 },
    { tab: 'MonthlyPlans', col: 'B', maxRow: 2000 },
    { tab: 'MonthlyTemplate', col: 'A', maxRow: 200 },
    { tab: 'AccountTypeFavorites', col: 'B', maxRow: 500 },
    { tab: 'SubCategories', col: 'A', maxRow: 1000 },
  ],
  vendors: [
    { tab: 'Vendors', col: 'B', maxRow: 5000 },
  ],
  projects: [
    { tab: 'Vendors', col: 'D', maxRow: 5000 },
    { tab: 'CashBook', col: 'G', maxRow: 5000 },
  ],
  milestoneStatuses: [
    { tab: 'Milestones', col: 'E', maxRow: 2000 },
  ],
};

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

/**
 * Renames a list value everywhere it's used - the Lists tab entry itself,
 * plus every other tab/column that references it (see CASCADE_TARGETS) -
 * written as a single atomic batch so it can't end up half-renamed if one
 * write succeeded and another failed. Skips (no-op) if the old value isn't
 * found in the Lists tab. Uses exact-match comparison, consistent with how
 * these values are compared everywhere else in the app (e.g. `row[2] === account`).
 * @param {string} token
 * @param {'accounts'|'types'|'vendors'|'projects'|'milestoneStatuses'} listName
 * @param {string} oldValue
 * @param {string} newValue
 * @returns {Promise<{ renamed: boolean, cellsUpdated: number }>} cellsUpdated excludes the Lists tab entry itself
 */
export async function renameListValue(token, listName, oldValue, newValue) {
  const trimmedNew = newValue.trim();
  if (!trimmedNew || trimmedNew === oldValue) return { renamed: false, cellsUpdated: 0 };

  const colMap = { accounts: 'A', types: 'B', vendors: 'C', projects: 'D', milestoneStatuses: 'E' };
  const listCol = colMap[listName];
  if (!listCol) throw new Error(`Unknown list: ${listName}`);

  const listRows = await readSheet(token, `Lists!${listCol}2:${listCol}100`);
  const listRowIndex = listRows.findIndex((r) => (r[0] || '').trim() === oldValue);
  if (listRowIndex === -1) return { renamed: false, cellsUpdated: 0 };

  const updates = [{ range: `Lists!${listCol}${listRowIndex + 2}`, values: [trimmedNew] }];

  const targets = CASCADE_TARGETS[listName] || [];
  for (const { tab, col, maxRow } of targets) {
    const rows = await readSheet(token, `${tab}!${col}2:${col}${maxRow}`);
    rows.forEach((row, index) => {
      if ((row[0] || '') === oldValue) {
        updates.push({ range: `${tab}!${col}${index + 2}`, values: [trimmedNew] });
      }
    });
  }

  await batchUpdateRows(token, updates);
  return { renamed: true, cellsUpdated: updates.length - 1 };
}
