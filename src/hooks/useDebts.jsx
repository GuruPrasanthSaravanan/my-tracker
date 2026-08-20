import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRow, updateRow, clearRow } from '../api/sheets';
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
  const payoffIndexMap = []; // maps payoffRows index to rawRows index

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowType = (row[7] || '').toUpperCase();

    if (rowType === 'ENTRY') {
      rowIndexMap.push(i);
      debtRows.push(row);
    } else if (rowType === 'PAYMENT') {
      payoffIndexMap.push(i);
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
        payoffIndexMap.push(i);
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

  const editPayment = useCallback(async (paymentIndex, entry) => {
    const rawIndex = payoffIndexMap[paymentIndex];
    const sheetRow = rawIndex + 2;
    const values = [
      '', entry.debtName, '', '', '', '', '', 'PAYMENT',
      entry.month, entry.payment || '', entry.remaining || '',
    ];
    await updateRow(token, `Debts!A${sheetRow}:K${sheetRow}`, values);
    await fetchData();
  }, [token, fetchData, payoffIndexMap]);

  const deletePayment = useCallback(async (paymentIndex) => {
    const rawIndex = payoffIndexMap[paymentIndex];
    const sheetRow = rawIndex + 2;
    await clearRow(token, `Debts!A${sheetRow}:K${sheetRow}`);
    await fetchData();
  }, [token, fetchData, payoffIndexMap]);

  const paidByDebt = {};
  for (const p of payoffRows) {
    paidByDebt[p.debtName] = (paidByDebt[p.debtName] || 0) + p.payment;
  }

  const debts = debtRows.filter((r) => (r[6] || '').toLowerCase() !== 'lent');
  const lends = debtRows.filter((r) => (r[6] || '').toLowerCase() === 'lent');

  // Blend Status-based "Cleared" debts with partial/full payments toward Active debts,
  // so the progress bar reflects real payments even before a debt is manually marked Cleared.
  const progress = computeDebtProgress(debts);
  let paymentAdjustedCleared = 0;
  for (const r of debts) {
    const status = (r[6] || '').toLowerCase();
    if (status === 'cleared') continue; // already counted in progress.totalCleared
    const name = r[1] || '';
    const amount = parseFloat(r[2]) || 0;
    const paid = paidByDebt[name] || 0;
    paymentAdjustedCleared += Math.min(paid, amount);
  }
  const totalCleared = progress.totalCleared + paymentAdjustedCleared;
  const percentCleared = progress.totalOriginal > 0 ? (totalCleared / progress.totalOriginal) * 100 : 0;
  // Exclude debts that are fully paid off (even if Status still says Active) from the "attacking" list
  const activeDebts = progress.activeDebts.filter((d) => {
    const paid = paidByDebt[d.name] || 0;
    return paid < d.originalAmount;
  });
  const adjustedProgress = { ...progress, totalCleared, percentCleared, activeDebts };

  return {
    debtRows, debts, lends, payoffRows, isLoading,
    addDebt, editDebt, addPayment, editPayment, deletePayment,
    refresh: fetchData, progress: adjustedProgress, paidByDebt,
    _debtIndexOf: (row) => debtRows.indexOf(row),
    _paymentIndexOf: (payoffRow) => payoffRows.indexOf(payoffRow),
  };
}
