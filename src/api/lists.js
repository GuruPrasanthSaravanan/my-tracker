import { readSheet } from './sheets';

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
