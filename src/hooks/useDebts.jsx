import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRow, updateRow } from '../api/sheets';
import { computeDebtProgress } from '../utils/aggregations';

export function useDebts() {
  const { token } = useAuth();
  const [rawRows, setRawRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await readSheet(token, 'Debts!A2:G');
      setRawRows(data);
    } catch (err) {
      console.error('Failed to fetch Debts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Separate priority rows (debts/lends) from payoff tracking rows
  const debtRows = [];
  const payoffRows = [];
  const rowIndexMap = []; // maps debtRows index to rawRows index

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row[0] && !isNaN(parseInt(row[0]))) {
      rowIndexMap.push(i);
      debtRows.push(row);
    } else if (row[0] && row[1]) {
      payoffRows.push({
        debtName: row[0] || '',
        month: row[1] || '',
        payment: parseFloat(row[2]) || 0,
        remaining: parseFloat(row[3]) || 0,
      });
    }
  }

  const addDebt = useCallback(async (entry) => {
    const values = [
      entry.priority || '', entry.name,
      entry.originalAmount || '', entry.interestRate || '',
      entry.targetDate || '', entry.debitsFrom || '',
      entry.status || 'Active',
    ];
    await appendRow(token, 'Debts!A:G', values);
    await fetchData();
  }, [token, fetchData]);

  const editDebt = useCallback(async (debtIndex, entry) => {
    const rawIndex = rowIndexMap[debtIndex];
    const sheetRow = rawIndex + 2;
    const values = [
      entry.priority || '', entry.name,
      entry.originalAmount || '', entry.interestRate || '',
      entry.targetDate || '', entry.debitsFrom || '',
      entry.status || 'Active',
    ];
    await updateRow(token, `Debts!A${sheetRow}:G${sheetRow}`, values);
    await fetchData();
  }, [token, fetchData, rowIndexMap]);

  const addPayment = useCallback(async (entry) => {
    const values = [
      entry.debtName, entry.month,
      entry.payment || '', entry.remaining || '',
      '', '', '',
    ];
    await appendRow(token, 'Debts!A:G', values);
    await fetchData();
  }, [token, fetchData]);

  const progress = computeDebtProgress(debtRows);

  // Separate debts from lends
  const debts = debtRows.filter((r) => (r[6] || '').toLowerCase() !== 'lent');
  const lends = debtRows.filter((r) => (r[6] || '').toLowerCase() === 'lent');

  return {
    debtRows, debts, lends, payoffRows, isLoading,
    addDebt, editDebt, addPayment,
    refresh: fetchData, progress,
    _debtIndexOf: (row) => debtRows.indexOf(row),
  };
}
