import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRowAt, updateRow, clearRow } from '../api/sheets';
import { computeChitFundStatus } from '../utils/chitFundCalculations';

// ChitFunds tab layout: [Name, TotalValue, MonthlyContribution, DurationMonths,
//   StartDate, ForemanCommissionPercent, DebitsFrom, Status, Notes]
// ChitFundMonths tab layout: [ChitName, Month, ContributionPaid, DividendReceived,
//   IsPrizedMonth, PrizeAmountReceived, Notes] - one row per month actually
//   logged. Deliberately records actual outcomes rather than simulating the
//   auction (see chitFundCalculations.js for why).
export function useChitFunds() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [monthRows, setMonthRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [chitData, monthData] = await Promise.all([
        readSheet(token, 'ChitFunds!A2:I200'),
        readSheet(token, 'ChitFundMonths!A2:G2000'),
      ]);
      setRows(chitData);
      setMonthRows(monthData);
    } catch (err) {
      console.error('Failed to fetch ChitFunds:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addChit = useCallback(async (entry) => {
    const values = [
      entry.name, entry.totalValue || '', entry.monthlyContribution || '', entry.durationMonths || '',
      entry.startDate || '', entry.foremanCommissionPercent || '', entry.debitsFrom || '',
      entry.status || 'Active', entry.notes || '',
    ];
    await appendRowAt(token, 'ChitFunds', 'I', rows.length, values);
    await fetchData();
  }, [token, fetchData, rows]);

  const editChit = useCallback(async (rowIndex, entry) => {
    const sheetRow = rowIndex + 2;
    const values = [
      entry.name, entry.totalValue || '', entry.monthlyContribution || '', entry.durationMonths || '',
      entry.startDate || '', entry.foremanCommissionPercent || '', entry.debitsFrom || '',
      entry.status || 'Active', entry.notes || '',
    ];
    await updateRow(token, `ChitFunds!A${sheetRow}:I${sheetRow}`, values);
    await fetchData();
  }, [token, fetchData]);

  const deleteChit = useCallback(async (rowIndex) => {
    const sheetRow = rowIndex + 2;
    await clearRow(token, `ChitFunds!A${sheetRow}:I${sheetRow}`);
    await fetchData();
  }, [token, fetchData]);

  const addMonth = useCallback(async (entry) => {
    const values = [
      entry.chitName, entry.month, entry.contributionPaid || '', entry.dividendReceived || '',
      entry.isPrizedMonth ? 'TRUE' : '', entry.prizeAmountReceived || '', entry.notes || '',
    ];
    await appendRowAt(token, 'ChitFundMonths', 'G', monthRows.length, values);
    await fetchData();
  }, [token, fetchData, monthRows]);

  const editMonth = useCallback(async (monthIndex, entry) => {
    const sheetRow = monthIndex + 2;
    const values = [
      entry.chitName, entry.month, entry.contributionPaid || '', entry.dividendReceived || '',
      entry.isPrizedMonth ? 'TRUE' : '', entry.prizeAmountReceived || '', entry.notes || '',
    ];
    await updateRow(token, `ChitFundMonths!A${sheetRow}:G${sheetRow}`, values);
    await fetchData();
  }, [token, fetchData]);

  const deleteMonth = useCallback(async (monthIndex) => {
    const sheetRow = monthIndex + 2;
    await clearRow(token, `ChitFundMonths!A${sheetRow}:G${sheetRow}`);
    await fetchData();
  }, [token, fetchData]);

  const chits = rows
    .map((row, index) => ({
      _rowIndex: index,
      name: row[0] || '',
      totalValue: parseFloat(row[1]) || 0,
      monthlyContribution: parseFloat(row[2]) || 0,
      durationMonths: parseInt(row[3]) || 0,
      startDate: row[4] || '',
      foremanCommissionPercent: parseFloat(row[5]) || 0,
      debitsFrom: row[6] || '',
      status: row[7] || 'Active',
      notes: row[8] || '',
    }))
    .filter((c) => c.name);

  const months = monthRows
    .map((row, index) => ({
      _rowIndex: index,
      chitName: row[0] || '',
      month: row[1] || '',
      contributionPaid: parseFloat(row[2]) || 0,
      dividendReceived: parseFloat(row[3]) || 0,
      isPrizedMonth: (row[4] || '').toUpperCase() === 'TRUE',
      prizeAmountReceived: parseFloat(row[5]) || 0,
      notes: row[6] || '',
    }))
    .filter((m) => m.chitName && m.month);

  const chitsWithStatus = chits.map((chit) => {
    const chitMonths = months
      .filter((m) => m.chitName === chit.name)
      .sort((a, b) => a.month.localeCompare(b.month));
    const status = computeChitFundStatus(chit, chitMonths);
    return { ...chit, months: chitMonths, ...status };
  });

  const totalMonthlyCommitment = chitsWithStatus
    .filter((c) => c.status !== 'Closed' && !c.isComplete)
    .reduce((sum, c) => sum + c.monthlyContribution, 0);

  return {
    chits: chitsWithStatus, months, isLoading,
    addChit, editChit, deleteChit, addMonth, editMonth, deleteMonth,
    refresh: fetchData, totalMonthlyCommitment,
  };
}
