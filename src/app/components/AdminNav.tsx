import { LayoutGrid, Table2, Receipt, LogOut, ChefHat, BarChart3, ChevronRight, ChevronLeft } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router';
import { Button } from './ui/button';
import * as api from '../lib/api';
import logo12 from '../../assets/logo12.png';

type AdminNavProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
};

export default function AdminNav({ collapsed, onToggleCollapse }: AdminNavProps) {
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
      <aside
        className={`group relative hidden h-full shrink-0 overflow-hidden lg:sticky lg:top-0 lg:flex lg:flex-col lg:justify-between lg:border lg:border-slate-200/80 lg:bg-[linear-gradient(180deg,rgba(233,242,238,0.72),rgba(241,247,245,0.56))] lg:transition-[width,padding] lg:duration-200 ${
          collapsed ? 'lg:w-[88px] lg:p-3' : 'lg:w-[280px] lg:p-5'
        } rounded-[8px]`}
      >
        <div>
          <div className={`mb-6 flex items-center ${collapsed ? 'justify-center' : 'justify-start'} px-1`}>
            <img src={logo12} alt="Stories de Café" className="h-9 w-9 object-contain" />
          </div>

          {!collapsed && (
            <div className="mb-6 px-1">
              <p className="brand-display text-xl font-bold leading-tight text-slate-900">Stories de Café</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Admin Console</p>
            </div>
          )}

          {!collapsed && <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Main Menu</p>}
          <nav className="space-y-1.5">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} className="block">
                  <span
                    className={`flex items-center rounded-[8px] px-3 py-2.5 text-sm font-medium transition ${
                      collapsed ? 'justify-center' : 'gap-3'
                    } ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-[0_10px_20px_rgba(15,23,42,0.12)]'
                        : 'text-slate-700 hover:bg-white/70'
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] ${isActive ? 'text-slate-900' : 'text-slate-500'}`} />
                    {!collapsed && <span>{item.label}</span>}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-6 space-y-2">
          {!collapsed && <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Account</p>}
          <div className={`rounded-[8px] border border-white/70 bg-white/55 p-3 backdrop-blur ${collapsed ? 'px-2' : ''}`}>
            {!collapsed && (
              <div className="mb-2 flex items-center gap-2">
                <img src={logo12} alt="Admin avatar" className="h-8 w-8 rounded-full border border-slate-200 bg-white object-contain p-0.5" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">Admin</p>
                  <p className="truncate text-xs text-slate-500">storiesdecafe.com</p>
                </div>
              </div>
            )}
            <Button
              variant="outline"
              className={`w-full rounded-[8px] border-slate-200 bg-white/90 ${collapsed ? 'justify-center px-0' : 'justify-start'}`}
              onClick={handleLogout}
            >
              <LogOut className={`${collapsed ? '' : 'mr-2'} h-4 w-4`} />
              {!collapsed && 'Logout'}
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="absolute -right-3 top-1/2 z-20 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-[0_8px_16px_rgba(15,23,42,0.18)] opacity-0 transition group-hover:opacity-100 lg:inline-flex"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 px-4 py-3 backdrop-blur-xl lg:hidden">
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
