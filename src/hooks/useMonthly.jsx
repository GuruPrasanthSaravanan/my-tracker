import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRowAt, updateRow, clearRow } from '../api/sheets';

// MonthlyPlans tab layout: [Month, Category, PlannedAmount, Section]
//   Month: "YYYY-MM". Category: should match a CashBook Type for the Actual
//   column to line up automatically. Section: Income | My Outflows | Wife
//   Outflows | Projects (free text grouping label for display only).
export function useMonthly() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await readSheet(token, 'MonthlyPlans!A2:D2000');
      setRows(data);
    } catch (err) {
      console.error('Failed to fetch MonthlyPlans:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addPlan = useCallback(async (entry) => {
    const values = [entry.month, entry.category, entry.plannedAmount || '', entry.section || ''];
    await appendRowAt(token, 'MonthlyPlans', 'D', rows.length, values);
    await fetchData();
  }, [token, fetchData, rows]);

  const editPlan = useCallback(async (rowIndex, entry) => {
    const sheetRow = rowIndex + 2;
    const values = [entry.month, entry.category, entry.plannedAmount || '', entry.section || ''];
    await updateRow(token, `MonthlyPlans!A${sheetRow}:D${sheetRow}`, values);
    await fetchData();
  }, [token, fetchData]);

  const deletePlan = useCallback(async (rowIndex) => {
    const sheetRow = rowIndex + 2;
    await clearRow(token, `MonthlyPlans!A${sheetRow}:D${sheetRow}`);
    await fetchData();
  }, [token, fetchData]);

  const parsedPlans = rows
    .map((row, index) => ({
      _rowIndex: index,
      month: row[0] || '',
      category: row[1] || '',
      plannedAmount: parseFloat(row[2]) || 0,
      section: row[3] || '',
    }))
    .filter((p) => p.month && p.category);

  /** Copies every plan row from one month to another (e.g. "carry forward" to a new month). */
  const copyMonthPlans = useCallback(async (fromMonth, toMonth) => {
    const sourceRows = parsedPlans.filter((p) => p.month === fromMonth);
    let nextRowCount = rows.length;
    for (const p of sourceRows) {
      await appendRowAt(token, 'MonthlyPlans', 'D', nextRowCount, [toMonth, p.category, p.plannedAmount, p.section]);
      nextRowCount++;
    }
    await fetchData();
  }, [token, fetchData, rows, parsedPlans]);

  return {
    plans: parsedPlans, isLoading,
    addPlan, editPlan, deletePlan, copyMonthPlans,
    refresh: fetchData,
  };
}
