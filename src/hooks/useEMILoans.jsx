import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRow, updateRow, clearRow } from '../api/sheets';
import { computeEMIStatus } from '../utils/loanCalculations';

// EMILoans tab layout: [Name, Principal, AnnualRate, TenureMonths, StartDate, DebitsFrom, Status, Notes]
// EMIPrepayments tab layout: [LoanName, Date, Amount, Notes] - part-payments/prepayments
// that accelerate payoff beyond the regular monthly EMI.
export function useEMILoans() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [prepaymentRows, setPrepaymentRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [loanData, prepayData] = await Promise.all([
        readSheet(token, 'EMILoans!A2:H500'),
        readSheet(token, 'EMIPrepayments!A2:D2000'),
      ]);
      setRows(loanData);
      setPrepaymentRows(prepayData);
    } catch (err) {
      console.error('Failed to fetch EMILoans:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addLoan = useCallback(async (entry) => {
    const values = [
      entry.name, entry.principal, entry.annualRate, entry.tenureMonths,
      entry.startDate, entry.debitsFrom || '', entry.status || 'Active', entry.notes || '',
    ];
    await appendRow(token, 'EMILoans!A:H', values);
    await fetchData();
  }, [token, fetchData]);

  const editLoan = useCallback(async (rowIndex, entry) => {
    const sheetRow = rowIndex + 2;
    const values = [
      entry.name, entry.principal, entry.annualRate, entry.tenureMonths,
      entry.startDate, entry.debitsFrom || '', entry.status || 'Active', entry.notes || '',
    ];
    await updateRow(token, `EMILoans!A${sheetRow}:H${sheetRow}`, values);
    await fetchData();
  }, [token, fetchData]);

  const deleteLoan = useCallback(async (rowIndex) => {
    const sheetRow = rowIndex + 2;
    await clearRow(token, `EMILoans!A${sheetRow}:H${sheetRow}`);
    await fetchData();
  }, [token, fetchData]);

  const addPrepayment = useCallback(async (loanName, date, amount, notes = '') => {
    await appendRow(token, 'EMIPrepayments!A:D', [loanName, date, amount, notes]);
    await fetchData();
  }, [token, fetchData]);

  const editPrepayment = useCallback(async (prepaymentIndex, values) => {
    const sheetRow = prepaymentIndex + 2;
    await updateRow(token, `EMIPrepayments!A${sheetRow}:D${sheetRow}`, values);
    await fetchData();
  }, [token, fetchData]);

  const deletePrepayment = useCallback(async (prepaymentIndex) => {
    const sheetRow = prepaymentIndex + 2;
    await clearRow(token, `EMIPrepayments!A${sheetRow}:D${sheetRow}`);
    await fetchData();
  }, [token, fetchData]);

  const loans = rows
    .map((row, index) => ({
      _rowIndex: index,
      name: row[0] || '',
      principal: parseFloat(row[1]) || 0,
      annualRate: parseFloat(row[2]) || 0,
      tenureMonths: parseInt(row[3]) || 0,
      startDate: row[4] || '',
      debitsFrom: row[5] || '',
      status: row[6] || 'Active',
      notes: row[7] || '',
    }))
    .filter((loan) => loan.name); // skip cleared/blank rows

  const parsedPrepayments = prepaymentRows
    .map((row, index) => ({
      _rowIndex: index,
      loanName: row[0] || '',
      date: row[1] || '',
      amount: parseFloat(row[2]) || 0,
      notes: row[3] || '',
    }))
    .filter((p) => p.loanName);

  const loansWithStatus = loans.map((loan) => {
    const prepayments = parsedPrepayments.filter((p) => p.loanName === loan.name);
    return {
      ...loan,
      prepayments,
      emiStatus: loan.startDate && loan.tenureMonths
        ? computeEMIStatus(loan, new Date(), prepayments)
        : null,
    };
  });

  const totalOutstanding = loansWithStatus.reduce(
    (sum, loan) => sum + (loan.emiStatus?.outstandingBalance ?? loan.principal),
    0
  );
  const totalMonthlyEMI = loansWithStatus
    .filter((loan) => loan.status !== 'Closed' && !(loan.emiStatus?.isComplete))
    .reduce((sum, loan) => sum + (loan.emiStatus?.emi ?? 0), 0);

  return {
    loans: loansWithStatus, prepayments: parsedPrepayments, isLoading,
    addLoan, editLoan, deleteLoan, addPrepayment, editPrepayment, deletePrepayment,
    refresh: fetchData, totalOutstanding, totalMonthlyEMI,
  };
}
