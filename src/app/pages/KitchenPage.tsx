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
};

const STATUS_FLOW = ['PENDING', 'PREPARING', 'READY', 'COMPLETED'];

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
      // Filter out completed orders and sort by status priority
      const activeOrders = res.orders.filter((o: any) => o.status !== 'COMPLETED');
      const sorted = activeOrders.sort((a: any, b: any) => {
        const statusA = STATUS_FLOW.indexOf(a.status);
        const statusB = STATUS_FLOW.indexOf(b.status);
        if (statusA !== statusB) return statusA - statusB;
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
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <ChefHat className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No active orders</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map(order => (
              <Card key={order.id} className="glass-grid-card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold">Table {order.tableNumber}</h3>
                    <p className="text-sm text-muted-foreground">{order.customerName}</p>
                  </div>
                  <Badge className={STATUS_COLORS[order.status as keyof typeof STATUS_COLORS]}>
                    {order.status}
                  </Badge>
                </div>

                <div className="space-y-2 mb-4">
                  {order.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>
                        {item.quantity}x {item.name}
                      </span>
                      <span className="font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                  </span>
                  <span className="font-bold">${order.total.toFixed(2)}</span>
                </div>

                {order.status !== 'COMPLETED' && (
                  <Button
                    className="w-full"
                    onClick={() => updateStatus(order.id, order.status)}
                  >
                    {order.status === 'PENDING' && 'Start Preparing'}
                    {order.status === 'PREPARING' && 'Mark Ready'}
                    {order.status === 'READY' && 'Complete'}
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
