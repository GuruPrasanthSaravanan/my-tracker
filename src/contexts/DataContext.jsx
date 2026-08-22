import { createContext, useContext, useEffect, useRef } from 'react';
import { useAuth } from '../auth/useAuth';
import { ensureTabsExist } from '../api/sheets';
import { SHEET_SCHEMAS } from '../api/sheetSchemas';
import { useCashBook } from '../hooks/useCashBook';
import { useVendors } from '../hooks/useVendors';
import { useProjects } from '../hooks/useProjects';
import { useEMILoans } from '../hooks/useEMILoans';
import { useHandLoans } from '../hooks/useHandLoans';
import { useCreditCards } from '../hooks/useCreditCards';
import { useLists } from '../hooks/useLists';
import { useAccountSettings } from '../hooks/useAccountSettings';
import { useMonthly } from '../hooks/useMonthly';
import { useNetWorth } from '../hooks/useNetWorth';
import { useAccountTypeFavorites } from '../hooks/useAccountTypeFavorites';
import { useSubCategories } from '../hooks/useSubCategories';
import { useChitFunds } from '../hooks/useChitFunds';

const DataContext = createContext(null);

/**
 * Fetches CashBook/Vendors/Projects/EMILoans/HandLoans/Lists data ONCE per
 * signed-in session (mounted at the Layout level, above the tab routes)
 * instead of each page independently re-fetching on every navigation. This
 * avoids duplicate Sheets API calls - e.g. previously ProjectsPage had its
 * own separate useVendors() instance purely to read vendor rows for cost
 * breakdown, doubling Vendors tab reads.
 *
 * Every add/edit/delete still refreshes its own slice immediately via each
 * hook's existing fetchData/refresh, so data stays current after any write
 * made from the app.
 */
export function DataProvider({ children }) {
  const { token } = useAuth();
  const cashBook = useCashBook();
  const vendors = useVendors();
  const projects = useProjects();
  const emiLoans = useEMILoans();
  const handLoans = useHandLoans();
  const creditCards = useCreditCards();
  const lists = useLists();
  const accountSettings = useAccountSettings();
  const monthly = useMonthly();
  const netWorth = useNetWorth();
  const accountTypeFavorites = useAccountTypeFavorites();
  const subCategories = useSubCategories();
  const chitFunds = useChitFunds();

  // Auto-provision any tab this app needs that doesn't exist yet (e.g. a brand
  // new tab introduced in this release, like MonthlyPlans/NetWorthSnapshots) -
  // the user should never have to manually create a tab in the Sheets UI.
  // Runs once per sign-in; refreshes the two newest hooks afterward in case
  // their tab didn't exist yet on their very first fetch this session.
  const provisioned = useRef(false);
  useEffect(() => {
    if (!token || provisioned.current) return;
    provisioned.current = true;
    ensureTabsExist(token, SHEET_SCHEMAS)
      .then(() => {
        monthly.refresh();
        netWorth.refresh();
      })
      .catch((err) => console.error('Failed to auto-provision sheet tabs:', err));
  }, [token]);

  return (
    <DataContext.Provider value={{
      cashBook, vendors, projects, emiLoans, handLoans, creditCards, lists, accountSettings,
      monthly, netWorth, accountTypeFavorites, subCategories, chitFunds,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useAppData must be used within DataProvider');
  return ctx;
}
