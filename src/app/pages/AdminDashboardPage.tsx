import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Clock3,
  DollarSign,
  ListChecks,
  ListOrdered,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../components/ui/card';
import * as api from '../lib/api';

type HourBucket = { label: string; count: number };

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  PREPARING: '#fb7185',
  READY: '#06b6d4',
  COMPLETED: '#10b981',
  CANCELLED: '#94a3b8',
};

const STATUS_GRADIENTS: Record<string, { start: string; end: string }> = {
  PENDING: { start: '#fbbf24', end: '#f59e0b' },
  PREPARING: { start: '#fb7185', end: '#e11d48' },
  READY: { start: '#22d3ee', end: '#0891b2' },
  COMPLETED: { start: '#34d399', end: '#059669' },
  CANCELLED: { start: '#cbd5e1', end: '#64748b' },
};

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

function InsightCard({
  title,
  value,
  hint,
  icon,
  valueClassName,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <Card className="glass-grid-card p-4 border-slate-200/70 bg-white">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className="text-slate-500">{icon}</div>
      </div>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${valueClassName || ''}`}>{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [finalBills, setFinalBills] = useState<any[]>([]);
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
      const [ordersRes, billsRes] = await Promise.all([
        api.getOrders(),
        api.getFinalBills().catch(() => ({ bills: [] })),
      ]);
      setOrders(ordersRes.orders || []);
      setFinalBills(billsRes.bills || []);
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
    const preparing = todayOrders.filter((o) => o.status === 'PREPARING');
    const ready = todayOrders.filter((o) => o.status === 'READY');
    const cancelled = todayOrders.filter((o) => o.status === 'CANCELLED');
    const revenue = paid.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const activeTables = new Set(
      todayOrders
        .filter((o) => o.status !== 'CANCELLED')
        .map((o) => Number(o.tableNumber || 0))
        .filter(Boolean),
    ).size;

    return {
      total: todayOrders.length,
      unpaid: unpaid.length,
      paid: paid.length,
      served: served.length,
      preparing: preparing.length,
      ready: ready.length,
      cancelled: cancelled.length,
      activeTables,
      revenue,
      avgTicket: paid.length ? revenue / paid.length : 0,
      paidRate: todayOrders.length ? paid.length / todayOrders.length : 0,
      completionRate: todayOrders.length ? served.length / todayOrders.length : 0,
    };
  }, [todayOrders]);

  const todaySessionCount = useMemo(() => {
    const map = new Map<string, any[]>();
    todayOrders.forEach((order) => {
      const key = `${order.tableNumber}__${order.customerPhone || 'NO_PHONE'}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(order);
    });

    let count = 0;
    Array.from(map.values()).forEach((groupOrders) => {
      const ordered = [...groupOrders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const tableNumber = Number(ordered[0]?.tableNumber || 0);
      const phone = ordered[0]?.customerPhone || '';
      const paidBills = (finalBills || []).filter(
        (b: any) => b.isPaid && b.tableNumber === tableNumber && (b.customerPhone || '') === phone,
      );

      if (paidBills.length > 0) {
        const orderById = new Map(ordered.map((o) => [String(o.id), o]));
        const sessionBoundaryOrderIds = new Set<string>();
        paidBills.forEach((bill: any) => {
          const billOrders = (bill.orderIds || [])
            .map((id: string) => orderById.get(String(id)))
            .filter(Boolean)
            .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          const lastOrderInBill = billOrders[billOrders.length - 1];
          if (lastOrderInBill) sessionBoundaryOrderIds.add(String(lastOrderInBill.id));
        });
        for (let i = 0; i < ordered.length; i++) {
          if (i === 0 || sessionBoundaryOrderIds.has(String(ordered[i - 1].id))) count += 1;
        }
      } else if (ordered.length > 0) {
        count += 1;
      }
    });

    return count;
  }, [todayOrders, finalBills]);

  const statusDistribution = useMemo(() => {
    const keys = ['PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];
    const counts: Record<string, number> = {};
    keys.forEach((k) => (counts[k] = 0));
    todayOrders.forEach((o) => {
      if (counts[o.status] !== undefined) counts[o.status] += 1;
    });
    return keys.map((k) => ({
      key: k,
      label: k === 'COMPLETED' ? 'SERVED' : k,
      count: counts[k],
      fill: STATUS_COLORS[k],
    }));
  }, [todayOrders]);

  const hourlyTrend = useMemo<HourBucket[]>(() => {
    const now = new Date();
    const buckets: HourBucket[] = Array.from({ length: 12 }).map((_, idx) => {
      const d = new Date(now);
      d.setMinutes(0, 0, 0);
      d.setHours(now.getHours() - (11 - idx));
      return { label: `${String(d.getHours()).padStart(2, '0')}:00`, count: 0 };
    });

    const bucketByLabel = new Map(buckets.map((b) => [b.label, b]));
    todayOrders.forEach((o) => {
      const d = new Date(o.createdAt);
      const label = `${String(d.getHours()).padStart(2, '0')}:00`;
      const bucket = bucketByLabel.get(label);
      if (bucket) bucket.count += 1;
    });

    return buckets;
  }, [todayOrders]);

  const topItems = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; sales: number }>();
    todayOrders
      .filter((o) => o.status !== 'CANCELLED')
      .forEach((o) => {
        (o.items || []).forEach((i: any) => {
          const item = map.get(i.name) || { name: i.name, qty: 0, sales: 0 };
          const quantity = Number(i.quantity || 0);
          const unitPrice = Number(i.price || 0);
          item.qty += quantity;
          item.sales += quantity * unitPrice;
          map.set(i.name, item);
        });
      });
    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);
  }, [todayOrders]);

  const paymentMix = useMemo(() => {
    const counts = new Map<string, number>();
    todayOrders
      .filter((o) => o.paymentStatus === 'PAID')
      .forEach((o) => {
        const key = o.paymentMethod || 'UNKNOWN';
        counts.set(key, (counts.get(key) || 0) + 1);
      });

    return Array.from(counts.entries())
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count);
  }, [todayOrders]);

  const peakHour = useMemo(() => {
    if (!hourlyTrend.length) return '--';
    const peak = [...hourlyTrend].sort((a, b) => b.count - a.count)[0];
    return peak?.count ? `${peak.label} (${peak.count})` : '--';
  }, [hourlyTrend]);

  const currentQueue = stats.preparing + stats.ready + stats.unpaid;

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="page-shell bg-gradient-to-b from-slate-50 via-white to-slate-100/70">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <Card className="glass-grid-card overflow-hidden border-slate-200/80 bg-white">
          <div className="relative p-6 md:p-8">
            <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-teal-700 font-semibold">Live Operations</p>
                <h2 className="brand-display text-4xl font-bold mt-2 text-slate-900">Dashboard</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Real-time performance snapshot for today&apos;s service.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 min-w-[260px]">
                <div className="rounded-xl border border-slate-200 bg-white/90 p-3">
                  <p className="text-xs text-muted-foreground">Paid conversion</p>
                  <p className="text-lg font-semibold text-slate-900">{formatPercent(stats.paidRate)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white/90 p-3">
                  <p className="text-xs text-muted-foreground">Peak hour</p>
                  <p className="text-lg font-semibold text-slate-900">{peakHour}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <InsightCard
            title="Dining Sessions"
            value={String(todaySessionCount)}
            hint={`${stats.activeTables} active tables today`}
            icon={<Users className="w-4 h-4" />}
          />
          <InsightCard
            title="Revenue"
            value={formatCurrency(stats.revenue)}
            hint={`Avg ticket ${formatCurrency(stats.avgTicket)}`}
            icon={<DollarSign className="w-4 h-4" />}
            valueClassName="text-emerald-700"
          />
          <InsightCard
            title="Open Queue"
            value={String(currentQueue)}
            hint={`${stats.preparing} preparing, ${stats.ready} ready, ${stats.unpaid} unpaid`}
            icon={<ListChecks className="w-4 h-4" />}
          />
          <InsightCard
            title="Served"
            value={String(stats.served)}
            hint={`Completion ${formatPercent(stats.completionRate)}`}
            icon={<TrendingUp className="w-4 h-4" />}
          />
          <InsightCard
            title="Cancelled"
            value={String(stats.cancelled)}
            hint={`${stats.total} total orders today`}
            icon={<Clock3 className="w-4 h-4" />}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="glass-grid-card p-5 xl:col-span-2 bg-white border-slate-200/80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2 text-slate-900">
                <Activity className="w-4 h-4 text-teal-600" />
                Order Flow (Last 12h)
              </h3>
              <p className="text-xs text-muted-foreground">Updated every 10s</p>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip
                    cursor={{ stroke: '#14b8a6', strokeOpacity: 0.25 }}
                    contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', boxShadow: '0 8px 24px rgba(2, 6, 23, 0.08)' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#0f766e" strokeWidth={3} fill="url(#ordersGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="glass-grid-card p-5 bg-white border-slate-200/80">
            <h3 className="font-semibold flex items-center gap-2 mb-4 text-slate-900">
              <BarChart3 className="w-4 h-4 text-cyan-600" />
              Status Mix
            </h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {statusDistribution.map((entry) => (
                      <linearGradient
                        key={`status-gradient-${entry.key}`}
                        id={`statusGradient-${entry.key}`}
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="1"
                      >
                        <stop offset="0%" stopColor={STATUS_GRADIENTS[entry.key].start} />
                        <stop offset="100%" stopColor={STATUS_GRADIENTS[entry.key].end} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={statusDistribution}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={3}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {statusDistribution.map((entry) => (
                      <Cell key={entry.key} fill={`url(#statusGradient-${entry.key})`} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [value, name]}
                    contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {statusDistribution.map((s) => (
                <div key={s.key} className="flex items-center justify-between rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.fill }} />
                    {s.label}
                  </span>
                  <span className="font-semibold">{s.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="glass-grid-card p-5 xl:col-span-2 bg-white border-slate-200/80">
            <h3 className="font-semibold flex items-center gap-2 mb-4 text-slate-900">
              <ListOrdered className="w-4 h-4 text-amber-600" />
              Best Sellers (Today)
            </h3>
            {topItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No item activity yet.</p>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topItems} layout="vertical" margin={{ top: 8, right: 10, left: 20, bottom: 8 }}>
                    <defs>
                      <linearGradient id="topItemsBarGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#fbbf24" />
                        <stop offset="100%" stopColor="#f97316" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: '#334155' }}
                    />
                    <Tooltip
                      formatter={(value: number, name: string, payload: any) => {
                        if (name === 'qty') return [`${value} units`, 'Sold'];
                        return [value, name];
                      }}
                      labelFormatter={(label) => `${label}`}
                      contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
                    />
                    <Bar dataKey="qty" fill="url(#topItemsBarGradient)" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card className="glass-grid-card p-5 bg-white border-slate-200/80">
            <h3 className="font-semibold flex items-center gap-2 mb-4 text-slate-900">
              <BadgeDollarSign className="w-4 h-4 text-emerald-600" />
              Business Health
            </h3>
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">Collection Efficiency</p>
                <p className="text-2xl font-bold text-slate-900">{formatPercent(stats.paidRate)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">Average Ticket</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.avgTicket)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">Payment Methods</p>
                {paymentMix.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-1">No paid orders yet.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {paymentMix.slice(0, 4).map((method) => {
                      const pct = stats.paid ? (method.count / stats.paid) * 100 : 0;
                      return (
                        <div key={method.method}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-700">{method.method}</span>
                            <span className="font-semibold">{method.count}</span>
                          </div>
                          <div className="h-2 rounded bg-slate-200 overflow-hidden">
                            <div className="h-full rounded bg-emerald-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
