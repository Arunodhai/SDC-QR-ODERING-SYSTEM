import { LayoutGrid, Table2, Receipt, LogOut, ChefHat, BarChart3 } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router';
import { Button } from './ui/button';
import * as api from '../lib/api';
import logo12 from '../../assets/logo12.png';

export default function AdminNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await api.adminSignOut();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      navigate('/admin/login');
    }
  };

  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: BarChart3 },
    { path: '/admin/menu', label: 'Menu', icon: LayoutGrid },
    { path: '/admin/tables', label: 'Tables', icon: Table2 },
    { path: '/admin/orders', label: 'Orders', icon: Receipt },
    { path: '/admin/kitchen', label: 'Kitchen', icon: ChefHat },
  ];

  return (
    <>
      <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:justify-between lg:rounded-[26px] lg:border lg:border-slate-200 lg:bg-white lg:p-4 lg:shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
        <div>
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
            <img src={logo12} alt="Stories de Café" className="h-12 w-12 object-contain" />
            <div>
              <p className="brand-display text-xl font-bold leading-tight text-slate-900">Stories de Café</p>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Admin Console</p>
            </div>
          </div>

          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Navigation</p>
          <nav className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} className="block">
                  <span
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-[0_8px_18px_rgba(15,23,42,0.26)]'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
          <Button variant="outline" className="w-full justify-start rounded-xl bg-white" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <img src={logo12} alt="Stories de Café" className="h-9 w-9 object-contain" />
            <p className="brand-display text-lg font-bold text-slate-900">Stories de Café Admin</p>
          </div>
          <Button variant="outline" size="sm" className="rounded-lg bg-white" onClick={handleLogout}>
            <LogOut className="mr-1 h-4 w-4" />
            Logout
          </Button>
        </div>
        <nav className="mt-3 grid grid-cols-5 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <span
                  className={`flex items-center justify-center rounded-lg px-1 py-2 text-xs font-medium ${
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-700'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
