import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRow, updateRow } from '../api/sheets';
import { computeDebtProgress } from '../utils/aggregations';

// Column layout (Debts tab):
// A-G: Priority, Name, OriginalAmount, InterestRate, TargetDate, DebitsFrom, Status  (debt/lend rows)
// H:   Row Type -> 'ENTRY' (debt/lend definition) or 'PAYMENT' (payment log)
// I-K: Date, Payment Amount, Remaining  (payment rows only)

export function useDebts() {
  const { token } = useAuth();
  const [rawRows, setRawRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await readSheet(token, 'Debts!A2:K');
      setRawRows(data);
    } catch (err) {
      console.error('Failed to fetch Debts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Separate debt/lend entry rows from payment log rows
  const debtRows = [];
  const payoffRows = [];
  const rowIndexMap = []; // maps debtRows index to rawRows index

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowType = (row[7] || '').toUpperCase();

    if (rowType === 'ENTRY') {
      rowIndexMap.push(i);
      debtRows.push(row);
    } else if (rowType === 'PAYMENT') {
      payoffRows.push({
        debtName: row[1] || '',
        month: row[8] || '',
        payment: parseFloat(row[9]) || 0,
        remaining: parseFloat(row[10]) || 0,
      });
    } else {
      // Legacy rows without a Type column - best-effort detection
      const hasNumericPriority = row[0] && !isNaN(parseInt(row[0]));
      const hasStatus = row[6] && ['active', 'cleared', 'lent', 'recovered'].includes((row[6] || '').toLowerCase());
      if (hasNumericPriority || hasStatus) {
        rowIndexMap.push(i);
        debtRows.push(row);
      } else if (row[0] && row[1] && !hasStatus) {
        payoffRows.push({
          debtName: row[0] || '',
          month: row[1] || '',
          payment: parseFloat(row[2]) || 0,
          remaining: parseFloat(row[3]) || 0,
        });
      }
    }
  }

  const addDebt = useCallback(async (entry) => {
    let priority = entry.priority;
    if (!priority) {
      const maxPriority = debtRows.reduce((max, r) => Math.max(max, parseInt(r[0]) || 0), 0);
      priority = String(maxPriority + 1);
    }
    const values = [
      priority, entry.name,
      entry.originalAmount || '', entry.interestRate || '',
      entry.targetDate || '', entry.debitsFrom || '',
      entry.status || 'Active', 'ENTRY',
    ];
    await appendRow(token, 'Debts!A:K', values);
    await fetchData();
  }, [token, fetchData, debtRows]);

  const editDebt = useCallback(async (debtIndex, entry) => {
    const rawIndex = rowIndexMap[debtIndex];
    const sheetRow = rawIndex + 2;
    const values = [
      entry.priority || '', entry.name,
      entry.originalAmount || '', entry.interestRate || '',
      entry.targetDate || '', entry.debitsFrom || '',
      entry.status || 'Active', 'ENTRY',
    ];
    await updateRow(token, `Debts!A${sheetRow}:H${sheetRow}`, values);
    await fetchData();
  }, [token, fetchData, rowIndexMap]);

  const addPayment = useCallback(async (entry) => {
    const values = [
      '', entry.debtName, '', '', '', '', '', 'PAYMENT',
      entry.month, entry.payment || '', entry.remaining || '',
    ];
    await appendRow(token, 'Debts!A:K', values);
    await fetchData();
  }, [token, fetchData]);

  const progress = computeDebtProgress(debtRows);

  const paidByDebt = {};
  for (const p of payoffRows) {
    paidByDebt[p.debtName] = (paidByDebt[p.debtName] || 0) + p.payment;
  }

  const debts = debtRows.filter((r) => (r[6] || '').toLowerCase() !== 'lent');
  const lends = debtRows.filter((r) => (r[6] || '').toLowerCase() === 'lent');

  return {
    debtRows, debts, lends, payoffRows, isLoading,
    addDebt, editDebt, addPayment,
    refresh: fetchData, progress, paidByDebt,
    _debtIndexOf: (row) => debtRows.indexOf(row),
  };
}
