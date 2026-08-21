import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRowAt, updateRow, clearRow } from '../api/sheets';
import { computeVendorBalances, sumByField } from '../utils/aggregations';

export function useVendors() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      // Bounded range (5000 rows ~ years of daily entries) to avoid an unbounded
      // read as the sheet grows indefinitely. True pagination is deferred to a
      // later phase - see docs/superpowers/mytracker-bugs-and-lessons.md §6.10.
      const data = await readSheet(token, 'Vendors!A2:F5000');
      setRows(data);
    } catch (err) {
      console.error('Failed to fetch Vendors:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addEntry = useCallback(async (entry) => {
    const values = [
      entry.date, entry.vendor, entry.description, entry.project,
      entry.bill || '', entry.paid || '',
    ];
    await appendRowAt(token, 'Vendors', 'F', rows.length, values);
    await fetchData();
  }, [token, fetchData, rows]);

  const editEntry = useCallback(async (rowIndex, entry) => {
    const sheetRow = rowIndex + 2;
    const values = [
      entry.date, entry.vendor, entry.description, entry.project,
      entry.bill || '', entry.paid || '',
    ];
    await updateRow(token, `Vendors!A${sheetRow}:F${sheetRow}`, values);
    await fetchData();
  }, [token, fetchData]);

  const deleteEntry = useCallback(async (rowIndex) => {
    const sheetRow = rowIndex + 2;
    await clearRow(token, `Vendors!A${sheetRow}:F${sheetRow}`);
    await fetchData();
  }, [token, fetchData]);

  const vendorBalances = computeVendorBalances(rows);
  const projectBills = sumByField(rows, 3, 4);
  const projectPaid = sumByField(rows, 3, 5);
  const totalOwed = Array.from(vendorBalances.values()).reduce((sum, val) => sum + val, 0);

  return { rows, isLoading, addEntry, editEntry, deleteEntry, refresh: fetchData, vendorBalances, projectBills, projectPaid, totalOwed };
}
