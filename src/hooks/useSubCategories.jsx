import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRowAt } from '../api/sheets';

// SubCategories tab layout: [Type, SubCategory] - a general-purpose,
// per-Type list (e.g. Type=WANTS -> Dining/Shopping/Entertainment;
// Type=FAMILY -> Groceries/Medical), not hardcoded to any one Type. Used to
// populate the optional Sub-category dropdown on a CashBook entry once a
// Type is selected, and to power the Monthly page's spending pie chart
// drill-down.
export function useSubCategories() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await readSheet(token, 'SubCategories!A2:B1000');
      setRows(data);
    } catch (err) {
      console.error('Failed to fetch SubCategories:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const byType = new Map();
  for (const row of rows) {
    const type = row[0] || '';
    const subCategory = row[1] || '';
    if (!type || !subCategory) continue;
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type).push(subCategory);
  }

  const subCategoriesForType = useCallback((type) => byType.get(type) || [], [byType]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Adds a new sub-category under a Type, if it doesn't already exist there. */
  const addSubCategory = useCallback(async (type, subCategory) => {
    const trimmed = subCategory.trim();
    if (!trimmed) return trimmed;
    const existing = byType.get(type) || [];
    if (existing.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return trimmed;
    await appendRowAt(token, 'SubCategories', 'B', rows.length, [type, trimmed]);
    await fetchData();
    return trimmed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, fetchData, rows, byType]);

  return { subCategoriesForType, addSubCategory, isLoading, refresh: fetchData };
}
