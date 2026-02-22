import { CheckCircle, Clock3, ChefHat, PartyPopper, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import * as api from '../lib/api';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import logo12 from '../../assets/logo12.png';

const STATUS_STEPS = ['PENDING', 'PREPARING', 'READY', 'COMPLETED'] as const;

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  PREPARING: 'Preparing',
  READY: 'Ready for pickup/serve',
  COMPLETED: 'Served',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
  OUT_OF_STOCK: 'Out of stock',
};

const STATUS_PROGRESS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  PREPARING: 'Preparing',
  READY: 'Ready',
  COMPLETED: 'Served',
};

const STATUS_TEXT_COLORS: Record<string, string> = {
  PENDING: 'text-amber-600',
  PREPARING: 'text-blue-600',
  READY: 'text-green-600',
  COMPLETED: 'text-indigo-600',
  CANCELLED: 'text-red-600',
  REJECTED: 'text-red-600',
  OUT_OF_STOCK: 'text-red-600',
};

const STATUS_STEP_STYLES: Record<string, { dot: string; ring: string; text: string }> = {
  PENDING: { dot: 'from-amber-300 to-amber-500', ring: 'ring-amber-200/80', text: 'text-amber-700' },
  PREPARING: { dot: 'from-sky-300 to-blue-500', ring: 'ring-blue-200/80', text: 'text-blue-700' },
  READY: { dot: 'from-emerald-300 to-teal-500', ring: 'ring-emerald-200/80', text: 'text-emerald-700' },
  COMPLETED: { dot: 'from-violet-300 to-indigo-500', ring: 'ring-indigo-200/80', text: 'text-indigo-700' },
};

export default function OrderSuccessPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') || '';
  const table = searchParams.get('table') || '';
  const phone = searchParams.get('phone') || '';
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const billingRef =
    `T${table || order?.tableNumber || '-'}-P${phone ? phone.slice(-4) : '0000'}-O${orderId || '-'}`;

  useEffect(() => {
    if (cancelled) {
      setLoading(false);
      return;
    }

    if (!orderId) {
      setLoading(false);
      setError('Missing order reference. Please place a new order from your table page.');
      return;
    }

    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    let unsubscribe: (() => void) | null = null;

    const loadOrder = async () => {
      try {
        const res = await api.getOrderById(orderId);
        if (!mounted) return;
        setOrder(res.order);
        setError('');
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load order status');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadOrder();
    timer = setInterval(loadOrder, 5000);
    unsubscribe = api.subscribeToOrderChanges((payload) => {
      const row = payload?.new || payload?.old;
      if (!row) return;
      if (Number(row.id) !== Number(orderId)) return;
      loadOrder();
    });

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
      if (unsubscribe) unsubscribe();
    };
  }, [orderId, table, phone, cancelled]);

  const status = cancelled ? 'CANCELLED' : (order?.status || 'PENDING');
  const statusReason = order?.statusReason || '';
  const visibleItems = (order?.items || []).filter((item: any) => !item.isCancelled);
  const visibleItemsTotal = visibleItems.reduce(
    (sum: number, item: any) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0,
  );
  const activeStep = Math.max(STATUS_STEPS.indexOf(status), 0);
  const statusIcon = useMemo(() => {
    if (status === 'CANCELLED') return <XCircle className="w-18 h-18 text-red-500 mx-auto mb-4" />;
    if (status === 'PENDING') return <Clock3 className="w-18 h-18 text-amber-500 mx-auto mb-4" />;
    if (status === 'PREPARING') return <ChefHat className="w-18 h-18 text-blue-600 mx-auto mb-4" />;
    if (status === 'READY') return <PartyPopper className="w-18 h-18 text-green-600 mx-auto mb-4" />;
    return <CheckCircle className="w-18 h-18 text-green-600 mx-auto mb-4" />;
  }, [status]);

  const cancelOrder = async () => {
    if (!orderId) return;

    setCancelLoading(true);
    try {
      await api.cancelPendingOrder(orderId, phone || undefined);
      setCancelled(true);
      setOrder((prev: any) => ({ ...(prev || {}), status: 'CANCELLED' }));
      setError('');
      setCancelDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div className="page-shell flex items-center justify-center bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-4">
      <div className="max-w-xl w-full rounded-3xl border border-white/70 bg-white/70 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        <div className="text-center">
          {statusIcon}
          <h1 className="brand-display text-4xl font-bold mb-2">
            {status === 'CANCELLED' ? 'Order Cancelled' : 'Order Placed!'}
          </h1>
          <p className="text-muted-foreground">
            {status === 'CANCELLED'
              ? 'This order cannot be processed. Please place a new order.'
              : 'Track your order status live on this page.'}
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-white/80 bg-white/60 p-4 text-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Order ID</span>
            <span className="font-semibold">#{orderId || '-'}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-muted-foreground">Table</span>
            <span className="font-semibold">{table || order?.tableNumber || '-'}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-muted-foreground">Current Status</span>
            <span className={`font-semibold ${STATUS_TEXT_COLORS[status] || ''}`}>
              {cancelled ? 'Cancelled' : (STATUS_LABELS[status] || status)}
            </span>
          </div>
          {statusReason ? (
            <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
              Reason: {statusReason}
            </div>
          ) : null}
          <div className="mt-1 flex items-center justify-between">
            <span className="text-muted-foreground">Billing Ref</span>
            <span className="font-semibold">{billingRef}</span>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/80 bg-white/60 p-4 backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold">Progress</div>
            {status !== 'CANCELLED' && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                Step {activeStep + 1} / {STATUS_STEPS.length}
              </span>
            )}
          </div>
          {status === 'CANCELLED' ? (
            <div className="rounded-xl border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-center font-semibold text-red-700">
              Order Cancelled
            </div>
          ) : (
          <div className="relative px-2">
            <div className="absolute left-6 right-6 top-5 h-2 rounded-full bg-white/80 shadow-inner" />
            <div
              className="absolute left-6 top-5 h-2 rounded-full bg-gradient-to-r from-amber-400 via-teal-400 to-indigo-500 transition-all duration-500"
              style={{ width: `calc((100% - 3rem) * ${activeStep / (STATUS_STEPS.length - 1)})` }}
            />
            <div className="relative grid grid-cols-4 gap-2">
            {STATUS_STEPS.map((step, idx) => {
              const isActive = idx <= activeStep;
              const stepStyle = STATUS_STEP_STYLES[step];
              return (
              <div key={step} className="text-center">
                <div
                  className={`mx-auto mb-2 mt-1 flex h-10 w-10 items-center justify-center rounded-full ring-4 transition-all ${
                    isActive
                      ? `bg-gradient-to-br ${stepStyle.dot} ${stepStyle.ring} shadow-[0_10px_22px_rgba(15,23,42,0.2)]`
                      : 'bg-white/90 ring-slate-200/80'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${isActive ? 'bg-white/95' : 'bg-slate-300'}`} />
                </div>
                <div className={`text-[11px] font-medium ${isActive ? stepStyle.text : 'text-slate-500'}`}>
                  {STATUS_PROGRESS_LABELS[step]}
                </div>
              </div>
            )})}
            </div>
          </div>
          )}
        </div>

        {!cancelled && status === 'PENDING' && !loading && !error && (
          <div className="mt-4">
            <Button
              variant="outline"
              className="w-full text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setCancelDialogOpen(true)}
              disabled={cancelLoading}
            >
              {cancelLoading ? 'Cancelling...' : 'Cancel Order'}
            </Button>
          </div>
        )}

        <div className="mt-5">
          {loading && <p className="text-sm text-muted-foreground">Loading order details...</p>}
          {!loading && error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && !error && visibleItems.length > 0 && (
            <div className="space-y-2">
              <div className="rounded-xl border border-white/80 bg-white/70 backdrop-blur">
                <div className="grid grid-cols-12 gap-2 border-b bg-white/70 px-3 py-2 text-xs font-semibold text-muted-foreground">
                  <span className="col-span-6">Item</span>
                  <span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-4 text-right">Price</span>
                </div>
                {visibleItems.map((item: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm border-b last:border-b-0">
                    <span className="col-span-6">{item.name}</span>
                    <span className="col-span-2 text-center">{item.quantity}</span>
                    <span className="col-span-4 text-right font-semibold">${Number(item.price || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-12 gap-2 rounded-lg bg-slate-50/80 px-3 py-2 text-sm">
                <span className="col-span-8 font-semibold">Items Total</span>
                <span className="col-span-4 text-right font-bold">${Number(visibleItemsTotal || 0).toFixed(2)}</span>
              </div>
            </div>
          )}
          {!loading && !error && visibleItems.length === 0 && (
            <p className="text-sm text-muted-foreground">No active items remaining in this order.</p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between rounded-xl border border-white/80 bg-white/60 px-3 py-2 text-sm backdrop-blur">
          <div className="flex items-center gap-2 text-muted-foreground">
            <img src={logo12} alt="Stories de Café" className="h-6 w-6 object-contain" />
            <span>Stories de Café</span>
          </div>
          <Link
            to={
              table
                ? `/table/${table}${
                    phone ? `?phone=${encodeURIComponent(phone)}&returning=1` : ''
                  }`
                : '/'
            }
            className="rounded-md border border-black bg-white px-3 py-1.5 font-medium text-black hover:bg-gray-50"
          >
            Back to menu
          </Link>
        </div>
      </div>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this order?</DialogTitle>
            <DialogDescription>
              This is allowed only while the order is in pending state.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={cancelLoading}>
              Keep Order
            </Button>
            <Button variant="destructive" onClick={cancelOrder} disabled={cancelLoading}>
              {cancelLoading ? 'Cancelling...' : 'Yes, Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
