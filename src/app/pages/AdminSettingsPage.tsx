import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowUpRight, Building2, ChefHat, CircleCheck, Database, Globe2, Lock, Store } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import * as api from '../lib/api';

type CurrencyOption = { code: string; label: string; symbol: string };
type AccessRole = 'admin' | 'kitchen';

const CURRENCIES: CurrencyOption[] = [
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { code: 'AED', label: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SAR', label: 'Saudi Riyal', symbol: '﷼' },
  { code: 'QAR', label: 'Qatari Riyal', symbol: '﷼' },
  { code: 'OMR', label: 'Omani Rial', symbol: '﷼' },
  { code: 'KWD', label: 'Kuwaiti Dinar', symbol: 'د.ك' },
];

export default function AdminSettingsPage() {
  const navigate = useNavigate();
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [restaurantName, setRestaurantName] = useState('');
  const [outletName, setOutletName] = useState('');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [timezone, setTimezone] = useState('UTC');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [kitchenUsername, setKitchenUsername] = useState('');
  const [workspaceLogo, setWorkspaceLogo] = useState('');

  const [activeAccessDialog, setActiveAccessDialog] = useState<AccessRole | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [changeUsername, setChangeUsername] = useState(false);
  const [changePassword, setChangePassword] = useState(false);
  const [nextUsername, setNextUsername] = useState('');
  const [nextPassword, setNextPassword] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const session = await api.getAdminSession();
        if (!session) {
          navigate('/admin/login');
          return;
        }

        const { workspace } = await api.getWorkspaceSettings();
        if (!mounted) return;

        setRestaurantName(workspace.restaurantName || '');
        setOutletName(workspace.outletName || '');
        setCurrencyCode(workspace.currencyCode || 'USD');
        setTimezone(workspace.timezone || 'UTC');
        setOwnerEmail(workspace.ownerEmail || '');
        setAdminUsername(workspace.adminUsername || '');
        setKitchenUsername(workspace.kitchenUsername || '');
        setWorkspaceLogo(workspace.logoUrl || '');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load settings');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const selectedCurrency = CURRENCIES.find((item) => item.code === currencyCode) || CURRENCIES[0];

  const resetAccessForm = () => {
    setCurrentPassword('');
    setChangeUsername(false);
    setChangePassword(false);
    setNextUsername('');
    setNextPassword('');
  };

  const openAccessDialog = (role: AccessRole) => {
    resetAccessForm();
    setActiveAccessDialog(role);
  };

  const closeAccessDialog = () => {
    setActiveAccessDialog(null);
    resetAccessForm();
  };

  const handleSaveWorkspace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingWorkspace(true);
    try {
      const { workspace } = await api.updateWorkspaceSettings({
        restaurantName,
        outletName,
        currencyCode,
        logoUrl: workspaceLogo || '',
      });

      setRestaurantName(workspace.restaurantName || '');
      setOutletName(workspace.outletName || '');
      setCurrencyCode(workspace.currencyCode || 'USD');
      setTimezone(workspace.timezone || 'UTC');
      setOwnerEmail(workspace.ownerEmail || '');
      setAdminUsername(workspace.adminUsername || '');
      setWorkspaceLogo(workspace.logoUrl || '');
      toast.success('Workspace settings saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save workspace settings');
    } finally {
      setSavingWorkspace(false);
    }
  };

  const handleLogoPick = () => logoInputRef.current?.click();

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const { url } = await api.uploadWorkspaceLogo(file);
      setWorkspaceLogo(url);
      toast.success('Logo uploaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload logo');
    } finally {
      event.target.value = '';
    }
  };

  const handleSaveAccess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeAccessDialog) return;
    if (!changeUsername && !changePassword) {
      toast.error('Select what you want to change first');
      return;
    }
    if (changeUsername && !nextUsername.trim()) {
      toast.error('Enter new username');
      return;
    }
    if (changePassword && !nextPassword.trim()) {
      toast.error('Enter new password');
      return;
    }

    setSavingAccess(true);
    try {
      if (activeAccessDialog === 'admin') {
        const result = await api.updateAdminCredentials({
          currentUsername: adminUsername,
          currentPassword,
          nextUsername: changeUsername ? nextUsername.trim() : undefined,
          nextPassword: changePassword ? nextPassword.trim() : undefined,
        });

        if (changeUsername) {
          setAdminUsername(result.username || nextUsername.trim());
        }
      } else {
        let activeKitchenUsername = kitchenUsername;

        if (changeUsername) {
          const renameResult = await api.changeKitchenUsername(kitchenUsername, currentPassword, nextUsername.trim());
          activeKitchenUsername = renameResult.username || nextUsername.trim();
          setKitchenUsername(activeKitchenUsername);
        }

        if (changePassword) {
          await api.changeKitchenPassword(activeKitchenUsername, currentPassword, nextPassword.trim());
        }
      }

      toast.success('Credentials updated');
      closeAccessDialog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update credentials');
    } finally {
      setSavingAccess(false);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const [categoriesRes, itemsRes, tablesRes, ordersRes] = await Promise.all([
        api.getCategories(),
        api.getMenuItems(),
        api.getTables(),
        api.getOrders(),
      ]);

      const payload = {
        exportedAt: new Date().toISOString(),
        workspace: {
          restaurantName,
          outletName,
          ownerEmail,
          adminUsername,
          kitchenUsername,
          currencyCode,
          timezone,
        },
        categories: categoriesRes.categories || [],
        menuItems: itemsRes.items || [],
        tables: tablesRes.tables || [],
        orders: ordersRes.orders || [],
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `workspace-export-${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);

      toast.success('Workspace data exported');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export workspace data');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page-shell bg-transparent">
      <div className="mx-auto max-w-6xl px-4 py-5">
        <div className="mb-6 border-b border-slate-200 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Settings</p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight text-slate-900">Workspace Settings</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Manage workspace identity, access, currency, and operational controls from one place.</p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">Loading settings...</div>
        ) : (
          <div className="space-y-5">
            <form onSubmit={handleSaveWorkspace} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Store className="h-4 w-4 text-slate-500" />
                <h2 className="text-base font-semibold text-slate-900">Workspace Identity</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Restaurant / Cafe name</Label>
                  <Input value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} required className="h-11" />
                </label>
                <label className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Outlet / Branch</Label>
                  <Input value={outletName} onChange={(e) => setOutletName(e.target.value)} required className="h-11" />
                </label>

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Workspace logo</Label>
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-2 py-1.5">
                    <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    <button type="button" onClick={handleLogoPick} className="h-8 rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:border-slate-400">
                      Upload logo
                    </button>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-500">{workspaceLogo ? 'Logo uploaded' : 'No logo uploaded'}</span>
                    {workspaceLogo ? <img src={workspaceLogo} alt="Workspace logo" className="h-9 w-9 rounded-lg border border-slate-200 object-cover" /> : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Currency</Label>
                  <Select value={currencyCode} onValueChange={setCurrencyCode}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.symbol} {currency.code} - {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Timezone</Label>
                  <Input value={timezone} disabled className="h-11 bg-slate-50 text-slate-500" />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
                <Button type="submit" disabled={savingWorkspace} className="h-10 px-6">
                  {savingWorkspace ? 'Saving...' : 'Save changes'}
                </Button>
                <span className="text-xs text-slate-500">
                  Active billing currency: <span className="font-semibold text-slate-700">{selectedCurrency.symbol} {selectedCurrency.code}</span>
                </span>
              </div>
            </form>

            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-slate-500" />
                  <h2 className="text-base font-semibold text-slate-900">Access & Security</h2>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Owner account</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{ownerEmail || '-'}</p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Admin access</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{adminUsername || '-'}</p>
                      </div>
                      <Button variant="outline" className="h-9" onClick={() => openAccessDialog('admin')}>
                        Change
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Kitchen access</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{kitchenUsername || '-'}</p>
                      </div>
                      <Button variant="outline" className="h-9" onClick={() => openAccessDialog('kitchen')}>
                        Change
                      </Button>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-500" />
                  <h2 className="text-base font-semibold text-slate-900">Product Controls</h2>
                </div>

                <div className="grid gap-2">
                  <button type="button" onClick={() => navigate('/admin/menu')} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50">
                    Menu & Categories <ArrowUpRight className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => navigate('/admin/tables')} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50">
                    Table QR Management <ArrowUpRight className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => navigate('/admin/orders')} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50">
                    Orders & Billing <ArrowUpRight className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => navigate('/admin/kitchen')} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50">
                    Kitchen Queue <ArrowUpRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Live Configuration</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-700"><CircleCheck className="h-4 w-4 text-emerald-600" /> Role routing</div>
                    <div className="flex items-center gap-2 text-slate-700"><CircleCheck className="h-4 w-4 text-emerald-600" /> Currency localized</div>
                    <div className="flex items-center gap-2 text-slate-700"><CircleCheck className="h-4 w-4 text-emerald-600" /> Kitchen sync</div>
                    <div className="flex items-center gap-2 text-slate-700"><CircleCheck className="h-4 w-4 text-emerald-600" /> Workspace isolation</div>
                  </div>
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <Database className="h-4 w-4 text-slate-500" />
                <h2 className="text-base font-semibold text-slate-900">Data & Backup</h2>
              </div>
              <p className="mb-3 text-sm text-slate-600">Export a full JSON backup of categories, items, tables, and orders for this workspace.</p>
              <Button variant="outline" className="h-10" onClick={handleExportData} disabled={exporting}>
                {exporting ? 'Exporting...' : 'Export workspace data'}
              </Button>
            </section>
          </div>
        )}
      </div>

      <Dialog
        open={activeAccessDialog !== null}
        onOpenChange={(open) => {
          if (!open) closeAccessDialog();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{activeAccessDialog === 'admin' ? 'Change Admin Access' : 'Change Kitchen Access'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveAccess} className="space-y-4">
            <p className="text-sm text-slate-600">For security, updates are applied only after password verification.</p>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Current password</Label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="h-11" />
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="change-username" className="text-sm font-medium text-slate-800">Change username</Label>
                <input
                  id="change-username"
                  type="checkbox"
                  checked={changeUsername}
                  onChange={(e) => setChangeUsername(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
              </div>
              {changeUsername ? (
                <div className="mt-3 space-y-2">
                  <Label className="text-sm font-medium text-slate-700">New username</Label>
                  <Input value={nextUsername} onChange={(e) => setNextUsername(e.target.value)} placeholder="Enter new username" className="h-10" />
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="change-password" className="text-sm font-medium text-slate-800">Change password</Label>
                <input
                  id="change-password"
                  type="checkbox"
                  checked={changePassword}
                  onChange={(e) => setChangePassword(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
              </div>
              {changePassword ? (
                <div className="mt-3 space-y-2">
                  <Label className="text-sm font-medium text-slate-700">New password</Label>
                  <Input type="password" value={nextPassword} onChange={(e) => setNextPassword(e.target.value)} placeholder="Enter new password" className="h-10" />
                </div>
              ) : null}
            </div>

            <Button type="submit" disabled={savingAccess} className="h-11 w-full">
              {savingAccess ? 'Updating...' : 'Save access changes'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
