import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { DataProvider } from '../contexts/DataContext';
import BottomNav from './BottomNav';
import CashBookPage from '../pages/CashBookPage';
import VendorsPage from '../pages/VendorsPage';
import ProjectsPage from '../pages/ProjectsPage';
import DebtsPage from '../pages/DebtsPage';

export default function Layout() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <h1 className="font-bold text-lg text-primary">MyTracker</h1>
        <div className="flex items-center gap-2">
          {user?.picture && <img src={user.picture} className="w-6 h-6 rounded-full" alt="" />}
          <button onClick={signOut} className="text-xs text-gray-400">Sign out</button>
        </div>
      </header>
      <main className="px-4 pt-4">
        <DataProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/cashbook" replace />} />
            <Route path="/cashbook" element={<CashBookPage />} />
            <Route path="/vendors" element={<VendorsPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/debts" element={<DebtsPage />} />
          </Routes>
        </DataProvider>
      </main>
      <BottomNav />
    </div>
  );
}
