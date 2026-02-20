import { useState, useEffect } from 'react';
import { ChefHat, Clock } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import * as api from '../lib/api';
import { formatDistanceToNow } from 'date-fns';

const STATUS_COLORS = {
  PENDING: 'bg-red-100 text-red-800',
  PREPARING: 'bg-yellow-100 text-yellow-800',
  READY: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-gray-200 text-gray-700',
};

const STATUS_FLOW = ['PENDING', 'PREPARING', 'READY', 'COMPLETED'];
const ACTIVE_STATUSES = ['PENDING', 'PREPARING', 'READY'] as const;
const STATUS_TITLES: Record<string, string> = {
  PENDING: 'New Orders',
  PREPARING: 'In Preparation',
  READY: 'Ready to Serve',
};

export default function KitchenPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
    // Poll for new orders every 5 seconds
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadOrders = async () => {
    try {
      const res = await api.getOrders();
      // Keep active statuses only and prioritize first-come orders.
      const activeOrders = res.orders.filter((o: any) => ACTIVE_STATUSES.includes(o.status));
      const sorted = activeOrders.sort((a: any, b: any) => {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      setOrders(sorted);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const groupedByPhone = orders.reduce((acc: Record<string, any[]>, order: any) => {
    const key = order.customerPhone || `NO_PHONE_${order.id}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(order);
    return acc;
  }, {});

  const phoneGroups = Object.entries(groupedByPhone)
    .map(([phone, groupOrders]) => {
      const sorted = [...groupOrders].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      return { phone, orders: sorted, firstAt: sorted[0]?.createdAt };
    })
    .sort((a, b) => new Date(a.firstAt).getTime() - new Date(b.firstAt).getTime());

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
      {/* Header */}
      <div className="sticky top-0 z-20 border-b bg-white/95">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="brand-display text-2xl font-bold flex items-center gap-2">
            <ChefHat className="w-6 h-6" />
            Kitchen Orders
          </h1>
          <p className="text-sm text-muted-foreground">{orders.length} active orders</p>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {phoneGroups.length === 0 ? (
          <div className="text-center py-12">
            <ChefHat className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No active orders</p>
          </div>
        ) : (
          <div className="space-y-5">
            {phoneGroups.map((group) => {
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
        )}
      </div>
    </div>
  );
}
