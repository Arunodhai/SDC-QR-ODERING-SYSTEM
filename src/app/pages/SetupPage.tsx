import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { CircleUserRound, LogIn, ShieldCheck, Store, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import gradiantBg6 from '../../assets/gradiantbg6.jpg';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
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
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(145deg, rgba(255,255,255,0.58), rgba(255,255,255,0.18)), url(${gradiantBg6})`,
        backgroundSize: '100% 100%, cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="pointer-events-none absolute -left-16 top-24 h-64 w-64 rounded-full bg-teal-100/70 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-orange-100/70 blur-3xl" />

      <main className="mx-auto grid min-h-screen w-full max-w-[1360px] gap-8 px-6 py-10 lg:grid-cols-[1fr_0.92fr]">
        <section className="glass-grid-card rounded-[30px] border-white/70 p-6 md:p-10">
          <h1 className="text-4xl leading-[1.02] text-slate-900 md:text-6xl" style={{ fontFamily: "'Playfair Display', serif" }}>
            Workspace Setup
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 md:text-base">
            New restaurant owners can register their workspace. Existing owners can log in and continue directly to Admin/Kitchen access selection.
          </p>

          <div className="mt-6 grid grid-cols-2 rounded-2xl border border-white/70 bg-white/75 p-1">
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                mode === 'register' ? 'bg-slate-900 text-white' : 'text-slate-700'
              }`}
            >
              <UserPlus className="h-4 w-4" />
              Register
            </button>
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                mode === 'login' ? 'bg-slate-900 text-white' : 'text-slate-700'
              }`}
            >
              <LogIn className="h-4 w-4" />
              Login
            </button>
          </div>

          {mode === 'register' ? (
            <form onSubmit={handleRegister} className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Restaurant / Cafe name</span>
                <Input
                  value={restaurantName}
                  onChange={(event) => setRestaurantName(event.target.value)}
                  required
                  placeholder="Stories de Cafe"
                  className="h-10 rounded-xl border-white/65 bg-white/85"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Outlet / Branch</span>
                <Input
                  value={outletName}
                  onChange={(event) => setOutletName(event.target.value)}
                  required
                  placeholder="Downtown Branch"
                  className="h-10 rounded-xl border-white/65 bg-white/85"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Owner email (login id)</span>
                <Input
                  type="email"
                  value={ownerEmail}
                  onChange={(event) => setOwnerEmail(event.target.value)}
                  required
                  placeholder="owner@brand.com"
                  className="h-10 rounded-xl border-white/65 bg-white/85"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Owner password</span>
                <Input
                  type="password"
                  value={ownerPassword}
                  onChange={(event) => setOwnerPassword(event.target.value)}
                  required
                  placeholder="Minimum 6 characters"
                  className="h-10 rounded-xl border-white/65 bg-white/85"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Admin username</span>
                <Input
                  value={adminUsername}
                  onChange={(event) => setAdminUsername(event.target.value)}
                  required
                  placeholder="admin_main"
                  className="h-10 rounded-xl border-white/65 bg-white/85"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Admin password</span>
                <Input
                  type="password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  required
                  placeholder="Minimum 6 characters"
                  className="h-10 rounded-xl border-white/65 bg-white/85"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Kitchen manager username</span>
                <Input
                  value={kitchenUsername}
                  onChange={(event) => setKitchenUsername(event.target.value)}
                  required
                  placeholder="kitchen_main"
                  className="h-10 rounded-xl border-white/65 bg-white/85"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Kitchen manager password</span>
                <Input
                  type="password"
                  value={kitchenPassword}
                  onChange={(event) => setKitchenPassword(event.target.value)}
                  required
                  placeholder="Minimum 6 characters"
                  className="h-10 rounded-xl border-white/65 bg-white/85"
                />
              </label>

              <div className="mt-2 md:col-span-2">
                <Button
                  type="submit"
                  disabled={saving}
                  className="h-12 w-full rounded-full bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  {saving ? 'Creating workspace...' : 'Create Workspace'}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="mt-6 grid gap-4">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Owner email</span>
                <Input
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  required
                  placeholder="owner@brand.com"
                  className="h-10 rounded-xl border-white/65 bg-white/85"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Owner password</span>
                <Input
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  required
                  placeholder="Enter workspace password"
                  className="h-10 rounded-xl border-white/65 bg-white/85"
                />
              </label>

              <div className="mt-2">
                <Button
                  type="submit"
                  disabled={saving}
                  className="h-12 w-full rounded-full bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  {saving ? 'Signing in...' : 'Login to Workspace'}
                </Button>
              </div>
            </form>
          )}
        </section>

        <section className="flex">
          <Card className="glass-grid-card w-full rounded-[30px] border-white/70 p-6 md:p-8">
            <h2 className="text-2xl text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>
              Platform Flow
            </h2>
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/70 bg-white/75 p-4">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Store className="h-4 w-4 text-teal-700" />
                  1. Welcome / Landing
                </p>
                <p className="mt-2 text-sm text-slate-600">Your customers always start from a polished landing experience.</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/75 p-4">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <CircleUserRound className="h-4 w-4 text-teal-700" />
                  2. Register or Login
                </p>
                <p className="mt-2 text-sm text-slate-600">Each restaurant creates its own workspace with unique admin and kitchen credentials.</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/75 p-4">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ShieldCheck className="h-4 w-4 text-teal-700" />
                  3. Role Access
                </p>
                <p className="mt-2 text-sm text-slate-600">After workspace login, users go to role selection and continue as Admin or Kitchen.</p>
              </div>
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}
