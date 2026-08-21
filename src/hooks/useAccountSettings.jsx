import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRowAt, updateRow } from '../api/sheets';

// AccountSettings tab layout: [Account, MinBalance, AccountNumber, IFSC, Branch,
//   AccountType, Purpose, RMName, RMContact] - one row per account, unlike the
// Lists tab's independent parallel columns, since this data is a proper
// per-account attribute table. Stored in the same private Google Sheet as
// everything else in the app (OAuth-protected, never in the git repo) -
// consistent with the app's existing security model. Only store what's
// useful for quick reference (e.g. last 4 of an account/card number), not
// full card numbers, PINs, or CVVs, which this tracker has no need for.
export function useAccountSettings() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await readSheet(token, 'AccountSettings!A2:I500');
      setRows(data);
    } catch (err) {
      // Tab may not exist yet if the user hasn't created it - fail soft,
      // accountsInfo will just be empty (no warnings shown).
      console.error('Failed to fetch AccountSettings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const accountsInfo = new Map();
  for (const row of rows) {
    if (!row[0]) continue;
    accountsInfo.set(row[0], {
      minBalance: parseFloat(row[1]) || 0,
      accountNumber: row[2] || '',
      ifsc: row[3] || '',
      branch: row[4] || '',
      accountType: row[5] || '',
      purpose: row[6] || '',
      rmName: row[7] || '',
      rmContact: row[8] || '',
    });
  }

  const minBalances = new Map();
  for (const [account, info] of accountsInfo) minBalances.set(account, info.minBalance);

  /** Upserts an account's row, merging with whatever fields already exist so a
   * partial update (e.g. just MinBalance) never wipes out other columns. */
  const upsertAccount = useCallback(async (account, fields) => {
    const existingIndex = rows.findIndex((r) => r[0] === account);
    const existing = existingIndex >= 0 ? accountsInfo.get(account) : {};
    const merged = { ...existing, ...fields };
    const values = [
      account, merged.minBalance || 0, merged.accountNumber || '', merged.ifsc || '',
      merged.branch || '', merged.accountType || '', merged.purpose || '',
      merged.rmName || '', merged.rmContact || '',
    ];
    if (existingIndex >= 0) {
      const sheetRow = existingIndex + 2;
      await updateRow(token, `AccountSettings!A${sheetRow}:I${sheetRow}`, values);
    } else {
      await appendRowAt(token, 'AccountSettings', 'I', rows.length, values);
    }
    await fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, fetchData, rows]);

  const setMinBalance = useCallback((account, minBalance) => upsertAccount(account, { minBalance }), [upsertAccount]);
  const setAccountInfo = useCallback((account, fields) => upsertAccount(account, fields), [upsertAccount]);

  return { accountsInfo, minBalances, isLoading, setMinBalance, setAccountInfo, refresh: fetchData };
}
