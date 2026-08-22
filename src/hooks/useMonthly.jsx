import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRowAt, updateRow, clearRow } from '../api/sheets';

// MonthlyPlans tab layout: [Month, Category, PlannedAmount, Section, Account]
//   Month: "YYYY-MM". Category: should match a CashBook Type for the Actual
//   column to line up automatically. Section: Income | My Outflows | Wife
//   Outflows | Projects (free text grouping label for display only).
//   Account: OPTIONAL - narrows Actual-matching to just this account when
//   set (e.g. "EMI" planned specifically against HDFC); left blank, Actual
//   keeps matching every account with that Category, same as before this
//   field existed - nothing is missed by leaving it blank.
// MonthlyTemplate tab layout: [Category, Section, DefaultPlannedAmount, Account] - a
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
        readSheet(token, 'MonthlyPlans!A2:E2000'),
        readSheet(token, 'MonthlyTemplate!A2:D200'),
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
    const values = [entry.month, entry.category, entry.plannedAmount || '', entry.section || '', entry.account || ''];
    await appendRowAt(token, 'MonthlyPlans', 'E', rows.length, values);
    await fetchData();
  }, [token, fetchData, rows]);

  const editPlan = useCallback(async (rowIndex, entry) => {
    const sheetRow = rowIndex + 2;
    const values = [entry.month, entry.category, entry.plannedAmount || '', entry.section || '', entry.account || ''];
    await updateRow(token, `MonthlyPlans!A${sheetRow}:E${sheetRow}`, values);
    await fetchData();
  }, [token, fetchData]);

  const deletePlan = useCallback(async (rowIndex) => {
    const sheetRow = rowIndex + 2;
    await clearRow(token, `MonthlyPlans!A${sheetRow}:E${sheetRow}`);
    await fetchData();
  }, [token, fetchData]);

  const parsedPlans = rows
    .map((row, index) => ({
      _rowIndex: index,
      month: row[0] || '',
      category: row[1] || '',
      plannedAmount: parseFloat(row[2]) || 0,
      section: row[3] || '',
      account: row[4] || '',
    }))
    .filter((p) => p.month && p.category);

  /** Copies every plan row from one month to another (e.g. "carry forward" to a new month). */
  const copyMonthPlans = useCallback(async (fromMonth, toMonth) => {
    const sourceRows = parsedPlans.filter((p) => p.month === fromMonth);
    let nextRowCount = rows.length;
    for (const p of sourceRows) {
      await appendRowAt(token, 'MonthlyPlans', 'E', nextRowCount, [toMonth, p.category, p.plannedAmount, p.section, p.account]);
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
      account: row[3] || '',
    }))
    .filter((t) => t.category);

  const addTemplateItem = useCallback(async (entry) => {
    const values = [entry.category, entry.section || '', entry.defaultPlannedAmount || '', entry.account || ''];
    await appendRowAt(token, 'MonthlyTemplate', 'D', templateRows.length, values);
    await fetchData();
  }, [token, fetchData, templateRows]);

  const editTemplateItem = useCallback(async (rowIndex, entry) => {
    const sheetRow = rowIndex + 2;
    const values = [entry.category, entry.section || '', entry.defaultPlannedAmount || '', entry.account || ''];
    await updateRow(token, `MonthlyTemplate!A${sheetRow}:D${sheetRow}`, values);
    await fetchData();
  }, [token, fetchData]);

  const deleteTemplateItem = useCallback(async (rowIndex) => {
    const sheetRow = rowIndex + 2;
    await clearRow(token, `MonthlyTemplate!A${sheetRow}:D${sheetRow}`);
    await fetchData();
  }, [token, fetchData]);

  /** Applies the saved template to a month, e.g. for a brand new month that has no plans yet. */
  const loadTemplateIntoMonth = useCallback(async (month) => {
    let nextRowCount = rows.length;
    for (const t of parsedTemplate) {
      await appendRowAt(token, 'MonthlyPlans', 'E', nextRowCount, [month, t.category, t.defaultPlannedAmount, t.section, t.account]);
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
