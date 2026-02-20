import { Coffee, LayoutGrid, Table2, Receipt, LogOut, ChefHat, BarChart3 } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router';
import { Button } from './ui/button';
import * as api from '../lib/api';

export default function AdminNav({ sticky = true }: { sticky?: boolean }) {
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
    { path: '/kitchen', label: 'Kitchen', icon: ChefHat },
  ];

  return (
    <div className={`${sticky ? 'sticky top-0 z-30' : ''} border-b bg-white/95`}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-2">
            <Coffee className="w-6 h-6 text-primary" />
            <h1 className="brand-display text-xl font-bold">Stories de Café Admin</h1>
          </div>

          <div className="flex items-center gap-3">
            <nav className="flex gap-1 rounded-xl border bg-white p-1">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path}>
                    <Button
                      variant={isActive ? 'default' : 'ghost'}
                      className="gap-2 rounded-lg"
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </nav>

            <Button variant="outline" className="bg-white" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
