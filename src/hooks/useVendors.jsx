import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRow } from '../api/sheets';
import { computeVendorBalances, sumByField } from '../utils/aggregations';

export function useVendors() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await readSheet(token, 'Vendors!A2:F');
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
      entry.date,
      entry.vendor,
      entry.description,
      entry.project,
      entry.bill || '',
      entry.paid || '',
    ];
    await appendRow(token, 'Vendors!A:F', values);
    await fetchData();
  }, [token, fetchData]);

  const vendorBalances = computeVendorBalances(rows);
  const projectBills = sumByField(rows, 3, 4);
  const projectPaid = sumByField(rows, 3, 5);

  const totalOwed = Array.from(vendorBalances.values()).reduce((sum, val) => sum + val, 0);

  return { rows, isLoading, addEntry, refresh: fetchData, vendorBalances, projectBills, projectPaid, totalOwed };
}
