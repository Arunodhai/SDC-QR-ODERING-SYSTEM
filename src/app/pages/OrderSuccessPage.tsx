import { CheckCircle, Coffee, Clock3, ChefHat, PartyPopper } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import * as api from '../lib/api';
import { Button } from '../components/ui/button';

const STATUS_STEPS = ['PENDING', 'PREPARING', 'READY', 'COMPLETED'] as const;

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  PREPARING: 'Preparing',
  READY: 'Ready for pickup/serve',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_PROGRESS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  PREPARING: 'Preparing',
  READY: 'Ready',
  COMPLETED: 'Done',
};

const STATUS_TEXT_COLORS: Record<string, string> = {
  PENDING: 'text-amber-600',
  PREPARING: 'text-blue-600',
  READY: 'text-green-600',
  COMPLETED: 'text-indigo-600',
  CANCELLED: 'text-red-600',
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

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [orderId, table, phone, cancelled]);

  const status = cancelled ? 'CANCELLED' : (order?.status || 'PENDING');
  const activeStep = Math.max(STATUS_STEPS.indexOf(status), 0);
  const statusIcon = useMemo(() => {
    if (status === 'CANCELLED') return <CheckCircle className="w-18 h-18 text-gray-500 mx-auto mb-4" />;
    if (status === 'PENDING') return <Clock3 className="w-18 h-18 text-amber-500 mx-auto mb-4" />;
    if (status === 'PREPARING') return <ChefHat className="w-18 h-18 text-blue-600 mx-auto mb-4" />;
    if (status === 'READY') return <PartyPopper className="w-18 h-18 text-green-600 mx-auto mb-4" />;
    return <CheckCircle className="w-18 h-18 text-green-600 mx-auto mb-4" />;
  }, [status]);

  const cancelOrder = async () => {
    if (!orderId) return;
    const ok = window.confirm('Cancel this order? This is only possible while it is pending.');
    if (!ok) return;

    setCancelLoading(true);
    try {
      await api.cancelPendingOrder(orderId, phone || undefined);
      setCancelled(true);
      setOrder((prev: any) => ({ ...(prev || {}), status: 'CANCELLED' }));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div className="page-shell flex items-center justify-center p-4">
      <div className="max-w-xl w-full rounded-2xl border bg-card p-6 shadow-lg">
        <div className="text-center">
          {statusIcon}
          <h1 className="brand-display text-4xl font-bold mb-2">Order Placed!</h1>
          <p className="text-muted-foreground">
            Track your order status live on this page.
          </p>
        </div>

        <div className="mt-5 rounded-lg border bg-gray-50 p-3 text-sm">
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
          <div className="mt-1 flex items-center justify-between">
            <span className="text-muted-foreground">Billing Ref</span>
            <span className="font-semibold">{billingRef}</span>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-sm font-semibold">Progress</div>
          {status === 'CANCELLED' ? (
            <div className="rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-center font-semibold">
              Order Cancelled
            </div>
          ) : (
          <div className="relative px-1">
            <div className="absolute left-4 right-4 top-3 h-0.5 bg-gray-200" />
            <div
              className="absolute left-4 top-3 h-0.5 bg-primary transition-all duration-300"
              style={{ width: `calc((100% - 2rem) * ${activeStep / (STATUS_STEPS.length - 1)})` }}
            />
            <div className="grid grid-cols-4 gap-1">
            {STATUS_STEPS.map((step, idx) => (
              <div key={step} className="text-center">
                <div
                  className={`mx-auto mb-2 h-6 w-6 rounded-full border-2 ${
                    idx <= activeStep ? 'border-primary bg-primary' : 'border-gray-300 bg-white'
                  }`}
                />
                <div className={`text-[11px] ${idx <= activeStep ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                  {STATUS_PROGRESS_LABELS[step]}
                </div>
              </div>
            ))}
            </div>
          </div>
          )}
        </div>

        {!cancelled && status === 'PENDING' && !loading && !error && (
          <div className="mt-4">
            <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={cancelOrder} disabled={cancelLoading}>
              {cancelLoading ? 'Cancelling...' : 'Cancel Order'}
            </Button>
          </div>
        )}

        <div className="mt-5">
          <div className="mb-2 text-sm font-semibold">Items, Qty, Price</div>
          {loading && <p className="text-sm text-muted-foreground">Loading order details...</p>}
          {!loading && error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && !error && order?.items?.length > 0 && (
            <div className="space-y-2">
              <div className="rounded-md border">
                <div className="grid grid-cols-12 gap-2 border-b bg-gray-50 px-3 py-2 text-xs font-semibold text-muted-foreground">
                  <span className="col-span-6">Item</span>
                  <span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-4 text-right">Price</span>
                </div>
                {order.items.map((item: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm border-b last:border-b-0">
                    <span className="col-span-6">{item.name}</span>
                    <span className="col-span-2 text-center">{item.quantity}</span>
                    <span className="col-span-4 text-right font-semibold">${Number(item.price || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Items Total</span>
                <span className="font-bold">${Number(order.total || 0).toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Coffee className="w-4 h-4" />
          <span>Stories de Café</span>
        </div>

        <div className="mt-3 text-center">
          <Link
            to={
              table
                ? `/table/${table}${
                    phone ? `?phone=${encodeURIComponent(phone)}&returning=1` : ''
                  }`
                : '/'
            }
            className="text-sm text-primary underline"
          >
            Back to menu
          </Link>
        </div>
      </div>
    </div>
  );
}
