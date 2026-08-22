import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRowAt, clearRow } from '../api/sheets';

// AccountTypeFavorites tab layout: [Account, Type] - one row per pinned
// pair. Explicitly pinning a Type for an Account guarantees it always shows
// first in that account's Type dropdown, regardless of how often it's
// actually been used - the manually-configured half of the Account->Type
// ordering (the other half, usage frequency, is auto-learned live from
// CashBook history - see computeTypeFrequencyForAccount/orderTypeOptionsForAccount
// in aggregations.js - no tab needed for that part).
export function useAccountTypeFavorites() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await readSheet(token, 'AccountTypeFavorites!A2:B500');
      setRows(data);
    } catch (err) {
      console.error('Failed to fetch AccountTypeFavorites:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const favoritesByAccount = new Map();
  rows.forEach((row, index) => {
    const account = row[0] || '';
    const type = row[1] || '';
    if (!account || !type) return;
    if (!favoritesByAccount.has(account)) favoritesByAccount.set(account, []);
    favoritesByAccount.get(account).push({ type, _rowIndex: index });
  });

  const favoritesForAccount = useCallback(
    (account) => (favoritesByAccount.get(account) || []).map((f) => f.type),
    [favoritesByAccount] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const isFavorite = useCallback(
    (account, type) => favoritesForAccount(account).includes(type),
    [favoritesForAccount]
  );

  /** Pins a Type as a favorite for an Account if not already pinned; unpins it if it is. */
  const toggleFavorite = useCallback(async (account, type) => {
    const existing = (favoritesByAccount.get(account) || []).find((f) => f.type === type);
    if (existing) {
      await clearRow(token, `AccountTypeFavorites!A${existing._rowIndex + 2}:B${existing._rowIndex + 2}`);
    } else {
      await appendRowAt(token, 'AccountTypeFavorites', 'B', rows.length, [account, type]);
    }
    await fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, fetchData, rows, favoritesByAccount]);

  return { favoritesForAccount, isFavorite, toggleFavorite, isLoading, refresh: fetchData };
}
