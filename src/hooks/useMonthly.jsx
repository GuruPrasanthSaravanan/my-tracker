import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRowAt, updateRow, clearRow } from '../api/sheets';

// MonthlyPlans tab layout: [Month, Category, PlannedAmount, Section, Account, ToAccount]
//   Month: "YYYY-MM". Category: should match a CashBook Type for the Actual
//   column to line up automatically. Section: Income | My Outflows | Wife
//   Outflows | Projects (free text grouping label for display only).
//   Account: OPTIONAL - narrows Actual-matching to just this account when
//   set (e.g. "EMI" planned specifically against HDFC); left blank, Actual
//   keeps matching every account with that Category, same as before this
//   field existed - nothing is missed by leaving it blank.
//   ToAccount: OPTIONAL, only meaningful when Category="TRANSFER" - lets a
//   plan explicitly say "move money from Account to ToAccount" (e.g. a
//   wants allowance, ICICI -> AXIS). When both are set for a TRANSFER plan,
//   Actual pairs the two CashBook legs of a real transfer via
//   computeActualForTransferPlan instead of just narrowing to one side.
// MonthlyTemplate tab layout: [Category, Section, DefaultPlannedAmount, Account, ToAccount] - a
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
        readSheet(token, 'MonthlyPlans!A2:F2000'),
        readSheet(token, 'MonthlyTemplate!A2:E200'),
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
    const values = [
      entry.month, entry.category, entry.plannedAmount || '', entry.section || '',
      entry.account || '', entry.toAccount || '',
    ];
    await appendRowAt(token, 'MonthlyPlans', 'F', rows.length, values);
    await fetchData();
  }, [token, fetchData, rows]);

  const editPlan = useCallback(async (rowIndex, entry) => {
    const sheetRow = rowIndex + 2;
    const values = [
      entry.month, entry.category, entry.plannedAmount || '', entry.section || '',
      entry.account || '', entry.toAccount || '',
    ];
    await updateRow(token, `MonthlyPlans!A${sheetRow}:F${sheetRow}`, values);
    await fetchData();
  }, [token, fetchData]);

  const deletePlan = useCallback(async (rowIndex) => {
    const sheetRow = rowIndex + 2;
    await clearRow(token, `MonthlyPlans!A${sheetRow}:F${sheetRow}`);
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
      toAccount: row[5] || '',
    }))
    .filter((p) => p.month && p.category);

  /** Copies every plan row from one month to another (e.g. "carry forward" to a new month). */
  const copyMonthPlans = useCallback(async (fromMonth, toMonth) => {
    const sourceRows = parsedPlans.filter((p) => p.month === fromMonth);
    let nextRowCount = rows.length;
    for (const p of sourceRows) {
      await appendRowAt(token, 'MonthlyPlans', 'F', nextRowCount, [toMonth, p.category, p.plannedAmount, p.section, p.account, p.toAccount]);
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
      toAccount: row[4] || '',
    }))
    .filter((t) => t.category);

  const addTemplateItem = useCallback(async (entry) => {
    const values = [entry.category, entry.section || '', entry.defaultPlannedAmount || '', entry.account || '', entry.toAccount || ''];
    await appendRowAt(token, 'MonthlyTemplate', 'E', templateRows.length, values);
    await fetchData();
  }, [token, fetchData, templateRows]);

  const editTemplateItem = useCallback(async (rowIndex, entry) => {
    const sheetRow = rowIndex + 2;
    const values = [entry.category, entry.section || '', entry.defaultPlannedAmount || '', entry.account || '', entry.toAccount || ''];
    await updateRow(token, `MonthlyTemplate!A${sheetRow}:E${sheetRow}`, values);
    await fetchData();
  }, [token, fetchData]);

  const deleteTemplateItem = useCallback(async (rowIndex) => {
    const sheetRow = rowIndex + 2;
    await clearRow(token, `MonthlyTemplate!A${sheetRow}:E${sheetRow}`);
    await fetchData();
  }, [token, fetchData]);

  /**
   * Applies the saved template to a month - either the whole template (e.g.
   * for a brand new month with no plans yet), or a specific hand-picked
   * subset of template items (`items`), so template items can also be
   * pulled in one/a few at a time into a month that already has some plans,
   * instead of being all-or-nothing.
   */
  const loadTemplateIntoMonth = useCallback(async (month, items) => {
    const templateItems = items || parsedTemplate;
    let nextRowCount = rows.length;
    for (const t of templateItems) {
      await appendRowAt(token, 'MonthlyPlans', 'F', nextRowCount, [month, t.category, t.defaultPlannedAmount, t.section, t.account, t.toAccount]);
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
