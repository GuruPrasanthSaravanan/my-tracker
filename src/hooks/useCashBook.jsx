import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRow, updateRow, clearRow } from '../api/sheets';
import { computeAccountBalances, sumByField } from '../utils/aggregations';

export function useCashBook() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await readSheet(token, 'CashBook!A2:F');
      setRows(data);
    } catch (err) {
      console.error('Failed to fetch CashBook:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addEntry = useCallback(async (entry) => {
    const values = [
      entry.date, entry.description, entry.account, entry.type,
      entry.moneyIn || '', entry.moneyOut || '',
    ];
    await appendRow(token, 'CashBook!A:F', values);
    await fetchData();
  }, [token, fetchData]);

  const editEntry = useCallback(async (rowIndex, entry) => {
    const sheetRow = rowIndex + 2; // +2 because row 1 is header, data starts at row 2
    const values = [
      entry.date, entry.description, entry.account, entry.type,
      entry.moneyIn || '', entry.moneyOut || '',
    ];
    await updateRow(token, `CashBook!A${sheetRow}:F${sheetRow}`, values);
    await fetchData();
  }, [token, fetchData]);

  const deleteEntry = useCallback(async (rowIndex) => {
    const sheetRow = rowIndex + 2;
    await clearRow(token, `CashBook!A${sheetRow}:F${sheetRow}`);
    await fetchData();
  }, [token, fetchData]);

  const accountBalances = computeAccountBalances(rows);
  const typeInTotals = sumByField(rows, 3, 4);
  const typeOutTotals = sumByField(rows, 3, 5);
  const totalBalance = Array.from(accountBalances.values()).reduce((sum, val) => sum + val, 0);

  return { rows, isLoading, addEntry, editEntry, deleteEntry, refresh: fetchData, accountBalances, typeInTotals, typeOutTotals, totalBalance };
}
