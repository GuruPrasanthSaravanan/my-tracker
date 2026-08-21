import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRow, updateRow } from '../api/sheets';

// AccountSettings tab layout: [Account, MinBalance] - one row per account,
// unlike the Lists tab's independent parallel columns, since this data is a
// proper per-account attribute table.
export function useAccountSettings() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await readSheet(token, 'AccountSettings!A2:B500');
      setRows(data);
    } catch (err) {
      // Tab may not exist yet if the user hasn't created it - fail soft,
      // minBalances will just be empty (no warnings shown).
      console.error('Failed to fetch AccountSettings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const minBalances = new Map();
  for (const row of rows) {
    if (row[0]) minBalances.set(row[0], parseFloat(row[1]) || 0);
  }

  const setMinBalance = useCallback(async (account, minBalance) => {
    const existingIndex = rows.findIndex((r) => r[0] === account);
    if (existingIndex >= 0) {
      const sheetRow = existingIndex + 2;
      await updateRow(token, `AccountSettings!A${sheetRow}:B${sheetRow}`, [account, minBalance]);
    } else {
      await appendRow(token, 'AccountSettings!A:B', [account, minBalance]);
    }
    await fetchData();
  }, [token, fetchData, rows]);

  return { minBalances, isLoading, setMinBalance, refresh: fetchData };
}
