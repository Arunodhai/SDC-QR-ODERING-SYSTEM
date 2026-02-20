import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ChevronDown, ChevronUp, Filter, ReceiptText } from 'lucide-react';
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
  COMPLETED: 'bg-blue-100 text-blue-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const PAYMENT_COLORS = {
  PAID: 'bg-green-100 text-green-800',
  UNPAID: 'bg-orange-100 text-orange-800',
};
const statusLabel = (status: string) => (status === 'COMPLETED' ? 'SERVED' : status);

const billingRef = (order: any) => {
  const phone = order.customerPhone || '';
  const last4 = phone ? phone.slice(-4) : '0000';
  return `T${order.tableNumber}-P${last4}-O${order.id}`;
};

export default function AdminOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [finalBills, setFinalBills] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [billPreview, setBillPreview] = useState<{
    id?: string;
    tableNumber: number;
    phone: string;
    lineItems: Array<{ name: string; quantity: number; unitPrice: number; lineTotal: number }>;
    orderIds: string[];
    total: number;
    isPaid?: boolean;
    createdAt?: string;
  } | null>(null);
  const [billLoadingKey, setBillLoadingKey] = useState<string>('');
  const [markingGroupPaid, setMarkingGroupPaid] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

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
      const [ordersRes, billsRes] = await Promise.all([
        api.getOrders(),
        api.getFinalBills().catch((err) => {
          console.warn('Final bills not available for session split fallback:', err);
          return { bills: [] };
        }),
      ]);
      setOrders(ordersRes.orders);
      setFinalBills(billsRes.bills || []);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const markGroupPaid = async (group: { tableNumber: number; customerPhone: string }, ordersToPay: any[]) => {
    try {
      // Reuse currently generated preview bill when possible to avoid duplicate bill snapshots.
      if (
        billPreview?.id &&
        !billPreview.isPaid &&
        billPreview.tableNumber === group.tableNumber &&
        billPreview.phone === group.customerPhone
      ) {
        await api.markFinalBillPaid(billPreview.id);
      } else {
        // Ensure payment is tracked in final_bills (for customer paid history), then mark paid.
        const generated = await api.generateFinalBillByTableAndPhone(group.tableNumber, group.customerPhone);
        if (generated.bill?.id) {
          await api.markFinalBillPaid(generated.bill.id);
        } else {
          const ids = (ordersToPay || []).map((o: any) => String(o.id));
          await api.markOrdersPaidBulk(ids);
        }
      }
      toast.success('Group marked as paid');
      setBillPreview(null);
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
    const map = new Map<string, { tableNumber: number; customerPhone: string; customerName: string; orders: any[] }>();
    sorted.forEach((order) => {
      const baseKey = `${order.tableNumber}__${order.customerPhone || 'NO_PHONE'}`;
      if (!map.has(baseKey)) {
        map.set(baseKey, {
          tableNumber: order.tableNumber,
          customerPhone: order.customerPhone || '',
          customerName: order.customerName || 'Guest',
          orders: [],
        });
      }
      map.get(baseKey)!.orders.push(order);
    });
    const sessionized: Array<{
      tableNumber: number;
      customerPhone: string;
      customerName: string;
      sessionIndex: number;
      orders: any[];
      startedAt: string;
      endedAt: string;
    }> = [];

    Array.from(map.values()).forEach((group) => {
      const ordered = [...group.orders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const paidBills = (finalBills || []).filter(
        (b: any) => b.isPaid && b.tableNumber === group.tableNumber && (b.customerPhone || '') === (group.customerPhone || ''),
      );

      let sessionIndex = 1;
      let currentSession: any[] = [];

      if (paidBills.length > 0) {
        const orderById = new Map(ordered.map((o) => [String(o.id), o]));
        const sessionBoundaryOrderIds = new Set<string>();

        paidBills.forEach((bill: any) => {
          const billOrders = (bill.orderIds || [])
            .map((id: string) => orderById.get(String(id)))
            .filter(Boolean)
            .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          const lastOrderInBill = billOrders[billOrders.length - 1];
          if (lastOrderInBill) {
            sessionBoundaryOrderIds.add(String(lastOrderInBill.id));
          }
        });

        for (let i = 0; i < ordered.length; i++) {
          const current = ordered[i];
          currentSession.push(current);
          const shouldCloseSession =
            i < ordered.length - 1 && sessionBoundaryOrderIds.has(String(current.id));
          if (shouldCloseSession) {
            sessionized.push({
              tableNumber: group.tableNumber,
              customerPhone: group.customerPhone,
              customerName: group.customerName,
              sessionIndex,
              orders: currentSession,
              startedAt: currentSession[0].createdAt,
              endedAt: currentSession[currentSession.length - 1].createdAt,
            });
            sessionIndex += 1;
            currentSession = [];
          }
        }
      } else {
        // Fallback for legacy data without final_bills.
        for (let i = 0; i < ordered.length; i++) {
          const current = ordered[i];
          const startNew =
            i > 0 &&
            current.paymentStatus === 'UNPAID' &&
            current.status !== 'CANCELLED' &&
            currentSession.some((o) => o.paymentStatus === 'PAID');
          if (startNew && currentSession.length > 0) {
            sessionized.push({
              tableNumber: group.tableNumber,
              customerPhone: group.customerPhone,
              customerName: group.customerName,
              sessionIndex,
              orders: currentSession,
              startedAt: currentSession[0].createdAt,
              endedAt: currentSession[currentSession.length - 1].createdAt,
            });
            sessionIndex += 1;
            currentSession = [];
          }
          currentSession.push(current);
        }
      }

      if (currentSession.length > 0) {
        sessionized.push({
          tableNumber: group.tableNumber,
          customerPhone: group.customerPhone,
          customerName: group.customerName,
          sessionIndex,
          orders: currentSession,
          startedAt: currentSession[0].createdAt,
          endedAt: currentSession[currentSession.length - 1].createdAt,
        });
      }
    });

    return sessionized.sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime());
  }, [filteredOrders, finalBills]);

  const generateFinalBill = async (group: { tableNumber: number; customerPhone: string }) => {
    if (!group.customerPhone) {
      toast.error('Customer mobile number is missing for this group.');
      return;
    }

    const key = `${group.tableNumber}__${group.customerPhone}`;
    setBillLoadingKey(key);
    try {
      const res = await api.generateFinalBillByTableAndPhone(group.tableNumber, group.customerPhone);
      if (!res.bill) {
        toast.info('No unpaid orders found for this customer at this table.');
        return;
      }
      setBillPreview({
        id: res.bill.id,
        tableNumber: res.bill.tableNumber,
        phone: res.bill.customerPhone,
        lineItems: res.bill.lineItems || [],
        orderIds: res.bill.orderIds || [],
        total: res.bill.total,
        isPaid: res.bill.isPaid,
        createdAt: res.bill.createdAt,
      });
    } catch (error) {
      console.error('Error generating combined bill:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate combined bill');
    } finally {
      setBillLoadingKey('');
    }
  };

  const markBillPaid = async () => {
    if (!billPreview || !billPreview.id) return;
    setMarkingGroupPaid(true);
    try {
      await api.markFinalBillPaid(billPreview.id);
      toast.success('Final bill marked as paid.');
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

        <div className="columns-1 xl:columns-2 2xl:columns-3 gap-4 [column-fill:_balance]">
          {groupedOrders.map((group) => {
            const groupKey = `${group.tableNumber}__${group.customerPhone || 'NO_PHONE'}__${group.startedAt}`;
            const loadingKey = `${group.tableNumber}__${group.customerPhone || ''}`;
            const unpaidOrders = group.orders.filter((o) => o.paymentStatus === 'UNPAID' && o.status !== 'CANCELLED');
            const groupTotal = group.orders
              .filter((o) => o.status !== 'CANCELLED')
              .reduce((sum, o) => sum + Number(o.total || 0), 0);
            const isExpanded = Boolean(expandedGroups[groupKey]);
            return (
              <Card key={groupKey} className="glass-grid-card p-4 h-fit mb-4 break-inside-avoid">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold">Table {group.tableNumber}</h3>
                    <p className="text-sm text-muted-foreground">
                      Name: {group.customerName || 'Guest'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Mobile: {group.customerPhone || '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {group.orders.length} round(s) • {format(new Date(group.startedAt), 'MMM dd, yyyy • h:mm a')}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">${groupTotal.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">Payable (excludes cancelled)</div>
                    {group.customerPhone && unpaidOrders.length > 0 && (
                      <div className="mt-2 flex flex-col items-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            generateFinalBill({
                              tableNumber: group.tableNumber,
                              customerPhone: group.customerPhone,
                            })
                          }
                          disabled={billLoadingKey === loadingKey}
                        >
                          <ReceiptText className="w-4 h-4 mr-1" />
                          {billLoadingKey === loadingKey ? 'Generating...' : 'Generate Final Bill'}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            markGroupPaid(
                              { tableNumber: group.tableNumber, customerPhone: group.customerPhone },
                              unpaidOrders,
                            )
                          }
                        >
                          Mark as Paid
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-3 flex items-center justify-between rounded-lg border bg-white px-3 py-2">
                  <p className="text-sm text-muted-foreground">
                    {group.orders.length} round(s) hidden
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setExpandedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))
                    }
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-1" />
                        Collapse
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-1" />
                        Expand
                      </>
                    )}
                  </Button>
                </div>

                {isExpanded && (
                  <div className="space-y-3">
                    {group.orders.map((order, idx) => (
                      <div key={order.id} className="rounded-lg border bg-white p-3">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">Round {idx + 1}</span>
                              <span className="text-xs text-muted-foreground">Order #{order.id}</span>
                              <Badge className={STATUS_COLORS[order.status as keyof typeof STATUS_COLORS]}>
                                {statusLabel(order.status)}
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
                            {order.status === 'CANCELLED' ? (
                              <div>
                                <div className="font-bold text-red-700">$0.00</div>
                                <div className="text-xs text-red-600">Cancelled (excluded)</div>
                              </div>
                            ) : (
                              <div className="font-bold">${Number(order.total || 0).toFixed(2)}</div>
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
                )}
              </Card>
            );
          })}

          {groupedOrders.length === 0 && (
            <div className="text-center py-12 text-muted-foreground col-span-full">
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
              {billPreview.lineItems.map((item, idx) => (
                <div key={`${item.name}_${idx}`} className="rounded-md border px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{item.name}</span>
                    <span className="font-semibold">${Number(item.lineTotal || 0).toFixed(2)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.quantity} x ${Number(item.unitPrice || 0).toFixed(2)}</span>
                    <span>Line total</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t pt-2">
                <span className="font-semibold">Grand Total</span>
                <span className="text-lg font-bold">${Number(billPreview.total || 0).toFixed(2)}</span>
              </div>
              {billPreview.createdAt && (
                <p className="text-xs text-muted-foreground">
                  Generated at {format(new Date(billPreview.createdAt), 'MMM dd, yyyy • h:mm a')}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBillPreview(null)} disabled={markingGroupPaid}>
              Close
            </Button>
            <Button onClick={markBillPaid} disabled={markingGroupPaid || !billPreview || billPreview.isPaid}>
              {markingGroupPaid ? 'Marking...' : billPreview?.isPaid ? 'Already Paid' : 'Mark All as Paid'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
