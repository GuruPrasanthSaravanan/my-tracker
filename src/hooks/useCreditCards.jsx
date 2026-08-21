import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRow, updateRow, clearRow } from '../api/sheets';
import { computeMinimumDue, projectCreditCardPayoff } from '../utils/loanCalculations';

// CreditCards tab layout: [Name, CreditLimit, InterestRateMonthly, DebitsFrom, Status, Notes]
// CreditCardBills tab layout: [CardName, StatementDate, DueDate, TotalAmountDue,
//   MinimumAmountDue, PaymentMade, PaymentDate, Notes] - one row per billing cycle.
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
        readSheet(token, 'CreditCardBills!A2:H2000'),
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
    await appendRow(token, 'CreditCards!A:F', values);
    await fetchData();
  }, [token, fetchData]);

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
    ];
    await appendRow(token, 'CreditCardBills!A:H', values);
    await fetchData();
  }, [token, fetchData]);

  const editBill = useCallback(async (billIndex, entry) => {
    const sheetRow = billIndex + 2;
    const values = [
      entry.cardName, entry.statementDate, entry.dueDate, entry.totalAmountDue,
      entry.minimumAmountDue, entry.paymentMade || '', entry.paymentDate || '', entry.notes || '',
    ];
    await updateRow(token, `CreditCardBills!A${sheetRow}:H${sheetRow}`, values);
    await fetchData();
  }, [token, fetchData]);

  const deleteBill = useCallback(async (billIndex) => {
    const sheetRow = billIndex + 2;
    await clearRow(token, `CreditCardBills!A${sheetRow}:H${sheetRow}`);
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
    }))
    .filter((b) => b.cardName);

  const cardsWithBills = cards.map((card) => {
    const cardBills = bills
      .filter((b) => b.cardName === card.name)
      .sort((a, b) => new Date(b.statementDate) - new Date(a.statementDate));
    const latestBill = cardBills[0] || null;
    const outstanding = latestBill ? Math.max(latestBill.totalAmountDue - latestBill.paymentMade, 0) : 0;
    const isPaidInFull = latestBill ? latestBill.paymentMade >= latestBill.totalAmountDue : true;
    const projection = outstanding > 0
      ? projectCreditCardPayoff(outstanding, card.interestRateMonthly)
      : null;

    return { ...card, bills: cardBills, latestBill, outstanding, isPaidInFull, projection };
  });

  const totalOutstanding = cardsWithBills.reduce((sum, c) => sum + c.outstanding, 0);

  return {
    cards: cardsWithBills, bills, isLoading,
    addCard, editCard, deleteCard, addBill, editBill, deleteBill,
    refresh: fetchData, totalOutstanding,
  };
}
