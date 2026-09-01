import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Users, FolderKanban, CreditCard, LayoutDashboard, Menu, X, CalendarRange, TrendingUp, Settings, LineChart } from 'lucide-react';

const tabs = [
  { to: '/cashbook', icon: BookOpen, label: 'CashBook' },
  { to: '/vendors', icon: Users, label: 'Vendors' },
  { to: '/monthly', icon: CalendarRange, label: 'Monthly' },
  { to: '/obligations', icon: CreditCard, label: 'Obligations' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
];

const moreLinks = [
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/projections', icon: LineChart, label: 'Projections' },
  { to: '/networth', icon: TrendingUp, label: 'Net Worth' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function BottomNav() {
  const [showMore, setShowMore] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isMoreActive = moreLinks.some((l) => location.pathname.startsWith(l.to));

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 text-xs transition ${isActive ? 'text-primary font-semibold' : 'text-gray-400'}`
            }
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setShowMore(true)}
          className={`flex flex-col items-center gap-0.5 text-xs transition ${isMoreActive ? 'text-primary font-semibold' : 'text-gray-400'}`}
        >
          <Menu size={20} />
          <span>More</span>
        </button>
      </nav>

      {showMore && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={() => setShowMore(false)}>
          <div className="bg-white w-full rounded-t-2xl p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">More</h2>
              <button onClick={() => setShowMore(false)} className="p-1"><X size={20} /></button>
            </div>
            <div className="space-y-2">
              {moreLinks.map(({ to, icon: Icon, label }) => (
                <button
                  key={to}
                  onClick={() => { navigate(to); setShowMore(false); }}
                  className="w-full flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 active:bg-gray-100"
                >
                  <Icon size={18} className="text-primary" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
