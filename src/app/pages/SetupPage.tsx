import { FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { loginWorkspace, registerWorkspace } from '../lib/workspaceAuth';

export default function SetupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isLoginMode = searchParams.get('mode') === 'login';
  const [saving, setSaving] = useState(false);

  const [restaurantName, setRestaurantName] = useState('');
  const [outletName, setOutletName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [kitchenUsername, setKitchenUsername] = useState('');
  const [kitchenPassword, setKitchenPassword] = useState('');
  const [workspaceLogoFile, setWorkspaceLogoFile] = useState<File | null>(null);
  const [workspaceLogoPreview, setWorkspaceLogoPreview] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const handleWorkspaceLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setWorkspaceLogoFile(null);
      setWorkspaceLogoPreview('');
      return;
    }
    setWorkspaceLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setWorkspaceLogoPreview(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

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
        workspaceLogoFile,
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
      toast.success('Workspace sign-in successful');
      navigate('/access');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sign in failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto w-full max-w-[980px] px-6 py-12 md:px-10 md:py-16">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-rose-500">
            {isLoginMode ? 'Sign In' : 'Setup'}
          </p>
          <h1 className="mt-2 text-4xl leading-[1.02] text-slate-900 md:text-6xl" style={{ fontFamily: "'Playfair Display', serif" }}>
            {isLoginMode ? 'Workspace Sign In' : 'Workspace Setup'}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
            {isLoginMode
              ? 'Sign in with owner credentials to continue to Admin/Kitchen access selection.'
              : 'Create your workspace once with owner, admin, and kitchen credentials. You can sign in anytime after setup.'}
          </p>
          <div className="mt-8 border-t border-slate-200/80" />

          {isLoginMode ? (
            <form onSubmit={handleLogin} className="mt-8 grid max-w-xl gap-5">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Owner email</span>
                <Input
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  required
                  placeholder="Enter owner email"
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
                  placeholder="Enter owner password"
                  className="h-11 rounded-2xl border-slate-200 bg-white"
                />
              </label>

              <div className="mt-2">
                <Button
                  type="submit"
                  disabled={saving}
                  className="h-12 w-full rounded-full bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 md:w-auto md:px-10"
                >
                  {saving ? 'Signing in...' : 'Sign in to Workspace'}
                </Button>
              </div>
              <button
                type="button"
                onClick={() => navigate('/setup')}
                className="mt-1 w-fit text-sm text-slate-700"
              >
                New workspace? <span className="font-semibold text-[#00A000] underline underline-offset-4">Register.</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="mt-8 grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Restaurant / Cafe name</span>
                <Input
                  value={restaurantName}
                  onChange={(event) => setRestaurantName(event.target.value)}
                  required
                  placeholder="Enter restaurant or cafe name"
                  className="h-11 rounded-2xl border-slate-200 bg-white"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Workspace logo (optional)</span>
                <div className="flex items-center gap-3">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleWorkspaceLogoChange}
                    className="h-11 rounded-2xl border-slate-200 bg-white file:mr-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                  />
                  {workspaceLogoPreview ? (
                    <img src={workspaceLogoPreview} alt="Workspace logo preview" className="h-11 w-11 rounded-xl border border-slate-200 object-cover" />
                  ) : null}
                </div>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Outlet / Branch</span>
                <Input
                  value={outletName}
                  onChange={(event) => setOutletName(event.target.value)}
                  required
                  placeholder="Enter outlet or branch name"
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
                  placeholder="name@business.com"
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
                  placeholder="Create owner password"
                  className="h-11 rounded-2xl border-slate-200 bg-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Admin username</span>
                <Input
                  value={adminUsername}
                  onChange={(event) => setAdminUsername(event.target.value)}
                  required
                  placeholder="Create admin username"
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
                  placeholder="Create admin password"
                  className="h-11 rounded-2xl border-slate-200 bg-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Kitchen manager username</span>
                <Input
                  value={kitchenUsername}
                  onChange={(event) => setKitchenUsername(event.target.value)}
                  required
                  placeholder="Create kitchen username"
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
                  placeholder="Create kitchen password"
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
              <button
                type="button"
                onClick={() => navigate('/setup?mode=login')}
                className="md:col-span-2 mt-1 w-fit text-sm text-slate-700"
              >
                Already have a workspace? <span className="font-semibold text-[#00A000] underline underline-offset-4">Sign in.</span>
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
