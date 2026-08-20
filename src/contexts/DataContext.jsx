import { createContext, useContext } from 'react';
import { useCashBook } from '../hooks/useCashBook';
import { useVendors } from '../hooks/useVendors';
import { useProjects } from '../hooks/useProjects';
import { useDebts } from '../hooks/useDebts';
import { useLists } from '../hooks/useLists';

const DataContext = createContext(null);

/**
 * Fetches CashBook/Vendors/Projects/Debts/Lists data ONCE per signed-in session
 * (mounted at the Layout level, above the tab routes) instead of each page
 * independently re-fetching on every navigation. This avoids duplicate Sheets API
 * calls - e.g. previously ProjectsPage had its own separate useVendors() instance
 * purely to read vendor rows for cost breakdown, doubling Vendors tab reads.
 *
 * Every add/edit/delete still refreshes its own slice immediately via each hook's
 * existing fetchData/refresh, so data stays current after any write made from the app.
 */
export function DataProvider({ children }) {
  const cashBook = useCashBook();
  const vendors = useVendors();
  const projects = useProjects();
  const debts = useDebts();
  const lists = useLists();

  return (
    <DataContext.Provider value={{ cashBook, vendors, projects, debts, lists }}>
      {children}
    </DataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useAppData must be used within DataProvider');
  return ctx;
}
