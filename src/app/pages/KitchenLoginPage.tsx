import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Lock, ArrowLeft } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import * as api from '../lib/api';
import utensilsIcon from '../../assets/utensils.png';

export default function KitchenLoginPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await api.getKitchenSession();
      if (session) navigate('/kitchen');
    })();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.kitchenSignIn(password, name);
      toast.success('Kitchen login successful');
      navigate('/kitchen');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell flex items-center justify-center bg-transparent p-4">
      <Card className="glass-grid-card max-w-md w-full rounded-[26px] border-slate-200 p-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src={utensilsIcon} alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
            <h1 className="brand-display text-3xl font-bold">Kitchen Login</h1>
          </div>
          <p className="text-muted-foreground">Access kitchen manager view only</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Username</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter kitchen username"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Kitchen Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter kitchen password"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              'Signing in...'
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Login to Kitchen
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
