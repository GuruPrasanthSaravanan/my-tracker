import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRowAt, updateRow, clearRow } from '../api/sheets';
import { computeMinimumDue, projectCreditCardPayoff, computeCreditCardInterestState } from '../utils/loanCalculations';

// CreditCards tab layout: [Name, CreditLimit, InterestRateMonthly, DebitsFrom, Status, Notes]
// CreditCardBills tab layout: [CardName, StatementDate, DueDate, TotalAmountDue,
//   MinimumAmountDue, PaymentMade, PaymentDate, Notes, IsEstimated] - one row per billing cycle.
//   IsEstimated: 'TRUE' if this bill was created from the CashBook spend projection rather
//   than an actual bank statement - cleared once the user edits/confirms it with real figures.
export function useCreditCards() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [billRows, setBillRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [cardData, billData] = await Promise.all([
        readSheet(token, 'CreditCards!A2:F200'),
        readSheet(token, 'CreditCardBills!A2:I2000'),
      ]);
      setRows(cardData);
      setBillRows(billData);
    } catch (err) {
      console.error('Failed to fetch CreditCards:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addCard = useCallback(async (entry) => {
    const values = [
      entry.name, entry.creditLimit || '', entry.interestRateMonthly || 3.5,
      entry.debitsFrom || '', entry.status || 'Active', entry.notes || '',
    ];
    await appendRowAt(token, 'CreditCards', 'F', rows.length, values);
    await fetchData();
  }, [token, fetchData, rows]);

  const editCard = useCallback(async (rowIndex, entry) => {
    const sheetRow = rowIndex + 2;
    const values = [
      entry.name, entry.creditLimit || '', entry.interestRateMonthly || 3.5,
      entry.debitsFrom || '', entry.status || 'Active', entry.notes || '',
    ];
    await updateRow(token, `CreditCards!A${sheetRow}:F${sheetRow}`, values);
    await fetchData();
  }, [token, fetchData]);

  const deleteCard = useCallback(async (rowIndex) => {
    const sheetRow = rowIndex + 2;
    await clearRow(token, `CreditCards!A${sheetRow}:F${sheetRow}`);
    await fetchData();
  }, [token, fetchData]);

  const addBill = useCallback(async (entry) => {
    const minimumAmountDue = entry.minimumAmountDue || computeMinimumDue({ totalAmountDue: parseFloat(entry.totalAmountDue) || 0 });
    const values = [
      entry.cardName, entry.statementDate, entry.dueDate, entry.totalAmountDue,
      minimumAmountDue, entry.paymentMade || '', entry.paymentDate || '', entry.notes || '',
      entry.isEstimated ? 'TRUE' : '',
    ];
    await appendRowAt(token, 'CreditCardBills', 'I', billRows.length, values);
    await fetchData();
  }, [token, fetchData, billRows]);

  // Editing a bill always clears IsEstimated - once a human reviews and saves it
  // (whether via the generic edit form or the "confirm actual amount" shortcut),
  // it's treated as confirmed/corrected rather than a standing estimate.
  const editBill = useCallback(async (billIndex, entry) => {
    const sheetRow = billIndex + 2;
    const values = [
      entry.cardName, entry.statementDate, entry.dueDate, entry.totalAmountDue,
      entry.minimumAmountDue, entry.paymentMade || '', entry.paymentDate || '', entry.notes || '',
      '',
    ];
    await updateRow(token, `CreditCardBills!A${sheetRow}:I${sheetRow}`, values);
    await fetchData();
  }, [token, fetchData]);

  const deleteBill = useCallback(async (billIndex) => {
    const sheetRow = billIndex + 2;
    await clearRow(token, `CreditCardBills!A${sheetRow}:I${sheetRow}`);
    await fetchData();
  }, [token, fetchData]);

  const cards = rows
    .map((row, index) => ({
      _rowIndex: index,
      name: row[0] || '',
      creditLimit: parseFloat(row[1]) || 0,
      interestRateMonthly: parseFloat(row[2]) || 3.5,
      debitsFrom: row[3] || '',
      status: row[4] || 'Active',
      notes: row[5] || '',
    }))
    .filter((c) => c.name);

  const bills = billRows
    .map((row, index) => ({
      _rowIndex: index,
      cardName: row[0] || '',
      statementDate: row[1] || '',
      dueDate: row[2] || '',
      totalAmountDue: parseFloat(row[3]) || 0,
      minimumAmountDue: parseFloat(row[4]) || 0,
      paymentMade: parseFloat(row[5]) || 0,
      paymentDate: row[6] || '',
      notes: row[7] || '',
      isEstimated: (row[8] || '').toUpperCase() === 'TRUE',
    }))
    .filter((b) => b.cardName);

  const cardsWithBills = cards.map((card) => {
    const cardBills = bills
      .filter((b) => b.cardName === card.name)
      .sort((a, b) => new Date(b.statementDate) - new Date(a.statementDate));
    const latestBill = cardBills[0] || null;

    // Interest only actually starts accruing once the due date has passed without
    // full payment (see loanCalculations.js computeCreditCardInterestState for why) -
    // not simply because paymentMade < totalAmountDue.
    const interestState = latestBill
      ? computeCreditCardInterestState(latestBill, card.interestRateMonthly)
      : { outstanding: 0, isPaidInFull: true, interestAccruing: false, daysPastDue: 0, accruedInterestSinceDue: 0, effectiveBalance: 0 };

    const projection = interestState.effectiveBalance > 0
      ? projectCreditCardPayoff(interestState.effectiveBalance, card.interestRateMonthly)
      : null;

    return {
      ...card, bills: cardBills, latestBill,
      outstanding: interestState.outstanding,
      isPaidInFull: interestState.isPaidInFull,
      interestAccruing: interestState.interestAccruing,
      daysPastDue: interestState.daysPastDue,
      accruedInterestSinceDue: interestState.accruedInterestSinceDue,
      projection,
    };
  });

  const totalOutstanding = cardsWithBills.reduce((sum, c) => sum + c.outstanding, 0);

  return {
    cards: cardsWithBills, bills, isLoading,
    addCard, editCard, deleteCard, addBill, editBill, deleteBill,
    refresh: fetchData, totalOutstanding,
  };
}
