import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRowAt, clearRow, batchUpdateRows } from '../api/sheets';

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

  /**
   * Removes a sub-category from the dropdown for a given Type (finds the
   * matching [Type, SubCategory] row and clears it). Same trade-off as
   * `removeFromList` elsewhere (api/lists.js) - past CashBook entries that
   * already used this sub-category are left untouched, only the dropdown
   * option disappears going forward.
   */
  const deleteSubCategory = useCallback(async (type, subCategory) => {
    const rowIndex = rows.findIndex((r) => (r[0] || '') === type && (r[1] || '') === subCategory);
    if (rowIndex === -1) return false;
    const sheetRow = rowIndex + 2;
    await clearRow(token, `SubCategories!A${sheetRow}:B${sheetRow}`);
    await fetchData();
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, fetchData, rows]);

  /**
   * Renames a sub-category, cascading into every past CashBook entry that
   * used it under this same Type (col D = Type, col H = SubCategory) so
   * the Monthly page's sub-category spend breakdown doesn't silently split
   * old and new entries into two buckets - same reasoning as
   * `renameListValue` in api/lists.js. Matches on (Type, SubCategory)
   * together, not SubCategory alone, since the same sub-category name could
   * exist under a different Type (e.g. "Medical" under both WANTS and
   * FAMILY) and shouldn't be renamed there too.
   */
  const renameSubCategory = useCallback(async (type, oldValue, newValue) => {
    const trimmedNew = newValue.trim();
    if (!trimmedNew || trimmedNew === oldValue) return { renamed: false, cellsUpdated: 0 };

    const rowIndex = rows.findIndex((r) => (r[0] || '') === type && (r[1] || '') === oldValue);
    if (rowIndex === -1) return { renamed: false, cellsUpdated: 0 };

    const updates = [{ range: `SubCategories!B${rowIndex + 2}`, values: [trimmedNew] }];

    const cashBookRows = await readSheet(token, 'CashBook!A2:H5000');
    cashBookRows.forEach((row, index) => {
      if ((row[3] || '') === type && (row[7] || '') === oldValue) {
        updates.push({ range: `CashBook!H${index + 2}`, values: [trimmedNew] });
      }
    });

    await batchUpdateRows(token, updates);
    await fetchData();
    return { renamed: true, cellsUpdated: updates.length - 1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, fetchData, rows]);

  return { subCategoriesForType, addSubCategory, deleteSubCategory, renameSubCategory, isLoading, refresh: fetchData, rows };
}
