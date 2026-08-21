import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRow, updateRow, clearRow } from '../api/sheets';
import { computeSimpleInterestAccrued, splitPayment } from '../utils/loanCalculations';

// HandLoans tab layout: [Name, Principal, AnnualRate, StartDate, Direction, DebitsFrom, Status, Notes]
//   Direction: 'Owe' (I owe this) or 'Lent' (I lent this to someone)
//   Status: 'Active' | 'Closed'
// HandLoanPayments tab layout: [LoanName, Date, Amount, InterestPaid, PrincipalPaid, RemainingPrincipal]
export function useHandLoans() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [paymentRows, setPaymentRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [loanData, paymentData] = await Promise.all([
        readSheet(token, 'HandLoans!A2:H500'),
        readSheet(token, 'HandLoanPayments!A2:F2000'),
      ]);
      setRows(loanData);
      setPaymentRows(paymentData);
    } catch (err) {
      console.error('Failed to fetch HandLoans:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addLoan = useCallback(async (entry) => {
    const values = [
      entry.name, entry.principal, entry.annualRate || 0, entry.startDate,
      entry.direction || 'Owe', entry.debitsFrom || '', entry.status || 'Active', entry.notes || '',
    ];
    await appendRow(token, 'HandLoans!A:H', values);
    await fetchData();
  }, [token, fetchData]);

  const editLoan = useCallback(async (rowIndex, entry) => {
    const sheetRow = rowIndex + 2;
    const values = [
      entry.name, entry.principal, entry.annualRate || 0, entry.startDate,
      entry.direction || 'Owe', entry.debitsFrom || '', entry.status || 'Active', entry.notes || '',
    ];
    await updateRow(token, `HandLoans!A${sheetRow}:H${sheetRow}`, values);
    await fetchData();
  }, [token, fetchData]);

  const deleteLoan = useCallback(async (rowIndex) => {
    const sheetRow = rowIndex + 2;
    await clearRow(token, `HandLoans!A${sheetRow}:H${sheetRow}`);
    await fetchData();
  }, [token, fetchData]);

  const parsedLoans = rows
    .map((row, index) => ({
      _rowIndex: index,
      name: row[0] || '',
      principal: parseFloat(row[1]) || 0,
      annualRate: parseFloat(row[2]) || 0,
      startDate: row[3] || '',
      direction: row[4] || 'Owe',
      debitsFrom: row[5] || '',
      status: row[6] || 'Active',
      notes: row[7] || '',
    }))
    .filter((loan) => loan.name);

  const parsedPayments = paymentRows
    .map((row, index) => ({
      _rowIndex: index,
      loanName: row[0] || '',
      date: row[1] || '',
      amount: parseFloat(row[2]) || 0,
      interestPaid: parseFloat(row[3]) || 0,
      principalPaid: parseFloat(row[4]) || 0,
      remainingPrincipal: parseFloat(row[5]) || 0,
    }))
    .filter((p) => p.loanName);

  /**
   * Computes the current state of a hand loan: outstanding principal (reduced
   * by any principal payments made so far), and interest accrued since the
   * later of the loan start date or the last payment date.
   */
  function getLoanState(loan, asOfDate = new Date()) {
    const payments = parsedPayments
      .filter((p) => p.loanName === loan.name)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    let outstandingPrincipal = loan.principal;
    let lastEventDate = loan.startDate;
    let totalInterestPaid = 0;
    let totalPrincipalPaid = 0;

    for (const p of payments) {
      outstandingPrincipal = Math.max(outstandingPrincipal - p.principalPaid, 0);
      totalInterestPaid += p.interestPaid;
      totalPrincipalPaid += p.principalPaid;
      lastEventDate = p.date;
    }

    const accruedInterest = outstandingPrincipal > 0
      ? computeSimpleInterestAccrued(outstandingPrincipal, loan.annualRate, lastEventDate, asOfDate)
      : 0;

    return {
      outstandingPrincipal,
      accruedInterest,
      totalInterestPaid,
      totalPrincipalPaid,
      lastEventDate,
      payments,
    };
  }

  const addPayment = useCallback(async (loanName, amount, date) => {
    const loan = parsedLoans.find((l) => l.name === loanName);
    if (!loan) throw new Error('Loan not found');

    const state = getLoanState(loan, date);
    const { interestPaid, principalPaid } = splitPayment(amount, state.accruedInterest);
    const remainingPrincipal = Math.max(state.outstandingPrincipal - principalPaid, 0);

    const values = [loanName, date, amount, interestPaid, principalPaid, remainingPrincipal];
    await appendRow(token, 'HandLoanPayments!A:F', values);
    await fetchData();

    return { interestPaid, principalPaid, remainingPrincipal };
  }, [token, fetchData, parsedLoans, parsedPayments]);

  const editPayment = useCallback(async (paymentIndex, values) => {
    const sheetRow = paymentIndex + 2;
    await updateRow(token, `HandLoanPayments!A${sheetRow}:F${sheetRow}`, values);
    await fetchData();
  }, [token, fetchData]);

  const deletePayment = useCallback(async (paymentIndex) => {
    const sheetRow = paymentIndex + 2;
    await clearRow(token, `HandLoanPayments!A${sheetRow}:F${sheetRow}`);
    await fetchData();
  }, [token, fetchData]);

  const loansWithState = parsedLoans.map((loan) => ({
    ...loan,
    state: getLoanState(loan),
  }));

  const debts = loansWithState.filter((l) => l.direction !== 'Lent');
  const lends = loansWithState.filter((l) => l.direction === 'Lent');

  const totalOwed = debts
    .filter((l) => l.status !== 'Closed')
    .reduce((sum, l) => sum + l.state.outstandingPrincipal + l.state.accruedInterest, 0);
  const totalLent = lends
    .filter((l) => l.status !== 'Closed')
    .reduce((sum, l) => sum + l.state.outstandingPrincipal, 0);

  return {
    loans: loansWithState, debts, lends, payments: parsedPayments, isLoading,
    addLoan, editLoan, deleteLoan, addPayment, editPayment, deletePayment,
    getLoanState, refresh: fetchData, totalOwed, totalLent,
  };
}
