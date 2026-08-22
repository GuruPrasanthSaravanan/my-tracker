import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRowAt, updateRow, clearRow, batchUpdateRows } from '../api/sheets';
import { computeAccountBalances, sumByField } from '../utils/aggregations';

export function useCashBook() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      // Bounded range (5000 rows ~ years of daily entries) to avoid an unbounded
      // read as the sheet grows indefinitely. True pagination is deferred to a
      // later phase - see docs/superpowers/mytracker-bugs-and-lessons.md §6.10.
      // Column G (Project) is optional - only set for Type=PROJECT entries, so
      // a project's spend can be tracked directly from CashBook, not just Vendors.
      // Column H (SubCategory) is optional - a finer-grained tag scoped to
      // whichever Type is selected (e.g. Type=WANTS -> SubCategory=Dining),
      // for the Monthly spending breakdown pie chart.
      const data = await readSheet(token, 'CashBook!A2:H5000');
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
      entry.moneyIn || '', entry.moneyOut || '', entry.project || '', entry.subCategory || '',
    ];
    await appendRowAt(token, 'CashBook', 'H', rows.length, values);
    await fetchData();
  }, [token, fetchData, rows]);

  const editEntry = useCallback(async (rowIndex, entry) => {
    const sheetRow = rowIndex + 2; // +2 because row 1 is header, data starts at row 2
    const values = [
      entry.date, entry.description, entry.account, entry.type,
      entry.moneyIn || '', entry.moneyOut || '', entry.project || '', entry.subCategory || '',
    ];
    await updateRow(token, `CashBook!A${sheetRow}:H${sheetRow}`, values);
    await fetchData();
  }, [token, fetchData]);

  const deleteEntry = useCallback(async (rowIndex) => {
    const sheetRow = rowIndex + 2;
    await clearRow(token, `CashBook!A${sheetRow}:H${sheetRow}`);
    await fetchData();
  }, [token, fetchData]);

  /**
   * Records a self-transfer between two of the user's own accounts as a
   * matched pair of rows (Money Out from `fromAccount`, Money In to
   * `toAccount`) written in a single atomic batch request, so the two legs
   * can't end up half-written if one write succeeded and the other failed.
   */
  const addTransfer = useCallback(async ({ date, fromAccount, toAccount, amount, description }) => {
    const desc = description || `Transfer: ${fromAccount} to ${toAccount}`;
    const outRow = rows.length + 2;
    const inRow = rows.length + 3;
    await batchUpdateRows(token, [
      { range: `CashBook!A${outRow}:F${outRow}`, values: [date, desc, fromAccount, 'TRANSFER', '', amount] },
      { range: `CashBook!A${inRow}:F${inRow}`, values: [date, desc, toAccount, 'TRANSFER', amount, ''] },
    ]);
    await fetchData();
  }, [token, fetchData, rows]);

  const accountBalances = computeAccountBalances(rows);
  const typeInTotals = sumByField(rows, 3, 4);
  const typeOutTotals = sumByField(rows, 3, 5);
  const totalBalance = Array.from(accountBalances.values()).reduce((sum, val) => sum + val, 0);

  return { rows, isLoading, addEntry, editEntry, deleteEntry, addTransfer, refresh: fetchData, accountBalances, typeInTotals, typeOutTotals, totalBalance };
}
