import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { DollarSign, Filter } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import * as api from '../lib/api';
import AdminNav from '../components/AdminNav';

const STATUS_COLORS = {
  PENDING: 'bg-red-100 text-red-800',
  PREPARING: 'bg-yellow-100 text-yellow-800',
  READY: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
};

const PAYMENT_COLORS = {
  PAID: 'bg-green-100 text-green-800',
  UNPAID: 'bg-orange-100 text-orange-800',
};

export default function AdminOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let mounted = true;

    (async () => {
      try {
        const session = await api.getAdminSession();
        if (!session) {
          navigate('/admin/login');
          return;
        }
        if (!mounted) return;
        await loadOrders();
        interval = setInterval(loadOrders, 10000);
      } catch (error) {
        console.error('Session check failed:', error);
        navigate('/admin/login');
      }
    })();

    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, [navigate]);

  const loadOrders = async () => {
    try {
      const res = await api.getOrders();
      setOrders(res.orders);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const markAsPaid = async (orderId: string) => {
    try {
      await api.updateOrderPayment(orderId, 'PAID');
      toast.success('Order marked as paid');
      loadOrders();
    } catch (error) {
      console.error('Error updating payment status:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update payment status');
    }
  };

  const settleCombinedBill = async (order: any) => {
    if (!order.customerPhone) {
      toast.error('Customer mobile number missing for this order.');
      return;
    }

    try {
      const bill = await api.getUnpaidBillByTableAndPhone(order.tableNumber, order.customerPhone);
      if (!bill.orders.length) {
        toast.info('No unpaid orders found for this customer at this table.');
        return;
      }

      const orderLines = bill.orders
        .map((o) => `#${o.id} - $${Number(o.total || 0).toFixed(2)}`)
        .join('\\n');
      const ok = window.confirm(
        `Final Bill\\nTable: ${order.tableNumber}\\nPhone: ${order.customerPhone}\\n\\nOrders:\\n${orderLines}\\n\\nGrand Total: $${bill.total.toFixed(2)}\\n\\nMark all as paid?`,
      );
      if (!ok) return;

      await api.markOrdersPaidBulk(bill.orders.map((o) => o.id));
      toast.success(`Bill settled. ${bill.orders.length} orders marked paid.`);
      loadOrders();
    } catch (error) {
      console.error('Error settling combined bill:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to settle combined bill');
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    if (filter === 'today') {
      const today = new Date().toDateString();
      return new Date(order.createdAt).toDateString() === today;
    }
    return order.paymentStatus === filter;
  });

  const calculateRevenue = () => {
    return filteredOrders
      .filter(order => order.paymentStatus === 'PAID')
      .reduce((sum, order) => sum + order.total, 0);
  };

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="brand-display text-3xl font-bold mb-4">Orders</h2>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="glass-grid-card p-4">
              <div className="text-sm text-muted-foreground">Total Orders</div>
              <div className="text-3xl font-bold">{filteredOrders.length}</div>
            </Card>
            <Card className="glass-grid-card p-4">
              <div className="text-sm text-muted-foreground">Unpaid Orders</div>
              <div className="text-3xl font-bold">
                {filteredOrders.filter(o => o.paymentStatus === 'UNPAID').length}
              </div>
            </Card>
            <Card className="glass-grid-card p-4 border-green-200/60 bg-green-100/35">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                Revenue (Paid)
              </div>
              <div className="text-3xl font-bold text-green-700">
                ${calculateRevenue().toFixed(2)}
              </div>
            </Card>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="PAID">Paid Only</SelectItem>
                <SelectItem value="UNPAID">Unpaid Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {filteredOrders.map(order => (
            <Card key={order.id} className="glass-grid-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold">Table {order.tableNumber}</h3>
                    <Badge className={STATUS_COLORS[order.status as keyof typeof STATUS_COLORS]}>
                      {order.status}
                    </Badge>
                    <Badge className={PAYMENT_COLORS[order.paymentStatus as keyof typeof PAYMENT_COLORS]}>
                      {order.paymentStatus}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{order.customerName}</p>
                  <p className="text-xs text-muted-foreground">{order.customerPhone ? `Mobile: ${order.customerPhone}` : 'Mobile: -'}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(order.createdAt), 'MMM dd, yyyy • h:mm a')}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">${order.total.toFixed(2)}</div>
                  {order.paymentStatus === 'UNPAID' && (
                    <div className="mt-2 flex flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={() => markAsPaid(order.id)}
                      >
                        Mark this Paid
                      </Button>
                      {order.customerPhone && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => settleCombinedBill(order)}
                        >
                          Generate + Settle Final Bill
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                {order.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.quantity}x {item.name}
                    </span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}

          {filteredOrders.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No orders found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
