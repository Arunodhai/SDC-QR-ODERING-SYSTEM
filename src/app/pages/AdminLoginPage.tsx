import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Lock, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { toast } from 'sonner';
import * as api from '../lib/api';
import logo12 from '../../assets/logo12.png';
import administratorIcon from '../../assets/administrator.png';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const session = await api.getAdminSession();
        if (session) navigate('/admin/dashboard');
      } catch {
        // ignore session read failures on login page
      }
    })();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    try {
      await api.adminSignIn(email.trim(), password);
      toast.success('Login successful');
      navigate('/admin/dashboard');
    } catch (error) {
      console.error('Admin login failed:', error);
      toast.error(error instanceof Error ? error.message : 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell flex items-center justify-center bg-transparent p-4">
      <Card className="glass-grid-card max-w-md w-full rounded-[26px] border-slate-200 p-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src={logo12} alt="Stories de Café" className="h-10 w-10 object-contain" />
            <h1 className="brand-display text-3xl font-bold">Stories de Café</h1>
          </div>
          <p className="text-muted-foreground inline-flex items-center justify-center gap-2">
            <img src={administratorIcon} alt="" aria-hidden="true" className="h-6 w-6 object-contain" />
            <span>Admin Login</span>
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@storiesdecafe.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              'Signing in...'
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Login
              </>
            )}
          </Button>
        </form>

        <Button
          variant="ghost"
          className="mt-4 -ml-2 text-base transition-all duration-200 hover:text-[1.08rem] hover:bg-transparent focus-visible:bg-transparent active:bg-transparent"
          onClick={() => navigate('/')}
          type="button"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Access Selection
        </Button>
      </Card>
    </div>
  );
}
