import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import * as api from '../lib/api';

export default function AdminSettingsPage() {
  const navigate = useNavigate();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [savingKitchen, setSavingKitchen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [restaurantName, setRestaurantName] = useState('');
  const [outletName, setOutletName] = useState('');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [kitchenUsername, setKitchenUsername] = useState('');
  const [workspaceLogo, setWorkspaceLogo] = useState('');

  const [currentAdminUsername, setCurrentAdminUsername] = useState('');
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');
  const [nextAdminUsername, setNextAdminUsername] = useState('');
  const [nextAdminPassword, setNextAdminPassword] = useState('');
  const [currentKitchenUsername, setCurrentKitchenUsername] = useState('');
  const [currentKitchenPassword, setCurrentKitchenPassword] = useState('');
  const [nextKitchenUsername, setNextKitchenUsername] = useState('');
  const [nextKitchenPassword, setNextKitchenPassword] = useState('');

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
        setRestaurantName(workspace.restaurantName);
        setOutletName(workspace.outletName);
        setCurrencyCode(workspace.currencyCode || 'USD');
        setOwnerEmail(workspace.ownerEmail || '');
        setAdminUsername(workspace.adminUsername || '');
        setKitchenUsername(workspace.kitchenUsername || '');
        setCurrentAdminUsername(workspace.adminUsername || '');
        setCurrentKitchenUsername(workspace.kitchenUsername || '');
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

  const handleSaveWorkspace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const { workspace } = await api.updateWorkspaceSettings({
        restaurantName,
        outletName,
        currencyCode,
        logoUrl: workspaceLogo || '',
      });
      setRestaurantName(workspace.restaurantName);
      setOutletName(workspace.outletName);
      setCurrencyCode(workspace.currencyCode || 'USD');
      setOwnerEmail(workspace.ownerEmail || '');
      setAdminUsername(workspace.adminUsername || '');
      setKitchenUsername(workspace.kitchenUsername || '');
      setCurrentAdminUsername(workspace.adminUsername || '');
      setCurrentKitchenUsername(workspace.kitchenUsername || '');
      setWorkspaceLogo(workspace.logoUrl || '');
      toast.success('Workspace settings updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save workspace settings');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveKitchenCredentials = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nextKitchenUsername.trim() && !nextKitchenPassword.trim()) {
      toast.error('Enter new kitchen username or password');
      return;
    }
    setSavingKitchen(true);
    try {
      let activeUsername = currentKitchenUsername;
      if (nextKitchenUsername.trim()) {
        const result = await api.changeKitchenUsername(
          currentKitchenUsername,
          currentKitchenPassword,
          nextKitchenUsername.trim(),
        );
        activeUsername = result.username || nextKitchenUsername.trim();
      }
      if (nextKitchenPassword.trim()) {
        await api.changeKitchenPassword(activeUsername, currentKitchenPassword, nextKitchenPassword.trim());
      }
      setKitchenUsername(activeUsername);
      setCurrentKitchenUsername(activeUsername);
      setCurrentKitchenPassword('');
      setNextKitchenUsername('');
      setNextKitchenPassword('');
      toast.success('Kitchen credentials updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update kitchen credentials');
    } finally {
      setSavingKitchen(false);
    }
  };

  const handleLogoPick = () => {
    logoInputRef.current?.click();
  };

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

  const handleSaveAdminCredentials = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nextAdminUsername.trim() && !nextAdminPassword.trim()) {
      toast.error('Enter new admin username or password');
      return;
    }
    setSavingAdmin(true);
    try {
      const result = await api.updateAdminCredentials({
        currentUsername: currentAdminUsername,
        currentPassword: currentAdminPassword,
        nextUsername: nextAdminUsername.trim() || undefined,
        nextPassword: nextAdminPassword.trim() || undefined,
      });
      setAdminUsername(result.username || adminUsername);
      setCurrentAdminUsername(result.username || currentAdminUsername);
      setCurrentAdminPassword('');
      setNextAdminUsername('');
      setNextAdminPassword('');
      toast.success('Admin credentials updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update admin credentials');
    } finally {
      setSavingAdmin(false);
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
          currencyCode,
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
    <div className="page-shell">
      <div className="mx-auto max-w-6xl px-4 py-5">
        <Card className="sdc-header-card mb-5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Settings</p>
          <h2 className="text-4xl font-semibold tracking-tight text-slate-900">Workspace Settings</h2>
        </Card>

        {loading ? (
          <Card className="sdc-panel-card p-8 text-center text-slate-600">Loading settings...</Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="sdc-panel-card p-4">
              <h3 className="mb-3 text-lg font-semibold text-slate-900">Workspace Profile</h3>
              <form onSubmit={handleSaveWorkspace} className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Restaurant / Cafe name</Label>
                  <Input value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} required className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Outlet / Branch</Label>
                  <Input value={outletName} onChange={(e) => setOutletName(e.target.value)} required className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Workspace Logo</Label>
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-2 py-1.5">
                    <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    <button type="button" onClick={handleLogoPick} className="h-8 rounded-full bg-slate-900 px-4 text-sm font-semibold text-white">
                      Choose file
                    </button>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{workspaceLogo ? 'Logo uploaded' : 'No logo selected'}</span>
                    {workspaceLogo ? <img src={workspaceLogo} alt="Workspace logo" className="h-9 w-9 rounded-lg border border-slate-200 object-cover" /> : null}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Currency Code</Label>
                  <Input value={currencyCode} onChange={(e) => setCurrencyCode(String(e.target.value || '').toUpperCase())} maxLength={3} className="h-11" />
                </div>
                <Button type="submit" disabled={savingProfile} className="h-11 w-full">
                  {savingProfile ? 'Saving...' : 'Save Workspace'}
                </Button>
              </form>
            </Card>

            <Card className="sdc-panel-card p-4">
              <h3 className="mb-3 text-lg font-semibold text-slate-900">Access & Security</h3>
              <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                <p><span className="font-semibold">Owner Email:</span> {ownerEmail || '-'}</p>
                <p><span className="font-semibold">Current Admin Username:</span> {adminUsername || '-'}</p>
                <p><span className="font-semibold">Current Kitchen Username:</span> {kitchenUsername || '-'}</p>
              </div>
              <form onSubmit={handleSaveAdminCredentials} className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Current Admin Username</Label>
                  <Input value={currentAdminUsername} onChange={(e) => setCurrentAdminUsername(e.target.value)} required className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Current Admin Password</Label>
                  <Input type="password" value={currentAdminPassword} onChange={(e) => setCurrentAdminPassword(e.target.value)} required className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">New Admin Username (optional)</Label>
                  <Input value={nextAdminUsername} onChange={(e) => setNextAdminUsername(e.target.value)} placeholder="Enter new username" className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">New Admin Password (optional)</Label>
                  <Input type="password" value={nextAdminPassword} onChange={(e) => setNextAdminPassword(e.target.value)} placeholder="Enter new password" className="h-11" />
                </div>
                <Button type="submit" disabled={savingAdmin} className="h-11 w-full">
                  {savingAdmin ? 'Updating...' : 'Update Admin Credentials'}
                </Button>
              </form>
            </Card>

            <Card className="sdc-panel-card p-4">
              <h3 className="mb-3 text-lg font-semibold text-slate-900">Kitchen Credentials</h3>
              <form onSubmit={handleSaveKitchenCredentials} className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Current Kitchen Username</Label>
                  <Input value={currentKitchenUsername} onChange={(e) => setCurrentKitchenUsername(e.target.value)} required className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Current Kitchen Password</Label>
                  <Input type="password" value={currentKitchenPassword} onChange={(e) => setCurrentKitchenPassword(e.target.value)} required className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">New Kitchen Username (optional)</Label>
                  <Input value={nextKitchenUsername} onChange={(e) => setNextKitchenUsername(e.target.value)} placeholder="Enter new username" className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">New Kitchen Password (optional)</Label>
                  <Input type="password" value={nextKitchenPassword} onChange={(e) => setNextKitchenPassword(e.target.value)} placeholder="Enter new password" className="h-11" />
                </div>
                <Button type="submit" disabled={savingKitchen} className="h-11 w-full">
                  {savingKitchen ? 'Updating...' : 'Update Kitchen Credentials'}
                </Button>
              </form>
            </Card>

            <Card className="sdc-panel-card p-4 lg:col-span-2">
              <h3 className="mb-3 text-lg font-semibold text-slate-900">Data Controls</h3>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" className="h-10" onClick={handleExportData} disabled={exporting}>
                  {exporting ? 'Exporting...' : 'Export Workspace Data'}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
