import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { DollarSign, Filter, ReceiptText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import * as api from '../lib/api';
import AdminNav from '../components/AdminNav';

const STATUS_COLORS = {
  PENDING: 'bg-red-100 text-red-800',
  PREPARING: 'bg-yellow-100 text-yellow-800',
  READY: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-gray-200 text-gray-700',
};

const PAYMENT_COLORS = {
  PAID: 'bg-green-100 text-green-800',
  UNPAID: 'bg-orange-100 text-orange-800',
};

const billingRef = (order: any) => {
  const phone = order.customerPhone || '';
  const last4 = phone ? phone.slice(-4) : '0000';
  return `T${order.tableNumber}-P${last4}-O${order.id}`;
};

export default function AdminOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [billPreview, setBillPreview] = useState<{
    tableNumber: number;
    phone: string;
    orders: any[];
    total: number;
  } | null>(null);
  const [billLoadingKey, setBillLoadingKey] = useState<string>('');
  const [markingGroupPaid, setMarkingGroupPaid] = useState(false);

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
        interval = setInterval(loadOrders, 8000);
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

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        if (filter === 'all') return true;
        if (filter === 'today') {
          const today = new Date().toDateString();
          return new Date(order.createdAt).toDateString() === today;
        }
        return order.paymentStatus === filter;
      }),
    [orders, filter],
  );

  const groupedOrders = useMemo(() => {
    const sorted = [...filteredOrders].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const map = new Map<string, { tableNumber: number; customerPhone: string; orders: any[] }>();
    sorted.forEach((order) => {
      const key = `${order.tableNumber}__${order.customerPhone || 'NO_PHONE'}`;
      if (!map.has(key)) {
        map.set(key, {
          tableNumber: order.tableNumber,
          customerPhone: order.customerPhone || '',
          orders: [],
        });
      }
      map.get(key)!.orders.push(order);
    });
    return Array.from(map.values()).sort((a, b) => {
      const aLast = a.orders[a.orders.length - 1]?.createdAt || '';
      const bLast = b.orders[b.orders.length - 1]?.createdAt || '';
      return new Date(bLast).getTime() - new Date(aLast).getTime();
    });
  }, [filteredOrders]);

  const calculateRevenue = () => {
    return filteredOrders
      .filter((order) => order.paymentStatus === 'PAID')
      .reduce((sum, order) => sum + order.total, 0);
  };

  const generateFinalBill = async (group: { tableNumber: number; customerPhone: string }) => {
    if (!group.customerPhone) {
      toast.error('Customer mobile number is missing for this group.');
      return;
    }

    const key = `${group.tableNumber}__${group.customerPhone}`;
    setBillLoadingKey(key);
    try {
      const bill = await api.getUnpaidBillByTableAndPhone(group.tableNumber, group.customerPhone);
      if (!bill.orders.length) {
        toast.info('No unpaid orders found for this customer at this table.');
        return;
      }
      setBillPreview({
        tableNumber: group.tableNumber,
        phone: group.customerPhone,
        orders: bill.orders,
        total: bill.total,
      });
    } catch (error) {
      console.error('Error generating combined bill:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate combined bill');
    } finally {
      setBillLoadingKey('');
    }
  };

  const markBillPaid = async () => {
    if (!billPreview) return;
    setMarkingGroupPaid(true);
    try {
      await api.markOrdersPaidBulk(billPreview.orders.map((o) => o.id));
      toast.success(`Marked ${billPreview.orders.length} orders as paid.`);
      setBillPreview(null);
      loadOrders();
    } catch (error) {
      console.error('Error marking grouped orders as paid:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to mark grouped orders as paid');
    } finally {
      setMarkingGroupPaid(false);
    }
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="glass-grid-card p-4">
              <div className="text-sm text-muted-foreground">Total Orders</div>
              <div className="text-3xl font-bold">{filteredOrders.length}</div>
            </Card>
            <Card className="glass-grid-card p-4">
              <div className="text-sm text-muted-foreground">Unpaid Orders</div>
              <div className="text-3xl font-bold">
                {filteredOrders.filter((o) => o.paymentStatus === 'UNPAID').length}
              </div>
            </Card>
            <Card className="glass-grid-card p-4 border-green-200/60 bg-green-100/35">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                Revenue (Paid)
              </div>
              <div className="text-3xl font-bold text-green-700">${calculateRevenue().toFixed(2)}</div>
            </Card>
          </div>

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

        <div className="space-y-4">
          {groupedOrders.map((group) => {
            const groupKey = `${group.tableNumber}__${group.customerPhone || 'NO_PHONE'}`;
            const unpaidOrders = group.orders.filter((o) => o.paymentStatus === 'UNPAID');
            const groupTotal = group.orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
            return (
              <Card key={groupKey} className="glass-grid-card p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold">Table {group.tableNumber}</h3>
                    <p className="text-sm text-muted-foreground">
                      Mobile: {group.customerPhone || '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {group.orders.length} order(s) in this group
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">${groupTotal.toFixed(2)}</div>
                    {group.customerPhone && unpaidOrders.length > 0 && (
                      <Button
                        className="mt-2"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          generateFinalBill({
                            tableNumber: group.tableNumber,
                            customerPhone: group.customerPhone,
                          })
                        }
                        disabled={billLoadingKey === groupKey}
                      >
                        <ReceiptText className="w-4 h-4 mr-1" />
                        {billLoadingKey === groupKey ? 'Generating...' : 'Generate Final Bill'}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {group.orders.map((order) => (
                    <div key={order.id} className="rounded-lg border bg-white p-3">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">Order #{order.id}</span>
                            <Badge className={STATUS_COLORS[order.status as keyof typeof STATUS_COLORS]}>
                              {order.status}
                            </Badge>
                            <Badge className={PAYMENT_COLORS[order.paymentStatus as keyof typeof PAYMENT_COLORS]}>
                              {order.paymentStatus}
                            </Badge>
                          </div>
                          <p className="text-xs font-semibold text-primary mt-1">Billing Ref: {billingRef(order)}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(order.createdAt), 'MMM dd, yyyy • h:mm a')}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">${Number(order.total || 0).toFixed(2)}</div>
                          {order.paymentStatus === 'UNPAID' && (
                            <Button size="sm" className="mt-2" onClick={() => markAsPaid(order.id)}>
                              Mark Paid
                            </Button>
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
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}

          {groupedOrders.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No orders found</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={Boolean(billPreview)} onOpenChange={(open) => !open && setBillPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Final Bill</DialogTitle>
            <DialogDescription>
              {billPreview ? `Table ${billPreview.tableNumber} • Phone ${billPreview.phone}` : ''}
            </DialogDescription>
          </DialogHeader>

          {billPreview && (
            <div className="space-y-2 text-sm">
              {billPreview.orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span>Order #{o.id}</span>
                  <span className="font-semibold">${Number(o.total || 0).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t pt-2">
                <span className="font-semibold">Grand Total</span>
                <span className="text-lg font-bold">${Number(billPreview.total || 0).toFixed(2)}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBillPreview(null)} disabled={markingGroupPaid}>
              Close
            </Button>
            <Button onClick={markBillPaid} disabled={markingGroupPaid || !billPreview}>
              {markingGroupPaid ? 'Marking...' : 'Mark All as Paid'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
