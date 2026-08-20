import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRow } from '../api/sheets';
import { computeDebtProgress } from '../utils/aggregations';

export function useDebts() {
  const { token } = useAuth();
  const [debtRows, setDebtRows] = useState([]);
  const [payoffRows, setPayoffRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await readSheet(token, 'Debts!A2:G');
      const priorities = [];
      const payoffs = [];
      for (const row of data) {
        if (row[0] && !isNaN(parseInt(row[0]))) {
          priorities.push(row);
        } else if (row[0] && row[1]) {
          payoffs.push({
            debtName: row[0] || '',
            month: row[1] || '',
            payment: parseFloat(row[2]) || 0,
            remaining: parseFloat(row[3]) || 0,
          });
        }
      }
      setDebtRows(priorities);
      setPayoffRows(payoffs);
    } catch (err) {
      console.error('Failed to fetch Debts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  return { debtRows, payoffRows, isLoading, addPayment, refresh: fetchData, progress };
}
