import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, updateRow } from '../api/sheets';

// ProjectionSettings tab layout: [TypicalMonthlyIncome, TypicalMonthlyExpenses] -
// a single settings row (always row 2), not one row per month. This is the
// Projections page's own stable surplus assumption, deliberately decoupled
// from whatever a specific month's Monthly Plan happens to say - a month
// with a one-off Project expense or irregular income shouldn't skew a
// multi-year debt-payoff projection. See bugs-and-lessons.md.
export function useProjectionSettings() {
  const { token } = useAuth();
  const [row, setRow] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await readSheet(token, 'ProjectionSettings!A2:B2');
      setRow(data[0] || []);
    } catch (err) {
      console.error('Failed to fetch ProjectionSettings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const save = useCallback(async (typicalIncome, typicalExpenses) => {
    await updateRow(token, 'ProjectionSettings!A2:B2', [typicalIncome || 0, typicalExpenses || 0]);
    await fetchData();
  }, [token, fetchData]);

  const typicalIncome = parseFloat(row[0]) || 0;
  const typicalExpenses = parseFloat(row[1]) || 0;

  return { typicalIncome, typicalExpenses, isLoading, save, refresh: fetchData };
}
