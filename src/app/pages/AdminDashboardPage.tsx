import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { BarChart3, Clock3, DollarSign, ListOrdered, TrendingUp } from 'lucide-react';
import { Card } from '../components/ui/card';
import AdminNav from '../components/AdminNav';
import * as api from '../lib/api';

type HourBucket = { label: string; count: number };

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      try {
        const session = await api.getAdminSession();
        if (!session) {
          navigate('/admin/login');
          return;
        }
        if (!mounted) return;
        await loadData();
        interval = setInterval(loadData, 10000);
      } catch {
        navigate('/admin/login');
      }
    })();

    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, [navigate]);

  const loadData = async () => {
    try {
      const res = await api.getOrders();
      setOrders(res.orders || []);
    } finally {
      setLoading(false);
    }
  };

  const todayOrders = useMemo(() => {
    const today = new Date().toDateString();
    return orders.filter((o) => new Date(o.createdAt).toDateString() === today);
  }, [orders]);

  const stats = useMemo(() => {
    const unpaid = todayOrders.filter((o) => o.paymentStatus === 'UNPAID' && o.status !== 'CANCELLED');
    const paid = todayOrders.filter((o) => o.paymentStatus === 'PAID');
    const served = todayOrders.filter((o) => o.status === 'COMPLETED');
    const revenue = paid.reduce((sum, o) => sum + Number(o.total || 0), 0);
    return {
      total: todayOrders.length,
      unpaid: unpaid.length,
      served: served.length,
      revenue,
    };
  }, [todayOrders]);

  const statusDistribution = useMemo(() => {
    const keys = ['PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];
    const counts: Record<string, number> = {};
    keys.forEach((k) => (counts[k] = 0));
    todayOrders.forEach((o) => {
      if (counts[o.status] !== undefined) counts[o.status] += 1;
    });
    return keys.map((k) => ({ key: k, label: k === 'COMPLETED' ? 'SERVED' : k, count: counts[k] }));
  }, [todayOrders]);

  const hourlyTrend = useMemo<HourBucket[]>(() => {
    const buckets: HourBucket[] = Array.from({ length: 8 }).map((_, idx) => {
      const d = new Date();
      d.setHours(d.getHours() - (7 - idx), 0, 0, 0);
      return { label: `${String(d.getHours()).padStart(2, '0')}:00`, count: 0 };
    });
    todayOrders.forEach((o) => {
      const hour = new Date(o.createdAt).getHours();
      const found = buckets.find((b) => Number(b.label.slice(0, 2)) === hour);
      if (found) found.count += 1;
    });
    return buckets;
  }, [todayOrders]);

  const topItems = useMemo(() => {
    const map = new Map<string, number>();
    todayOrders
      .filter((o) => o.status !== 'CANCELLED')
      .forEach((o) => {
        (o.items || []).forEach((i: any) => {
          map.set(i.name, (map.get(i.name) || 0) + Number(i.quantity || 0));
        });
      });
    return Array.from(map.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [todayOrders]);

  const maxStatus = Math.max(1, ...statusDistribution.map((s) => s.count));
  const maxHourly = Math.max(1, ...hourlyTrend.map((h) => h.count));

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h2 className="brand-display text-3xl font-bold mb-4">Dashboard</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <Card className="glass-grid-card p-4">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <ListOrdered className="w-4 h-4" /> Orders Today
            </div>
            <div className="text-3xl font-bold mt-2">{stats.total}</div>
          </Card>
          <Card className="glass-grid-card p-4">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock3 className="w-4 h-4" /> Unpaid
            </div>
            <div className="text-3xl font-bold mt-2">{stats.unpaid}</div>
          </Card>
          <Card className="glass-grid-card p-4">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Served
            </div>
            <div className="text-3xl font-bold mt-2">{stats.served}</div>
          </Card>
          <Card className="glass-grid-card p-4 border-green-200/60 bg-green-100/35">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Revenue (Paid)
            </div>
            <div className="text-3xl font-bold text-green-700 mt-2">${stats.revenue.toFixed(2)}</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card className="glass-grid-card p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Status Distribution (Today)
            </h3>
            <div className="space-y-2">
              {statusDistribution.map((s) => (
                <div key={s.key}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{s.label}</span>
                    <span className="font-semibold">{s.count}</span>
                  </div>
                  <div className="h-2 rounded bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-primary/80"
                      style={{ width: `${(s.count / maxStatus) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="glass-grid-card p-4">
            <h3 className="font-semibold mb-3">Orders by Hour (Last 8h)</h3>
            <div className="space-y-2">
              {hourlyTrend.map((h) => (
                <div key={h.label} className="flex items-center gap-2">
                  <span className="w-14 text-xs text-muted-foreground">{h.label}</span>
                  <div className="h-2 flex-1 rounded bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-teal-600"
                      style={{ width: `${(h.count / maxHourly) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-xs text-right font-semibold">{h.count}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="glass-grid-card p-4 xl:col-span-2">
            <h3 className="font-semibold mb-3">Top Items (Today)</h3>
            {topItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No item activity yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
                {topItems.map((i) => (
                  <div key={i.name} className="rounded-lg border bg-white p-3">
                    <p className="font-medium text-sm line-clamp-2">{i.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">Qty sold</p>
                    <p className="text-xl font-bold">{i.qty}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
