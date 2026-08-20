import { NavLink } from 'react-router-dom';
import { BookOpen, Users, LayoutDashboard, MoreHorizontal } from 'lucide-react';

const tabs = [
  { to: '/cashbook', icon: BookOpen, label: 'CashBook' },
  { to: '/vendors', icon: Users, label: 'Vendors' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/more', icon: MoreHorizontal, label: 'More' },
];

export default function BottomNav() {
  return (
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
    </nav>
  );
}
