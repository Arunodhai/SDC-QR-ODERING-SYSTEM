import { useEffect, useRef, useState } from 'react';
import { LayoutGrid, Table2, Receipt, LogOut, ChefHat, BarChart3, ChevronRight, ChevronLeft, User } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router';
import { Button } from './ui/button';
import * as api from '../lib/api';
import logo12 from '../../assets/logo12.png';
import { toast } from 'sonner';

type AdminNavProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
};

export default function AdminNav({ collapsed, onToggleCollapse }: AdminNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showCollapsedAccount, setShowCollapsedAccount] = useState(false);
  const [showExpandedAccount, setShowExpandedAccount] = useState(false);
  const [adminAvatar, setAdminAvatar] = useState<string>('');
  const [avatarLoading, setAvatarLoading] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadAvatar = async () => {
      try {
        const { profile } = await api.getAdminProfile();
        if (!cancelled) {
          setAdminAvatar(profile.avatarUrl || '');
        }
      } catch (error) {
        console.error('Failed to load admin profile avatar:', error);
      }
    };
    loadAvatar();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!accountRef.current) return;
      if (accountRef.current.contains(event.target as Node)) return;
      setShowCollapsedAccount(false);
      setShowExpandedAccount(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handlePickAvatar = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (avatarLoading) return;
    setAvatarLoading(true);
    try {
      const { profile } = await api.saveAdminAvatar(file);
      setAdminAvatar(profile.avatarUrl || '');
      toast.success('Admin image updated');
    } catch (error) {
      console.error('Failed to save admin avatar:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save admin image');
    } finally {
      setAvatarLoading(false);
    }
    event.target.value = '';
  };

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
        className={`group relative z-30 hidden h-full shrink-0 overflow-visible lg:sticky lg:top-0 lg:flex lg:flex-col lg:justify-between lg:transition-[width,padding] lg:duration-200 ${
          collapsed ? 'lg:w-[68px] lg:p-2' : 'lg:w-[222px] lg:p-4'
        }`}
      >
        <div>
          <div className={`mb-6 ${collapsed ? 'px-0' : 'px-1'}`}>
            <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-start gap-2.5'}`}>
              <img
                src={logo12}
                alt="Stories de Café"
                className={`${collapsed ? 'h-13 w-13' : 'h-13 w-13'} object-contain`}
              />
              {!collapsed && (
                <div>
                  <p className="brand-display whitespace-nowrap text-[1.15rem] font-bold leading-none text-slate-900">Stories de Café</p>
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Admin Console</p>
                </div>
              )}
            </div>
          </div>

          {!collapsed && (
            <div className="mb-1">
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Main Menu</p>
            </div>
          )}
          <nav className="space-y-1.5">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} className="block">
                  <span
                    className={`flex rounded-[8px] px-3 py-2.5 text-sm font-medium transition ${
                      collapsed ? 'flex-col items-center justify-center gap-1.5 px-1 py-2' : 'items-center gap-3'
                    } ${
                      collapsed
                        ? isActive
                          ? 'text-slate-900'
                          : 'text-slate-700 hover:bg-white/60'
                        : isActive
                          ? 'bg-transparent text-slate-950 font-semibold text-[1.06rem]'
                          : 'text-slate-700 hover:bg-white/70'
                    }`}
                  >
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                        collapsed && isActive
                          ? 'bg-slate-900 text-white shadow-[0_8px_14px_rgba(15,23,42,0.2)]'
                          : isActive
                            ? 'bg-slate-900 text-white shadow-[0_8px_14px_rgba(15,23,42,0.18)]'
                          : ''
                      }`}
                    >
                      <Icon className={`h-[18px] w-[18px] ${isActive ? 'text-current' : 'text-slate-500'}`} />
                    </span>
                    {collapsed ? <span className="text-[10px] font-medium leading-none">{item.label}</span> : <span>{item.label}</span>}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div ref={accountRef} className="mt-6 space-y-2">
          {!collapsed ? (
            <>
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Account</p>
              <div className="relative px-2">
                <button
                  type="button"
                  onClick={() => setShowExpandedAccount((s) => !s)}
                  className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-white/45"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white">
                    {adminAvatar ? (
                      <img src={adminAvatar} alt="Admin avatar" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <User className="h-4 w-4 text-black" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">Admin</p>
                    <p className="truncate text-xs text-slate-500">admin@sdc.com</p>
                  </div>
                </button>

                {showExpandedAccount && (
                  <div className="absolute bottom-11 left-2 z-[90] w-52 rounded-[8px] border border-slate-200 bg-white p-2 shadow-[0_14px_24px_rgba(15,23,42,0.18)]">
                    <Button
                      variant="outline"
                      className="mb-2 w-full justify-start rounded-[8px]"
                      onClick={handlePickAvatar}
                      disabled={avatarLoading}
                    >
                      {avatarLoading ? 'Uploading...' : 'Upload image'}
                    </Button>
                    <Button variant="outline" className="w-full justify-start rounded-[8px]" onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </Button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
            </>
          ) : (
            <div className="relative flex justify-center">
              <button
                type="button"
                onClick={() => setShowCollapsedAccount((s) => !s)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/85 text-slate-600"
                aria-label="Admin user"
              >
                {adminAvatar ? (
                  <img src={adminAvatar} alt="Admin avatar" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <User className="h-4 w-4 text-black" />
                )}
              </button>
              {showCollapsedAccount && (
                <div className="absolute bottom-0 left-[calc(100%+12px)] z-[90] w-56 rounded-[8px] border border-slate-200 bg-white p-3 shadow-[0_14px_24px_rgba(15,23,42,0.18)]">
                  <div className="mb-2 flex items-center gap-2">
                    <img src={logo12} alt="Admin avatar" className="h-8 w-8 rounded-full border border-slate-200 bg-white object-contain p-0.5" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">Admin</p>
                      <p className="truncate text-xs text-slate-500">admin@sdc.com</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="mb-2 w-full justify-start rounded-[8px]"
                    onClick={handlePickAvatar}
                    disabled={avatarLoading}
                  >
                    {avatarLoading ? 'Uploading...' : 'Upload image'}
                  </Button>
                  <Button variant="outline" className="w-full justify-start rounded-[8px]" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="peer absolute -right-3 top-0 hidden h-full w-6 lg:block" />
        <button
          type="button"
          onClick={onToggleCollapse}
          className="absolute -right-3.5 top-1/2 z-[95] hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[8px] border border-slate-300 bg-white text-slate-600 shadow-[0_8px_16px_rgba(15,23,42,0.18)] opacity-0 transition peer-hover:opacity-100 hover:opacity-100 lg:inline-flex"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
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
