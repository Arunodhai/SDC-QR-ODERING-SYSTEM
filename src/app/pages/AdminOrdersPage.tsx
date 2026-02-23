import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Banknote, ChevronDown, CreditCard, Filter, Printer, ReceiptText, Smartphone } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import * as api from '../lib/api';

const STATUS_COLORS = {
  PENDING: 'bg-red-100 text-red-800',
  PREPARING: 'bg-yellow-100 text-yellow-800',
  READY: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-[#00FA9A] text-black',
  CANCELLED: 'bg-red-100 text-red-800',
  REJECTED: 'bg-red-100 text-red-800',
  OUT_OF_STOCK: 'bg-red-100 text-red-800',
};

const PAYMENT_COLORS = {
  PAID: 'bg-green-100 text-green-800 !rounded-sm',
  UNPAID: 'bg-orange-100 text-orange-800 !rounded-sm',
  CANCELLED: 'bg-red-100 text-red-800 !rounded-sm',
};
type PaymentMethod = 'CASH' | 'UPI' | 'CARD';
const statusLabel = (status: string) => {
  if (status === 'COMPLETED') return 'SERVED';
  if (status === 'OUT_OF_STOCK' || status === 'REJECTED') return 'CANCELLED';
  return status;
};
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  COUNTER: 'Cash',
  CASH: 'Cash',
  UPI: 'UPI',
  CARD: 'Card',
  UNKNOWN: '-',
};
const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string; icon: any }> = [
  { value: 'CASH', label: 'Cash', icon: Banknote },
  { value: 'UPI', label: 'UPI', icon: Smartphone },
  { value: 'CARD', label: 'Card', icon: CreditCard },
];

  const billingRef = (order: any) => {
  const phone = order.customerPhone || '';
  const last4 = phone ? phone.slice(-4) : '0000';
  return `T${order.tableNumber}-P${last4}-O${order.id}`;
};

const getPaymentMethodLabel = (paymentMethod?: string) =>
  PAYMENT_METHOD_LABELS[String(paymentMethod || '').toUpperCase()] || String(paymentMethod || '-');

export default function AdminOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [finalBills, setFinalBills] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');
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
  const [selectedGroupDetails, setSelectedGroupDetails] = useState<any | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('CASH');
  const [pendingPaymentTarget, setPendingPaymentTarget] = useState<
    | { type: 'GROUP'; group: { tableNumber: number; customerPhone: string }; ordersToPay: any[] }
    | { type: 'BILL'; billId: string }
    | null
  >(null);
  const [unavailableMenuIds, setUnavailableMenuIds] = useState<Set<string>>(new Set());
  const [unavailableMenuNames, setUnavailableMenuNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let unsubscribe: (() => void) | null = null;
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
        unsubscribe = api.subscribeToOrderChanges(() => loadOrders());
      } catch (error) {
        console.error('Session check failed:', error);
        navigate('/admin/login');
      }
    })();

    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
      if (unsubscribe) unsubscribe();
    };
  }, [navigate]);

  const printBill = (bill: {
    id?: string;
    tableNumber: number;
    phone: string;
    lineItems: Array<{ name: string; quantity: number; unitPrice: number; lineTotal: number }>;
    total: number;
    createdAt?: string;
  }) => {
    const rows = (bill.lineItems || [])
      .map(
        (item) =>
          `<tr>
            <td style="padding:8px;border-bottom:1px solid #ddd">${item.name}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center">${item.quantity}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">$${Number(item.unitPrice || 0).toFixed(2)}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">$${Number(item.lineTotal || 0).toFixed(2)}</td>
          </tr>`,
      )
      .join('');

    const html = `
      <html>
        <head><title>Final Bill</title></head>
        <body style="font-family:Arial,sans-serif;padding:20px;color:#111">
          <h2 style="margin:0 0 8px">Stories de Café - Final Bill</h2>
          <p style="margin:0 0 4px">Bill ID: #${bill.id || '-'}</p>
          <p style="margin:0 0 4px">Table: ${bill.tableNumber}</p>
          <p style="margin:0 0 4px">Mobile: ${bill.phone || '-'}</p>
          <p style="margin:0 0 14px">Generated: ${bill.createdAt ? format(new Date(bill.createdAt), 'MMM dd, yyyy • h:mm a') : '-'}</p>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr>
                <th style="text-align:left;padding:8px;border-bottom:1px solid #333">Item</th>
                <th style="text-align:center;padding:8px;border-bottom:1px solid #333">Qty</th>
                <th style="text-align:right;padding:8px;border-bottom:1px solid #333">Price</th>
                <th style="text-align:right;padding:8px;border-bottom:1px solid #333">Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <h3 style="text-align:right;margin-top:16px">Grand Total: $${Number(bill.total || 0).toFixed(2)}</h3>
        </body>
      </html>
    `;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const printSelectedGroupDetails = (group: any) => {
    if (!group) return;
    const activeOrders = (group.orders || []).filter((o: any) => o.status !== 'CANCELLED');
    if (!activeOrders.length) {
      toast.info('No payable items to print for this order group.');
      return;
    }
    const lineItemsMap = new Map<string, { name: string; quantity: number; unitPrice: number; lineTotal: number }>();
    activeOrders.forEach((order: any) => {
      (order.items || [])
        .filter((item: any) => !item.isCancelled)
        .forEach((item: any) => {
          const key = `${item.name}__${Number(item.price || 0)}`;
          const current = lineItemsMap.get(key) || {
            name: item.name,
            quantity: 0,
            unitPrice: Number(item.price || 0),
            lineTotal: 0,
          };
          const qty = Number(item.quantity || 0);
          const unit = Number(item.price || 0);
          current.quantity += qty;
          current.lineTotal += qty * unit;
          lineItemsMap.set(key, current);
        });
    });

    const lineItems = Array.from(lineItemsMap.values());
    const total = lineItems.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
    printBill({
      id: undefined,
      tableNumber: Number(group.tableNumber),
      phone: group.customerPhone || '',
      lineItems,
      total,
      createdAt: group.startedAt,
    });
  };

  const loadOrders = async () => {
    try {
      const [ordersRes, billsRes, menuRes] = await Promise.all([
        api.getOrders(),
        api.getFinalBills().catch((err) => {
          console.warn('Final bills not available for session split fallback:', err);
          return { bills: [] };
        }),
        api.getMenuItems().catch(() => ({ items: [] })),
      ]);
      setOrders(ordersRes.orders);
      setFinalBills(billsRes.bills || []);
      const unavailableItems = (menuRes.items || []).filter((item: any) => !item.available);
      setUnavailableMenuIds(new Set(unavailableItems.map((item: any) => String(item.id))));
      setUnavailableMenuNames(
        new Set(
          unavailableItems
            .map((item: any) =>
              String(item.name || '')
                .replace(/\s*\(Note:.*\)\s*$/i, '')
                .trim()
                .toLowerCase(),
            )
            .filter(Boolean),
        ),
      );
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const hasUnavailableItemsInOrder = (order: any) => {
    return (order.items || []).some((item: any) => {
      if (item.isCancelled) return false;
      const idMatch = item.menuItemId && unavailableMenuIds.has(String(item.menuItemId));
      const normalizedName = String(item.name || '')
        .replace(/\s*\(Note:.*\)\s*$/i, '')
        .trim()
        .toLowerCase();
      const nameMatch = normalizedName ? unavailableMenuNames.has(normalizedName) : false;
      return idMatch || nameMatch;
    });
  };

  const markGroupPaid = async (
    group: { tableNumber: number; customerPhone: string },
    ordersToPay: any[],
    paymentMethod: PaymentMethod,
  ) => {
    try {
      let result: any = null;
      // Reuse currently generated preview bill when possible to avoid duplicate bill snapshots.
      if (
        billPreview?.id &&
        !billPreview.isPaid &&
        billPreview.tableNumber === group.tableNumber &&
        billPreview.phone === group.customerPhone
      ) {
        result = await api.markFinalBillPaid(billPreview.id, paymentMethod);
      } else {
        // Ensure payment is tracked in final_bills (for customer paid history), then mark paid.
        const generated = await api.generateFinalBillByTableAndPhone(group.tableNumber, group.customerPhone);
        if (generated.bill?.id) {
          result = await api.markFinalBillPaid(generated.bill.id, paymentMethod);
        } else {
          const ids = (ordersToPay || []).map((o: any) => String(o.id));
          result = await api.markOrdersPaidBulk(ids, paymentMethod);
        }
      }
      const storedMethod = (result as any)?.storedMethod || paymentMethod;
      toast.success(`Group marked as paid via ${getPaymentMethodLabel(storedMethod)}`);
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
        if (filterDate) {
          const orderDate = new Date(order.createdAt);
          const y = orderDate.getFullYear();
          const m = String(orderDate.getMonth() + 1).padStart(2, '0');
          const d = String(orderDate.getDate()).padStart(2, '0');
          const key = `${y}-${m}-${d}`;
          if (key !== filterDate) return false;
        }
        if (filter === 'all') return true;
        if (filter === 'today') {
          const today = new Date().toDateString();
          return new Date(order.createdAt).toDateString() === today;
        }
        if (filter === 'UNPAID') {
          return order.paymentStatus === 'UNPAID' && order.status !== 'CANCELLED';
        }
        return order.paymentStatus === filter;
      }),
    [orders, filter, filterDate],
  );

  const markOrderUnavailable = async (orderId: string) => {
    try {
      const res = await api.applyUnavailableItemsToOrder(orderId);
      if (!res.unavailableItems.length) {
        toast.info('No unavailable items found in this order.');
      } else if (res.allItemsUnavailable) {
        toast.warning(`All items unavailable. Order cancelled: ${res.unavailableItems.join(', ')}`);
      } else {
        toast.success(`Removed unavailable item(s): ${res.unavailableItems.join(', ')}`);
      }
      setSelectedGroupDetails(null);
      await loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to apply unavailable items');
    }
  };

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
          const shouldSplitAfterCancelledOnlySession =
            currentSession.length > 0 &&
            current.status !== 'CANCELLED' &&
            currentSession.every((o) => o.status === 'CANCELLED');
          if (shouldSplitAfterCancelledOnlySession) {
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
          const shouldSplitAfterCancelledOnlySession =
            currentSession.length > 0 &&
            current.status !== 'CANCELLED' &&
            currentSession.every((o) => o.status === 'CANCELLED');
          if (shouldSplitAfterCancelledOnlySession) {
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

  const markBillPaid = async (paymentMethod: PaymentMethod) => {
    if (!billPreview || !billPreview.id) return;
    setMarkingGroupPaid(true);
    try {
      const result = await api.markFinalBillPaid(billPreview.id, paymentMethod);
      const storedMethod = (result as any)?.storedMethod || paymentMethod;
      toast.success(`Final bill marked as paid via ${getPaymentMethodLabel(storedMethod)}.`);
      setBillPreview(null);
      loadOrders();
    } catch (error) {
      console.error('Error marking grouped orders as paid:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to mark grouped orders as paid');
    } finally {
      setMarkingGroupPaid(false);
    }
  };

  const startGroupPayment = (group: { tableNumber: number; customerPhone: string }, ordersToPay: any[]) => {
    setPendingPaymentTarget({ type: 'GROUP', group, ordersToPay });
    setSelectedPaymentMethod('CASH');
    setPaymentDialogOpen(true);
  };

  const startBillPayment = (billId: string) => {
    setPendingPaymentTarget({ type: 'BILL', billId });
    setSelectedPaymentMethod('CASH');
    setPaymentDialogOpen(true);
  };

  const confirmPayment = async () => {
    if (!pendingPaymentTarget) return;
    setPaymentDialogOpen(false);
    if (pendingPaymentTarget.type === 'GROUP') {
      await markGroupPaid(
        pendingPaymentTarget.group,
        pendingPaymentTarget.ordersToPay,
        selectedPaymentMethod,
      );
      return;
    }
    await markBillPaid(selectedPaymentMethod);
  };

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="page-shell bg-transparent">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Card className="sdc-header-card mb-6 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
                <span className="relative inline-flex h-3 w-3 items-center justify-center rounded-full border border-black">
                  <span className="live-dot-blink h-1.5 w-1.5 rounded-full bg-red-500" />
                </span>
                Live Orders
              </p>
              <h2 className="mt-1 text-[2rem] font-semibold tracking-tight text-slate-900">Orders</h2>
              <p className="mt-1 text-sm text-slate-500">Track payment groups, session rounds, and bill status in one view.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <div className="inline-flex items-center gap-2 rounded-xl bg-white/50 px-2 py-1.5">
                <Filter className="h-4 w-4 text-slate-500" />
                <Select
                  value={filter}
                  onValueChange={(value) => {
                    setFilter(value);
                    if (value === 'today') setFilterDate('');
                  }}
                >
                  <SelectTrigger className="h-8 w-40 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0">
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

              {filter !== 'today' && (
                <>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="h-10 w-[178px] rounded-xl border-0 bg-white/50 px-3 text-sm text-slate-800 shadow-none outline-none ring-0 focus:outline-none focus:ring-0"
                    aria-label="Filter by date"
                  />
                  {filterDate && (
                    <Button variant="outline" size="sm" className="h-10 rounded-lg" onClick={() => setFilterDate('')}>
                      Clear Date
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groupedOrders.map((group) => {
            const groupKey = `${group.tableNumber}__${group.customerPhone || 'NO_PHONE'}__${group.startedAt}`;
            const loadingKey = `${group.tableNumber}__${group.customerPhone || ''}`;
            const payableOrders = group.orders.filter((o) => o.status !== 'CANCELLED');
            const unpaidOrders = payableOrders.filter((o) => o.paymentStatus === 'UNPAID');
            const groupTotal = payableOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
            const groupPaymentStatus =
              payableOrders.length === 0 && group.orders.some((o) => o.status === 'CANCELLED')
                ? 'CANCELLED'
                : payableOrders.length > 0 && payableOrders.every((o) => o.paymentStatus === 'PAID')
                  ? 'PAID'
                  : 'UNPAID';
            const groupPaidMethods = Array.from(
              new Set(
                payableOrders
                  .filter((o) => o.paymentStatus === 'PAID')
                  .map((o) => getPaymentMethodLabel(o.paymentMethod)),
              ),
            );
            const groupPaymentMethodLabel =
              groupPaymentStatus === 'PAID'
                ? groupPaidMethods.length > 1
                  ? `Mixed (${groupPaidMethods.join(', ')})`
                  : groupPaidMethods[0] || '-'
                : '-';
            return (
              <Card key={groupKey} className="sdc-panel-card h-fit p-3">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[1.6rem] leading-none font-semibold tracking-tight text-slate-900">Table {group.tableNumber}</h3>
                    <p className="mt-1.5 text-sm text-slate-500">
                      Name: {group.customerName || 'Guest'}
                    </p>
                    <p className="text-sm text-slate-500">
                      Mobile: {group.customerPhone || '-'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {group.orders.length} round(s) • {format(new Date(group.startedAt), 'MMM dd, yyyy • h:mm a')}
                    </p>
                  </div>
                  <div className="text-right min-w-[165px] shrink-0">
                    <div className="text-[1.7rem] leading-none font-semibold text-slate-900">${groupTotal.toFixed(2)}</div>
                    <div className="mt-1 text-xs text-slate-500">Payable (excludes cancelled)</div>
                    <div className="mt-1 flex justify-end">
                      <Badge className={PAYMENT_COLORS[groupPaymentStatus as keyof typeof PAYMENT_COLORS]}>
                        {groupPaymentStatus === 'PAID'
                          ? `PAID via ${groupPaymentMethodLabel}`
                          : groupPaymentStatus === 'CANCELLED'
                            ? 'CANCELLED'
                            : 'UNPAID'}
                      </Badge>
                    </div>
                    {group.customerPhone && unpaidOrders.length > 0 && (
                      <div className="mt-2 flex flex-col items-end gap-2">
                        <Button
                          size="sm"
                          className="h-7 rounded-lg px-2.5 text-[11px]"
                          onClick={() =>
                            startGroupPayment(
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

                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    {group.customerPhone && unpaidOrders.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-lg px-2 text-[11px]"
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
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-lg px-2 text-[11px]"
                    onClick={() =>
                      setSelectedGroupDetails({
                        groupKey,
                        tableNumber: group.tableNumber,
                        customerName: group.customerName,
                        customerPhone: group.customerPhone,
                        startedAt: group.startedAt,
                        total: groupTotal,
                        orders: group.orders,
                        paymentStatus: groupPaymentStatus,
                        paymentMethodSummary: groupPaymentMethodLabel,
                        paidAt:
                          groupPaymentStatus === 'PAID'
                            ? (() => {
                                const groupOrderIds = group.orders.map((o: any) => String(o.id));
                                const matchedPaidBills = (finalBills || []).filter((b: any) =>
                                  b.isPaid &&
                                  (b.orderIds || []).some((id: any) => groupOrderIds.includes(String(id))),
                                );
                                if (!matchedPaidBills.length) return null;
                                const latestPaid = [...matchedPaidBills].sort(
                                  (a: any, b: any) =>
                                    new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime(),
                                )[0];
                                return latestPaid?.paidAt || latestPaid?.createdAt || null;
                              })()
                            : null,
                      })
                    }
                  >
                    <ChevronDown className="w-4 h-4 mr-1" />
                    View Details
                  </Button>
                </div>
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
            <Button variant="outline" onClick={() => billPreview && printBill(billPreview)} disabled={!billPreview}>
              <Printer className="w-4 h-4 mr-1" />
              Print Bill
            </Button>
            <Button
              onClick={() => billPreview?.id && startBillPayment(billPreview.id)}
              disabled={markingGroupPaid || !billPreview || billPreview.isPaid}
            >
              {markingGroupPaid ? 'Marking...' : billPreview?.isPaid ? 'Already Paid' : 'Mark All as Paid'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Payment Method</DialogTitle>
            <DialogDescription>
              Choose how this bill was paid before marking it as paid.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PAYMENT_METHOD_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedPaymentMethod === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedPaymentMethod(option.value)}
                  className={`rounded-lg border px-3 py-3 text-left transition ${
                    isSelected
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{option.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmPayment}>
              Confirm & Mark Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedGroupDetails)} onOpenChange={(open) => !open && setSelectedGroupDetails(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Table {selectedGroupDetails?.tableNumber} • Order Details
            </DialogTitle>
            <DialogDescription>
              {selectedGroupDetails
                ? `${selectedGroupDetails.customerName || 'Guest'} • ${selectedGroupDetails.customerPhone || '-'} • ${format(new Date(selectedGroupDetails.startedAt), 'MMM dd, yyyy • h:mm a')}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[65vh] overflow-y-auto space-y-3 pr-1">
            {(selectedGroupDetails?.orders || []).map((order: any, idx: number) => (
                <div key={order.id} className="rounded-lg border bg-white p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Round {idx + 1}</span>
                        <span className="text-xs text-muted-foreground">Order #{order.id}</span>
                        <Badge className={STATUS_COLORS[order.status as keyof typeof STATUS_COLORS]}>
                          {statusLabel(order.status)}
                        </Badge>
                      </div>
                      <p className="text-xs font-semibold text-primary mt-1">Billing Ref: {billingRef(order)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.createdAt), 'MMM dd, yyyy • h:mm a')}
                      </p>
                      {order.statusReason && (
                        <p className="text-xs text-red-600 mt-1">Reason: {order.statusReason}</p>
                      )}
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
                  {order.items.map((item: any, itemIdx: number) => (
                    <div key={itemIdx} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.quantity}x {item.name}
                      </span>
                      <span>${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                {['PENDING', 'PREPARING', 'READY'].includes(order.status) && hasUnavailableItemsInOrder(order) && (
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50"
                      onClick={() => markOrderUnavailable(order.id)}
                    >
                      Apply unavailable items
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {selectedGroupDetails?.paymentStatus === 'PAID' && selectedGroupDetails?.paidAt ? (
            <p className="text-sm text-green-700">
              Payment: PAID via {selectedGroupDetails?.paymentMethodSummary || '-'} on{' '}
              {format(new Date(selectedGroupDetails.paidAt), 'MMM dd, yyyy • h:mm a')}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => printSelectedGroupDetails(selectedGroupDetails)}
            >
              <Printer className="w-4 h-4 mr-1" />
              Print Bill
            </Button>
            <Button variant="outline" onClick={() => setSelectedGroupDetails(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
