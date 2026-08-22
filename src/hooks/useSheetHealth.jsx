import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { getSheetTitles, deleteSheetTab, ensureTabsExist } from '../api/sheets';
import { SHEET_SCHEMAS } from '../api/sheetSchemas';

/**
 * Diagnostic check comparing the spreadsheet's actual tabs against
 * SHEET_SCHEMAS (the app's registry of every tab it reads/writes) - surfaces
 * two kinds of drift:
 *  - orphanTabs: tabs that exist in the sheet but aren't used by the app
 *    anymore (e.g. the legacy pre-EMI/Hand-Loans "Debts" tab, or a stray
 *    manually-created tab) - safe to review and delete.
 *  - missingTabs: tabs the app expects but doesn't find - should be rare
 *    since `ensureTabsExist` auto-creates these on every sign-in, but shown
 *    for visibility, with a manual "Provision Now" fallback.
 * Runs lazily (on mount of whatever page uses it, i.e. Settings), not on
 * every app load, since this is an occasional diagnostic, not something the
 * rest of the app depends on.
 */
export function useSheetHealth() {
  const { token } = useAuth();
  const [actualTitles, setActualTitles] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const titles = await getSheetTitles(token);
      setActualTitles(titles);
    } catch (err) {
      console.error('Failed to check sheet health:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const expectedTitles = Object.keys(SHEET_SCHEMAS);
  const orphanTabs = actualTitles ? actualTitles.filter((t) => !expectedTitles.includes(t)) : [];
  const missingTabs = actualTitles ? expectedTitles.filter((t) => !actualTitles.includes(t)) : [];

  const deleteOrphanTab = useCallback(async (title) => {
    const deleted = await deleteSheetTab(token, title);
    await fetchData();
    return deleted;
  }, [token, fetchData]);

  const provisionMissingTabs = useCallback(async () => {
    await ensureTabsExist(token, SHEET_SCHEMAS);
    await fetchData();
  }, [token, fetchData]);

  return { isLoading, orphanTabs, missingTabs, deleteOrphanTab, provisionMissingTabs, refresh: fetchData };
}
