import { CheckCircle, Coffee, Clock3, ChefHat, PartyPopper } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import * as api from '../lib/api';

const STATUS_STEPS = ['PENDING', 'PREPARING', 'READY', 'COMPLETED'] as const;

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  PREPARING: 'Preparing',
  READY: 'Ready for pickup/serve',
  COMPLETED: 'Completed',
};

export default function OrderSuccessPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') || '';
  const table = searchParams.get('table') || '';
  const phone = searchParams.get('phone') || '';
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
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
  }, [orderId]);

  const status = order?.status || 'PENDING';
  const activeStep = Math.max(STATUS_STEPS.indexOf(status), 0);
  const statusIcon = useMemo(() => {
    if (status === 'PENDING') return <Clock3 className="w-18 h-18 text-amber-500 mx-auto mb-4" />;
    if (status === 'PREPARING') return <ChefHat className="w-18 h-18 text-blue-600 mx-auto mb-4" />;
    if (status === 'READY') return <PartyPopper className="w-18 h-18 text-green-600 mx-auto mb-4" />;
    return <CheckCircle className="w-18 h-18 text-green-600 mx-auto mb-4" />;
  }, [status]);

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
            <span className="font-semibold">{STATUS_LABELS[status] || status}</span>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-sm font-semibold">Progress</div>
          <div className="grid grid-cols-4 gap-2">
            {STATUS_STEPS.map((step, idx) => (
              <div
                key={step}
                className={`rounded-md border px-2 py-2 text-center text-xs ${
                  idx <= activeStep ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground'
                }`}
              >
                {STATUS_LABELS[step]}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-sm font-semibold">Items</div>
          {loading && <p className="text-sm text-muted-foreground">Loading order details...</p>}
          {!loading && error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && !error && order?.items?.length > 0 && (
            <div className="space-y-2">
              {order.items.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>{item.quantity}x {item.name}</span>
                  <span className="font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1 text-sm">
                <span className="font-semibold">Total</span>
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
            to={table ? `/table/${table}${phone ? `?phone=${encodeURIComponent(phone)}` : ''}` : '/'}
            className="text-sm text-primary underline"
          >
            Back to menu
          </Link>
        </div>
      </div>
    </div>
  );
}
