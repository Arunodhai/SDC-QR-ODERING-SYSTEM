import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { LogIn, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { loginWorkspace, registerWorkspace } from '../lib/workspaceAuth';

type Mode = 'register' | 'login';

export default function SetupPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('register');
  const [saving, setSaving] = useState(false);

  const [restaurantName, setRestaurantName] = useState('');
  const [outletName, setOutletName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [kitchenUsername, setKitchenUsername] = useState('');
  const [kitchenPassword, setKitchenPassword] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await registerWorkspace({
        restaurantName,
        outletName,
        ownerEmail,
        ownerPassword,
        adminUsername,
        adminPassword,
        kitchenUsername,
        kitchenPassword,
      });
      toast.success('Workspace created successfully');
      navigate('/access');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setSaving(false);
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await loginWorkspace(loginEmail, loginPassword);
      toast.success('Workspace login successful');
      navigate('/access');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto w-full max-w-[980px] px-6 py-12 md:px-10 md:py-16">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-rose-500">Setup</p>
          <h1 className="mt-2 text-4xl leading-[1.02] text-slate-900 md:text-6xl" style={{ fontFamily: "'Playfair Display', serif" }}>
            Workspace Setup
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
            New restaurant owners can register their workspace. Existing owners can log in and continue directly to Admin/Kitchen access selection.
          </p>
          <div className="mt-8 border-t border-slate-200/80" />

          <div className="mt-8 flex">
            <div className="grid w-full max-w-[420px] grid-cols-2 rounded-full border border-slate-200 p-1">
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition ${
                  mode === 'register' ? 'bg-slate-900 text-white' : 'text-slate-700'
                }`}
              >
                <UserPlus className="h-4 w-4" />
                Register
              </button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition ${
                  mode === 'login' ? 'bg-slate-900 text-white' : 'text-slate-700'
                }`}
              >
                <LogIn className="h-4 w-4" />
                Login
              </button>
            </div>
          </div>

          {mode === 'register' ? (
            <form onSubmit={handleRegister} className="mt-8 grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Restaurant / Cafe name</span>
                <Input
                  value={restaurantName}
                  onChange={(event) => setRestaurantName(event.target.value)}
                  required
                  placeholder="Stories de Cafe"
                  className="h-11 rounded-2xl border-slate-200 bg-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Outlet / Branch</span>
                <Input
                  value={outletName}
                  onChange={(event) => setOutletName(event.target.value)}
                  required
                  placeholder="Downtown Branch"
                  className="h-11 rounded-2xl border-slate-200 bg-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Owner email (login id)</span>
                <Input
                  type="email"
                  value={ownerEmail}
                  onChange={(event) => setOwnerEmail(event.target.value)}
                  required
                  placeholder="owner@brand.com"
                  className="h-11 rounded-2xl border-slate-200 bg-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Owner password</span>
                <Input
                  type="password"
                  value={ownerPassword}
                  onChange={(event) => setOwnerPassword(event.target.value)}
                  required
                  placeholder="Minimum 6 characters"
                  className="h-11 rounded-2xl border-slate-200 bg-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Admin username</span>
                <Input
                  value={adminUsername}
                  onChange={(event) => setAdminUsername(event.target.value)}
                  required
                  placeholder="admin_main"
                  className="h-11 rounded-2xl border-slate-200 bg-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Admin password</span>
                <Input
                  type="password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  required
                  placeholder="Minimum 6 characters"
                  className="h-11 rounded-2xl border-slate-200 bg-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Kitchen manager username</span>
                <Input
                  value={kitchenUsername}
                  onChange={(event) => setKitchenUsername(event.target.value)}
                  required
                  placeholder="kitchen_main"
                  className="h-11 rounded-2xl border-slate-200 bg-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Kitchen manager password</span>
                <Input
                  type="password"
                  value={kitchenPassword}
                  onChange={(event) => setKitchenPassword(event.target.value)}
                  required
                  placeholder="Minimum 6 characters"
                  className="h-11 rounded-2xl border-slate-200 bg-white"
                />
              </label>

              <div className="mt-2 md:col-span-2">
                <Button
                  type="submit"
                  disabled={saving}
                  className="h-12 w-full rounded-full bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 md:w-auto md:px-10"
                >
                  {saving ? 'Creating workspace...' : 'Create Workspace'}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="mt-8 grid max-w-xl gap-5">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Owner email</span>
                <Input
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  required
                  placeholder="owner@brand.com"
                  className="h-11 rounded-2xl border-slate-200 bg-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Owner password</span>
                <Input
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  required
                  placeholder="Enter workspace password"
                  className="h-11 rounded-2xl border-slate-200 bg-white"
                />
              </label>

              <div className="mt-2">
                <Button
                  type="submit"
                  disabled={saving}
                  className="h-12 w-full rounded-full bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 md:w-auto md:px-10"
                >
                  {saving ? 'Signing in...' : 'Login to Workspace'}
                </Button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
