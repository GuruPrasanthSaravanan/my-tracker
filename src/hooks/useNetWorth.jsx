import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRowAt, clearRow } from '../api/sheets';

// NetWorthSnapshots tab layout: [Date, AssetsTotal, LiabilitiesTotal, Notes]
// Manually logged periodically (e.g. quarterly) to build a trend over time,
// since CashBook only reflects the CURRENT balance, not history. The "right
// now" net worth is always computed live from other hooks - see NetWorthPage.
export function useNetWorth() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await readSheet(token, 'NetWorthSnapshots!A2:D500');
      setRows(data);
    } catch (err) {
      console.error('Failed to fetch NetWorthSnapshots:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addSnapshot = useCallback(async (entry) => {
    const values = [entry.date, entry.assetsTotal, entry.liabilitiesTotal, entry.notes || ''];
    await appendRowAt(token, 'NetWorthSnapshots', 'D', rows.length, values);
    await fetchData();
  }, [token, fetchData, rows]);

  const deleteSnapshot = useCallback(async (rowIndex) => {
    const sheetRow = rowIndex + 2;
    await clearRow(token, `NetWorthSnapshots!A${sheetRow}:D${sheetRow}`);
    await fetchData();
  }, [token, fetchData]);

  const snapshots = rows
    .map((row, index) => ({
      _rowIndex: index,
      date: row[0] || '',
      assetsTotal: parseFloat(row[1]) || 0,
      liabilitiesTotal: parseFloat(row[2]) || 0,
      notes: row[3] || '',
      netWorth: (parseFloat(row[1]) || 0) - (parseFloat(row[2]) || 0),
    }))
    .filter((s) => s.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return { snapshots, isLoading, addSnapshot, deleteSnapshot, refresh: fetchData };
}
