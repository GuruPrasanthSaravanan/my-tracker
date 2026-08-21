import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRowAt, updateRow, clearRow } from '../api/sheets';

// MonthlyPlans tab layout: [Month, Category, PlannedAmount, Section]
//   Month: "YYYY-MM". Category: should match a CashBook Type for the Actual
//   column to line up automatically. Section: Income | My Outflows | Wife
//   Outflows | Projects (free text grouping label for display only).
// MonthlyTemplate tab layout: [Category, Section, DefaultPlannedAmount] - a
// reusable starting point (edited once, applied to any new month) so every
// month doesn't start blank.
export function useMonthly() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [templateRows, setTemplateRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [planData, templateData] = await Promise.all([
        readSheet(token, 'MonthlyPlans!A2:D2000'),
        readSheet(token, 'MonthlyTemplate!A2:C200'),
      ]);
      setRows(planData);
      setTemplateRows(templateData);
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

  const parsedTemplate = templateRows
    .map((row, index) => ({
      _rowIndex: index,
      category: row[0] || '',
      section: row[1] || '',
      defaultPlannedAmount: parseFloat(row[2]) || 0,
    }))
    .filter((t) => t.category);

  const addTemplateItem = useCallback(async (entry) => {
    const values = [entry.category, entry.section || '', entry.defaultPlannedAmount || ''];
    await appendRowAt(token, 'MonthlyTemplate', 'C', templateRows.length, values);
    await fetchData();
  }, [token, fetchData, templateRows]);

  const editTemplateItem = useCallback(async (rowIndex, entry) => {
    const sheetRow = rowIndex + 2;
    const values = [entry.category, entry.section || '', entry.defaultPlannedAmount || ''];
    await updateRow(token, `MonthlyTemplate!A${sheetRow}:C${sheetRow}`, values);
    await fetchData();
  }, [token, fetchData]);

  const deleteTemplateItem = useCallback(async (rowIndex) => {
    const sheetRow = rowIndex + 2;
    await clearRow(token, `MonthlyTemplate!A${sheetRow}:C${sheetRow}`);
    await fetchData();
  }, [token, fetchData]);

  /** Applies the saved template to a month, e.g. for a brand new month that has no plans yet. */
  const loadTemplateIntoMonth = useCallback(async (month) => {
    let nextRowCount = rows.length;
    for (const t of parsedTemplate) {
      await appendRowAt(token, 'MonthlyPlans', 'D', nextRowCount, [month, t.category, t.defaultPlannedAmount, t.section]);
      nextRowCount++;
    }
    await fetchData();
  }, [token, fetchData, rows, parsedTemplate]);

  return {
    plans: parsedPlans, template: parsedTemplate, isLoading,
    addPlan, editPlan, deletePlan, copyMonthPlans,
    addTemplateItem, editTemplateItem, deleteTemplateItem, loadTemplateIntoMonth,
    refresh: fetchData,
  };
}
