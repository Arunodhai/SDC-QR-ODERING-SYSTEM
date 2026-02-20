import { useMemo, useState, useEffect } from 'react';
import { ChefHat, Clock, History } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import * as api from '../lib/api';
import { format, formatDistanceToNow } from 'date-fns';

const STATUS_COLORS = {
  PENDING: 'bg-red-100 text-red-800',
  PREPARING: 'bg-yellow-100 text-yellow-800',
  READY: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const STATUS_FLOW = ['PENDING', 'PREPARING', 'READY', 'COMPLETED'];
const ACTIVE_STATUSES = ['PENDING', 'PREPARING', 'READY'] as const;
const HISTORY_STATUSES = ['COMPLETED', 'CANCELLED'] as const;
const STATUS_TITLES: Record<string, string> = {
  PENDING: 'New Orders',
  PREPARING: 'In Preparation',
  READY: 'Ready to Serve',
};

const localDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function KitchenPage() {
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [historyDate, setHistoryDate] = useState(localDateKey(new Date()));

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadOrders = async () => {
    try {
      const res = await api.getOrders();
      setAllOrders(res.orders || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const activeOrders = useMemo(() => {
    return [...allOrders]
      .filter((o: any) => ACTIVE_STATUSES.includes(o.status))
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [allOrders]);

  const historyOrders = useMemo(() => {
    return [...allOrders]
      .filter((o: any) => HISTORY_STATUSES.includes(o.status))
      .filter((o: any) => localDateKey(new Date(o.createdAt)) === historyDate)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allOrders, historyDate]);

  const updateStatus = async (orderId: string, currentStatus: string) => {
    const currentIndex = STATUS_FLOW.indexOf(currentStatus);
    if (currentIndex < STATUS_FLOW.length - 1) {
      const newStatus = STATUS_FLOW[currentIndex + 1];
      try {
        await api.updateOrderStatus(orderId, newStatus);
        toast.success(`Order status updated to ${newStatus}`);
        loadOrders();
      } catch (error) {
        console.error('Error updating order status:', error);
        toast.error('Failed to update order status');
      }
    }
  };

  const activeGroupedByPhone = useMemo(() => {
    const groupedByPhone = activeOrders.reduce((acc: Record<string, any[]>, order: any) => {
      const key = order.customerPhone || `NO_PHONE_${order.id}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(order);
      return acc;
    }, {});

    return Object.entries(groupedByPhone)
      .map(([phone, groupOrders]) => {
        const sorted = [...groupOrders].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        return { phone, orders: sorted, firstAt: sorted[0]?.createdAt };
      })
      .sort((a, b) => new Date(a.firstAt).getTime() - new Date(b.firstAt).getTime());
  }, [activeOrders]);

  const historyGrouped = useMemo(() => {
    const grouped = historyOrders.reduce((acc: Record<string, any[]>, order: any) => {
      const key = `${order.tableNumber}__${order.customerPhone || 'NO_PHONE'}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(order);
      return acc;
    }, {});

    return Object.entries(grouped).map(([key, orders]) => {
      const [tableStr, phone] = key.split('__');
      return {
        key,
        tableNumber: Number(tableStr),
        phone: phone === 'NO_PHONE' ? '' : phone,
        orders,
      };
    });
  }, [historyOrders]);

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="text-center">
          <ChefHat className="w-12 h-12 animate-pulse mx-auto mb-4" />
          <p className="text-lg">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="sticky top-0 z-20 border-b bg-white/95">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="brand-display text-2xl font-bold flex items-center gap-2">
                <ChefHat className="w-6 h-6" />
                Kitchen Orders
              </h1>
              <p className="text-sm text-muted-foreground">
                {viewMode === 'active' ? `${activeOrders.length} active orders` : `${historyOrders.length} historical orders`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <nav className="flex gap-1 rounded-xl border bg-white p-1">
              <Button
                size="sm"
                variant={viewMode === 'active' ? 'default' : 'ghost'}
                className="rounded-lg"
                onClick={() => setViewMode('active')}
              >
                Active
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'history' ? 'default' : 'ghost'}
                className="rounded-lg"
                onClick={() => setViewMode('history')}
              >
                <History className="h-4 w-4 mr-1" />
                History
              </Button>
              </nav>
              {viewMode === 'history' && (
                <input
                  type="date"
                  value={historyDate}
                  onChange={(e) => setHistoryDate(e.target.value)}
                  className="h-9 rounded-md border px-3 text-sm"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {viewMode === 'active' ? (
          activeGroupedByPhone.length === 0 ? (
            <div className="text-center py-12">
              <ChefHat className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No active orders</p>
            </div>
          ) : (
            <div className="space-y-5">
              {activeGroupedByPhone.map((group) => {
                const phoneLabel = group.phone.startsWith('NO_PHONE_') ? 'No mobile provided' : group.phone;
                const tables = [...new Set(group.orders.map((o: any) => o.tableNumber))].join(', ');
                return (
                  <Card key={group.phone} className="glass-grid-card p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-bold">Mobile: {phoneLabel}</h3>
                        <p className="text-sm text-muted-foreground">Table(s): {tables}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        First order {formatDistanceToNow(new Date(group.firstAt), { addSuffix: true })}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      {ACTIVE_STATUSES.map((status) => {
                        const statusOrders = group.orders.filter((o: any) => o.status === status);
                        return (
                          <div key={status} className="rounded-lg border p-3 bg-white">
                            <div className="mb-2 flex items-center justify-between">
                              <h4 className="font-semibold text-sm">{STATUS_TITLES[status]}</h4>
                              <Badge className={STATUS_COLORS[status as keyof typeof STATUS_COLORS]}>
                                {statusOrders.length}
                              </Badge>
                            </div>
                            {statusOrders.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No orders</p>
                            ) : (
                              <div className="space-y-2">
                                {statusOrders.map((order: any) => (
                                  <div key={order.id} className="rounded-md border p-2">
                                    <div className="flex items-start justify-between mb-1">
                                      <div>
                                        <p className="text-sm font-semibold">Order #{order.id}</p>
                                        <p className="text-xs text-muted-foreground">Table {order.tableNumber}</p>
                                      </div>
                                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                                      </span>
                                    </div>
                                    <div className="space-y-1 mb-2">
                                      {order.items.map((item: any, idx: number) => (
                                        <div key={idx} className="flex justify-between text-xs">
                                          <span>{item.quantity}x {item.name}</span>
                                          <span className="font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="mb-2 text-xs font-semibold text-right">Total: ${order.total.toFixed(2)}</div>
                                    <Button
                                      className="w-full"
                                      size="sm"
                                      onClick={() => updateStatus(order.id, order.status)}
                                    >
                                      {order.status === 'PENDING' && 'Start Preparing'}
                                      {order.status === 'PREPARING' && 'Mark Ready'}
                                      {order.status === 'READY' && 'Complete'}
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        ) : historyGrouped.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No kitchen history for {historyDate}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {historyGrouped.map((group) => (
              <Card key={group.key} className="glass-grid-card p-4">
                <div className="mb-3">
                  <h3 className="text-lg font-bold">Table {group.tableNumber}</h3>
                  <p className="text-sm text-muted-foreground">Mobile: {group.phone || '-'}</p>
                </div>
                <div className="space-y-2">
                  {group.orders.map((order: any) => (
                    <div key={order.id} className="rounded-md border bg-white p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">Order #{order.id}</span>
                          <Badge className={STATUS_COLORS[order.status as keyof typeof STATUS_COLORS]}>
                            {order.status}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(order.createdAt), 'h:mm a')}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {order.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span>{item.quantity}x {item.name}</span>
                            <span>${(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-right text-sm font-semibold">Total: ${Number(order.total || 0).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
