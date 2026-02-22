import { useParams, useNavigate } from 'react-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Minus, ShoppingCart, Coffee, Trash2, ChevronDown, BellRing, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import * as api from '../lib/api';
import { getMenuItemImage } from '../lib/menuImageFallback';
import logo12 from '../../assets/logo12.png';

const STATUS_TEXT_COLORS: Record<string, string> = {
  PENDING: 'text-amber-600',
  PREPARING: 'text-blue-600',
  READY: 'text-green-600',
  COMPLETED: 'text-indigo-600',
  CANCELLED: 'text-red-600',
  REJECTED: 'text-red-600',
  OUT_OF_STOCK: 'text-red-600',
};
const statusLabel = (status: string) => {
  if (status === 'COMPLETED') return 'SERVED';
  if (status === 'OUT_OF_STOCK') return 'OUT OF STOCK';
  if (status === 'REJECTED') return 'REJECTED';
  return status;
};

const customerOrderNote = (reason?: string) => {
  const text = String(reason || '').trim();
  if (!text) return '';
  const unavailableMatch = text.match(/Unavailable item(?:s)? removed:\s*(.+)$/i);
  if (unavailableMatch?.[1]) {
    const names = unavailableMatch[1].trim();
    return `Some items in this order were unavailable and removed${names ? ` (${names})` : ''}.`;
  }
  return text;
};

const sameIdSet = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const aa = [...a].sort();
  const bb = [...b].sort();
  return aa.every((v, i) => v === bb[i]);
};
const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString([], {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};
const getPaymentMethodLabel = (value?: string) => {
  const key = String(value || '').toUpperCase();
  if (key === 'COUNTER' || key === 'CASH') return 'Cash';
  if (key === 'UPI') return 'UPI';
  if (key === 'CARD') return 'Card';
  return key || '-';
};
const orderBillingRef = (order: any) => {
  const phone = order?.customerPhone || '';
  const last4 = phone ? phone.slice(-4) : '0000';
  return `T${order?.tableNumber || '-'}-P${last4}-O${order?.id || '-'}`;
};
const NOTE_PLACEHOLDERS = [
  'e.g. less spicy',
  'e.g. no onion',
  'e.g. less sugar',
  'e.g. extra hot',
  'e.g. no ice',
];

export default function CustomerOrderPage() {
  const { tableNumber } = useParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [phoneConfirmed, setPhoneConfirmed] = useState(false);
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [currentBill, setCurrentBill] = useState<{
    orders: any[];
    total: number;
    lineItems?: Array<{ name: string; quantity: number; unitPrice: number; lineTotal: number }>;
  } | null>(null);
  const [latestFinalBill, setLatestFinalBill] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'bill'>('menu');
  const [paidBillHistory, setPaidBillHistory] = useState<any[]>([]);
  const [expandedPaidBills, setExpandedPaidBills] = useState<Record<string, boolean>>({});
  const [loadingActiveOrders, setLoadingActiveOrders] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [noteHintIndex, setNoteHintIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categoryJump, setCategoryJump] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<{ src: string; name: string } | null>(null);
  const [cartAvailabilityPopup, setCartAvailabilityPopup] = useState<string>('');
  const latestFinalBillIdRef = useRef<string>('');
  const cartRef = useRef<Record<string, number>>({});
  const cartStorageKey = `sdc:cart:${tableNumber || 'unknown'}:${customerPhone || 'guest'}`;
  const roundByOrderId = userOrders
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .reduce((acc: Record<string, number>, order: any, index: number) => {
      acc[String(order.id)] = index + 1;
      return acc;
    }, {});
  const visibleUserOrders = userOrders.filter((o) => o.status !== 'CANCELLED');
  const menuCategories = categories.filter((category) =>
    menuItems.some((item) => String(item.categoryId) === String(category.id)),
  );

  const sanitizeCartByAvailability = useCallback((allItems: any[]) => {
    const allMap = new Map((allItems || []).map((item: any) => [String(item.id), item]));
    const availableSet = new Set(
      (allItems || [])
        .filter((item: any) => item.available)
        .map((item: any) => String(item.id)),
    );
    const currentCart = cartRef.current || {};
    const removedIds = Object.keys(currentCart).filter((itemId) => !availableSet.has(String(itemId)));

    if (!removedIds.length) return;
    const nextCart: Record<string, number> = {};
    Object.entries(currentCart).forEach(([itemId, qty]) => {
      if (availableSet.has(String(itemId))) nextCart[itemId] = qty;
    });
    setCart(nextCart);
    setItemNotes((prev) => {
      const next = { ...prev };
      removedIds.forEach((itemId) => delete next[itemId]);
      return next;
    });
    const removedNames = removedIds.map((id) => {
      const item = allMap.get(String(id));
      return item?.name || `Item ${id}`;
    });
    const message = `Removed unavailable item${removedNames.length > 1 ? 's' : ''}: ${removedNames.join(', ')}`;
    setCartAvailabilityPopup(message);
  }, []);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    loadMenu();
    const params = new URLSearchParams(window.location.search);
    const fromQuery = (params.get('phone') || '').replace(/[^\d]/g, '');
    const returning = params.get('returning') === '1';
    const requestedTab = params.get('tab');
    const validTab = requestedTab === 'menu' || requestedTab === 'cart' || requestedTab === 'bill' ? requestedTab : null;
    const activePhoneKey = `sdc:active_phone:${tableNumber || 'unknown'}`;
    const fallbackPhone = (sessionStorage.getItem(activePhoneKey) || '').replace(/[^\d]/g, '');
    const initialPhone = fromQuery || fallbackPhone;
    const nameKey = `sdc:first_name:${tableNumber || 'unknown'}:${initialPhone}`;
    const storedName = initialPhone ? (sessionStorage.getItem(nameKey) || '') : '';
    if (initialPhone) {
      setCustomerPhone(initialPhone);
      if (storedName) setCustomerName(storedName);
      if ((returning && tableNumber) || (!fromQuery && fallbackPhone)) {
        setPhoneConfirmed(true);
        if (validTab) setActiveTab(validTab);
        loadCustomerData(initialPhone);
      }
    }
    if (!initialPhone && validTab) {
      setActiveTab(validTab);
    }
  }, [tableNumber]);

  useEffect(() => {
    if (!phoneConfirmed || !customerPhone) return;
    try {
      const raw = sessionStorage.getItem(cartStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setCart(parsed.cart || {});
      cartRef.current = parsed.cart || {};
      setItemNotes(parsed.itemNotes || {});
    } catch {
      // ignore corrupted session cart
    }
  }, [phoneConfirmed, customerPhone, cartStorageKey]);

  useEffect(() => {
    if (!phoneConfirmed || !customerPhone) return;
    sessionStorage.setItem(
      cartStorageKey,
      JSON.stringify({
        cart,
        itemNotes,
      }),
    );
  }, [cart, itemNotes, phoneConfirmed, customerPhone, cartStorageKey]);

  const loadMenu = useCallback(async () => {
    try {
      const [categoriesRes, itemsRes] = await Promise.all([
        api.getCategories(),
        api.getMenuItems(),
      ]);
      setCategories(categoriesRes.categories);
      setMenuItems(itemsRes.items || []);
      sanitizeCartByAvailability(itemsRes.items || []);
    } catch (error) {
      console.error('Error loading menu:', error);
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  }, [sanitizeCartByAvailability]);

  const addToCart = (itemId: string) => {
    setCart(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }));
  };

  const cartQtyCount = (cartState: Record<string, number>) => Object.values(cartState).reduce((sum, qty) => sum + qty, 0);

  const confirmCartEmpty = () => window.confirm('Your cart will become empty. Continue?');

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[itemId] > 1) {
        newCart[itemId]--;
      } else {
        delete newCart[itemId];
      }

      if (cartQtyCount(newCart) === 0) {
        const ok = confirmCartEmpty();
        if (!ok) return prev;
        toast.info('Cart is now empty');
      }
      return newCart;
    });
  };

  const removeItemFromCart = (itemId: string) => {
    setCart(prev => {
      const next = { ...prev };
      delete next[itemId];

      if (cartQtyCount(next) === 0) {
        const ok = confirmCartEmpty();
        if (!ok) return prev;
        toast.info('Cart is now empty');
      }

      return next;
    });
    setItemNotes((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const getCartTotal = () => {
    return Object.entries(cart).reduce((sum, [itemId, qty]) => {
      const item = menuItems.find(i => i.id === itemId);
      if (!item?.available) return sum;
      return sum + (item?.price || 0) * qty;
    }, 0);
  };

  const getCartDetails = () => {
    return Object.entries(cart)
      .map(([itemId, qty]) => {
        const item = menuItems.find(i => i.id === itemId);
        if (!item || !item.available) return null;
        return {
          id: itemId,
          name: item.name,
          qty,
          price: Number(item.price || 0),
          subtotal: Number(item.price || 0) * qty,
          note: itemNotes[itemId] || '',
        };
      })
      .filter(Boolean) as Array<{ id: string; name: string; qty: number; price: number; subtotal: number; note: string }>;
  };

  const getCartItemCount = () => {
    return Object.entries(cart).reduce((sum, [itemId, qty]) => {
      const item = menuItems.find((i) => i.id === itemId);
      if (!item?.available) return sum;
      return sum + qty;
    }, 0);
  };

  const isValidPhone = (value: string) => /^\d{8,15}$/.test(value.trim());
  const isValidFirstName = (value: string) => /^[A-Za-z][A-Za-z\s]{0,29}$/.test(value.trim());

  const loadCustomerData = async (phone: string) => {
    if (!tableNumber || !phone) return;
    setLoadingActiveOrders(true);
    try {
      const trimmedPhone = phone.trim();
      const [ordersRes, billRes, paidRes] = await Promise.all([
        api.getOrdersByTableAndPhone(Number(tableNumber), trimmedPhone),
        api.getUnpaidBillByTableAndPhone(Number(tableNumber), trimmedPhone),
        api.getPaidBillHistoryByPhone(trimmedPhone),
      ]);
      setUserOrders(ordersRes.orders || []);
      setCurrentBill(billRes);
      setPaidBillHistory(paidRes.bills || []);
      try {
        setLatestFinalBill(null);
        const finalBillRes = await api.getLatestFinalBillByTableAndPhone(Number(tableNumber), trimmedPhone);
        const currentUnpaidOrderIds = (billRes.orders || []).map((o: any) => String(o.id));
        if (currentUnpaidOrderIds.length === 0) {
          setLatestFinalBill(null);
          latestFinalBillIdRef.current = '';
        } else if (
          finalBillRes.bill &&
          sameIdSet(currentUnpaidOrderIds, (finalBillRes.bill.orderIds || []).map((id: any) => String(id)))
        ) {
          setLatestFinalBill(finalBillRes.bill);
          if (latestFinalBillIdRef.current && latestFinalBillIdRef.current !== finalBillRes.bill.id) {
            setActiveTab('bill');
          }
          latestFinalBillIdRef.current = finalBillRes.bill.id;
        } else {
          setLatestFinalBill(null);
          latestFinalBillIdRef.current = '';
        }
      } catch (err) {
        // Keep customer flow functional even if final_bills migration is not applied yet.
        console.error('Final bill sync warning:', err);
        setLatestFinalBill(null);
        latestFinalBillIdRef.current = '';
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load your orders');
    } finally {
      setLoadingActiveOrders(false);
    }
  };

  const confirmPhone = () => {
    if (!isValidFirstName(customerName)) {
      toast.error('Enter first name (letters only)');
      return;
    }
    if (!isValidPhone(customerPhone)) {
      toast.error('Enter a valid mobile number (8-15 digits)');
      return;
    }
    const phone = customerPhone.trim();
    const name = customerName.trim();
    sessionStorage.setItem(`sdc:first_name:${tableNumber || 'unknown'}:${phone}`, name);
    sessionStorage.setItem(`sdc:active_phone:${tableNumber || 'unknown'}`, phone);
    setPhoneConfirmed(true);
    loadCustomerData(phone);
  };

  useEffect(() => {
    if (!phoneConfirmed || !customerPhone || !tableNumber) return;
    const timer = setInterval(() => {
      loadCustomerData(customerPhone);
    }, 5000);
    return () => clearInterval(timer);
  }, [phoneConfirmed, customerPhone, tableNumber]);

  useEffect(() => {
    if (!phoneConfirmed || !tableNumber || !customerPhone) return;
    const unsubscribe = api.subscribeToOrderChanges((payload) => {
      const row = payload?.new || payload?.old;
      if (!row) return;
      if (Number(row.table_number) !== Number(tableNumber)) return;
      if ((row.customer_phone || '') !== customerPhone) return;
      loadCustomerData(customerPhone);
    });
    return () => unsubscribe();
  }, [phoneConfirmed, tableNumber, customerPhone]);

  useEffect(() => {
    const unsubscribe = api.subscribeToMenuItemChanges(() => {
      loadMenu();
    });
    return () => unsubscribe();
  }, [loadMenu]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadMenu();
    }, 5000);
    return () => clearInterval(timer);
  }, [loadMenu]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNoteHintIndex((prev) => (prev + 1) % NOTE_PLACEHOLDERS.length);
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  const placeOrder = async () => {
    if (placingOrder) return;
    if (Object.keys(cart).length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    if (!isValidPhone(customerPhone)) {
      toast.error('Enter a valid mobile number before placing order');
      return;
    }
    if (!isValidFirstName(customerName)) {
      toast.error('Enter first name before placing order');
      return;
    }

    const throttleKey = `sdc:last-order-submit:${tableNumber}:${customerPhone.trim()}`;
    const lastSubmitAt = Number(sessionStorage.getItem(throttleKey) || 0);
    const now = Date.now();
    if (now - lastSubmitAt < 7000) {
      toast.error('Please wait a few seconds before placing another order.');
      return;
    }

    try {
      setPlacingOrder(true);
      sessionStorage.setItem(throttleKey, String(now));
      const orderItems = Object.entries(cart).map(([itemId, qty]) => {
        const item = menuItems.find(i => i.id === itemId);
        const freeNote = (itemNotes[itemId] || '').trim();
        return {
          id: itemId,
          name: item.name,
          price: item.price,
          quantity: qty,
          note: freeNote,
        };
      });

      const res = await api.createOrder({
        tableId: tableNumber,
        tableNumber: Number(tableNumber),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        items: orderItems,
        total: getCartTotal(),
      });

      toast.success('Order placed successfully!');
      const createdOrderId = res?.order?.id;
      sessionStorage.removeItem(cartStorageKey);
      setCart({});
      setItemNotes({});
      navigate(`/order/success?orderId=${createdOrderId}&table=${tableNumber}&phone=${encodeURIComponent(customerPhone.trim())}`);
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to place order');
      sessionStorage.removeItem(throttleKey);
    } finally {
      setPlacingOrder(false);
    }
  };

  const callStaff = async () => {
    if (!phoneConfirmed || !tableNumber) return;
    try {
      await api.createServiceRequest({
        tableNumber: Number(tableNumber),
        customerName: customerName.trim() || 'Guest',
        customerPhone: customerPhone.trim(),
        message: 'Customer requested assistance',
      });
      toast.success('Staff has been notified.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to notify staff');
    }
  };

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="text-center">
          <Coffee className="w-12 h-12 animate-pulse mx-auto mb-4" />
          <p className="text-lg">Loading menu...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="page-shell bg-[linear-gradient(180deg,#f7f9fb,#f3f5f7)] pb-24">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="brand-display flex items-center gap-2 text-2xl font-bold leading-none text-slate-900">
                <img src={logo12} alt="Stories de Café" className="h-8 w-8 shrink-0 object-contain" />
                <span className="truncate">Stories de Café</span>
              </h1>
              {phoneConfirmed && (
                <p className="mt-2 truncate text-sm text-slate-600">
                  Table {tableNumber} • {customerName || 'Guest'} • {customerPhone}
                </p>
              )}
              {!phoneConfirmed && (
                <p className="mt-2 text-sm text-slate-600">Table {tableNumber}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {getCartItemCount() > 0 && (
                <Badge variant="secondary" className="text-base px-2.5 py-1 bg-primary/10 text-primary">
                  <ShoppingCart className="w-4 h-4 mr-1" />
                  {getCartItemCount()}
                </Badge>
              )}
            </div>
          </div>
          {phoneConfirmed && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {phoneConfirmed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPhoneConfirmed(false);
                    setActiveTab('menu');
                    setUserOrders([]);
                    setCurrentBill(null);
                    setLatestFinalBill(null);
                    setPaidBillHistory([]);
                    latestFinalBillIdRef.current = '';
                    sessionStorage.removeItem(`sdc:active_phone:${tableNumber || 'unknown'}`);
                    setCustomerPhone('');
                    setExpandedPaidBills({});
                    setCart({});
                    setItemNotes({});
                    sessionStorage.removeItem(cartStorageKey);
                    setCustomerName('');
                  }}
                >
                  Change Number
                </Button>
              )}
              {phoneConfirmed && (
                <Button variant="outline" size="sm" onClick={callStaff}>
                  <BellRing className="w-4 h-4 mr-1" />
                  Need Assistance
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {phoneConfirmed && (
        <div className="border-b border-slate-200 bg-white/95">
          <div className="max-w-5xl mx-auto px-4 py-3">
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
              <Button
                variant={activeTab === 'menu' ? 'default' : 'ghost'}
                className="w-full rounded-xl"
                onClick={() => setActiveTab('menu')}
              >
                Menu
              </Button>
              <Button
                variant={activeTab === 'cart' ? 'default' : 'ghost'}
                className="w-full rounded-xl"
                onClick={() => setActiveTab('cart')}
              >
                <ShoppingCart className="w-4 h-4 mr-1" />
                Cart {getCartItemCount() > 0 ? `(${getCartItemCount()})` : ''}
              </Button>
              <Button
                variant={activeTab === 'bill' ? 'default' : 'ghost'}
                className="w-full rounded-xl"
                onClick={() => setActiveTab('bill')}
              >
                Orders/Bills
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Menu */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {cartAvailabilityPopup ? (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <div className="flex items-start justify-between gap-2">
              <span>{cartAvailabilityPopup}</span>
              <button
                type="button"
                className="text-red-700 hover:text-red-900"
                onClick={() => setCartAvailabilityPopup('')}
                aria-label="Dismiss notice"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        {!phoneConfirmed && (
          <Card className="glass-grid-card p-4 mb-6">
            <h3 className="font-semibold mb-2">Enter Name and Mobile number to continue</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Use the same number later to retrieve your orders and bill history.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="First name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value.replace(/[^A-Za-z\s]/g, ''))}
              />
              <Input
                placeholder="Mobile number"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value.replace(/[^\d]/g, ''))}
              />
              <Button onClick={confirmPhone}>Continue</Button>
            </div>
          </Card>
        )}

        {phoneConfirmed && activeTab === 'bill' && (
          <Card className="glass-grid-card p-4 mb-6">
            <h3 className="font-semibold mb-2">Your Orders</h3>
            {visibleUserOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders for this number at Table {tableNumber}.</p>
            ) : (
              <div className="space-y-2">
                {visibleUserOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div>
                      <div className="font-semibold">Order #{o.id}</div>
                      <div>
                        <span className="font-medium text-black">Status: </span>
                        {o.status === 'COMPLETED' ? (
                          <span className="inline-flex rounded px-2 py-0.5 bg-[#00FA9A] text-black font-medium">SERVED</span>
                        ) : (
                          <span className={`font-medium ${STATUS_TEXT_COLORS[o.status] || 'text-muted-foreground'}`}>{statusLabel(o.status)}</span>
                        )}
                      </div>
                      {o.statusReason ? (
                        <div className="mt-1 text-xs text-red-600">{customerOrderNote(o.statusReason)}</div>
                      ) : null}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/order/success?orderId=${o.id}&table=${tableNumber}&phone=${encodeURIComponent(customerPhone)}`)}
                    >
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {phoneConfirmed && activeTab === 'bill' && (
          <Card className="glass-grid-card p-4 mb-6">
            <h3 className="font-semibold mb-2">Your Bill</h3>
            {currentBill && currentBill.lineItems && currentBill.lineItems.length > 0 ? (
              <div className="space-y-2 text-sm">
                {currentBill.lineItems.map((item: any, idx: number) => (
                  <div key={`${item.name}_${idx}`} className="rounded-md border px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.name}</span>
                      <span className="font-semibold">${Number(item.lineTotal || 0).toFixed(2)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{Number(item.quantity || 0)} x ${Number(item.unitPrice || 0).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="font-semibold">Grand Total</span>
                  <span className="text-lg font-bold">${Number(currentBill.total || 0).toFixed(2)}</span>
                </div>
                {currentBill.orders?.length > 0 && (
                  <div className="rounded-md border px-3 py-2">
                    <p className="text-xs font-semibold mb-1">Rounds</p>
                    <div className="space-y-1">
                      {currentBill.orders.map((o: any, idx: number) => (
                        <div key={o.id} className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Round {roundByOrderId[String(o.id)] || idx + 1} • Order #{o.id}</span>
                          <span>${Number(o.total || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : latestFinalBill ? (
              <div className="space-y-2 text-sm">
                <div className="rounded-md border bg-gray-50 px-3 py-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Bill ID</span>
                    <span className="font-semibold">#{latestFinalBill.id}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span>Status</span>
                    <span className={`font-semibold ${latestFinalBill.isPaid ? 'text-green-600' : 'text-amber-600'}`}>
                      {latestFinalBill.isPaid ? 'PAID' : 'UNPAID'}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span>Payment Method</span>
                    <span className="font-semibold text-foreground">
                      {(() => {
                        const fromHistory = paidBillHistory.find((b: any) => String(b.id) === String(latestFinalBill.id));
                        const method = fromHistory?.rounds?.find((r: any) => r.paymentMethod)?.paymentMethod;
                        return getPaymentMethodLabel(method);
                      })()}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span>Paid On</span>
                    <span className="font-semibold text-foreground">{formatDateTime(latestFinalBill.paidAt || latestFinalBill.createdAt)}</span>
                  </div>
                </div>
                {(latestFinalBill.lineItems || []).map((item: any, idx: number) => (
                  <div key={`${item.name}_${idx}`} className="rounded-md border px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.name}</span>
                      <span className="font-semibold">${Number(item.lineTotal || 0).toFixed(2)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{Number(item.quantity || 0)} x ${Number(item.unitPrice || 0).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="font-semibold">Grand Total</span>
                  <span className="text-lg font-bold">${Number(latestFinalBill.total || 0).toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No bill available yet.</p>
            )}

          </Card>
        )}

        {phoneConfirmed && activeTab === 'bill' && paidBillHistory.length > 0 && (
          <Card className="glass-grid-card p-4 mb-6">
            <h4 className="font-semibold mb-2">Paid Bills History</h4>
            <div className="space-y-2">
              {paidBillHistory.map((bill) => (
                <div key={bill.id} className="rounded-md border px-3 py-2 text-sm">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between"
                    onClick={() =>
                      setExpandedPaidBills((prev) => ({ ...prev, [bill.id]: !prev[bill.id] }))
                    }
                  >
                    <span className="font-medium flex items-center gap-2">
                      <ChevronDown className={`h-6 w-6 transition-transform ${expandedPaidBills[bill.id] ? 'rotate-180' : ''}`} />
                      Bill #{bill.id}
                    </span>
                    <span className="font-semibold text-green-600">
                      PAID via {getPaymentMethodLabel((bill.rounds || []).find((r: any) => r.paymentMethod)?.paymentMethod)}
                    </span>
                  </button>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Table {bill.tableNumber}</span>
                    <span>${Number(bill.total || 0).toFixed(2)}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Paid on: {formatDateTime(bill.paidAt || bill.createdAt)}
                  </div>
                  {expandedPaidBills[bill.id] && (
                    <div className="mt-2 rounded-md border bg-gray-50 p-2">
                      {(bill.rounds || []).map((round: any, idx: number) => (
                        <div key={round.id} className="mb-2 last:mb-0">
                          <p className="text-xs font-semibold">
                            Round {round.roundNumber || idx + 1} • Order #{round.id}
                          </p>
                          <p className="mb-2 text-xs text-muted-foreground">Billing Ref: {orderBillingRef(round)}</p>
                          <p> </p>
                          <div className="mt-1 space-y-1">
                            {(round.items || []).map((item: any, ii: number) => (
                              <div key={ii} className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{item.quantity}x {item.name}</span>
                                <span>${Number(item.price * item.quantity).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {phoneConfirmed && activeTab === 'menu' && menuCategories.length > 0 && (
          <Card className="glass-grid-card p-3 mb-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium">Browse by category</p>
              <select
                className="h-9 rounded-md border px-3 text-sm"
                value={categoryJump}
                onChange={(e) => {
                  const selected = e.target.value;
                  setCategoryJump(selected);
                  const el = document.getElementById(`category-${selected}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                <option value="">Jump to category</option>
                {menuCategories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {menuCategories.map((category) => (
                <Button
                  key={category.id}
                  variant={categoryJump === String(category.id) ? 'default' : 'outline'}
                  size="sm"
                  className="whitespace-nowrap"
                  onClick={() => {
                    setCategoryJump(String(category.id));
                    const el = document.getElementById(`category-${category.id}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          </Card>
        )}

        {phoneConfirmed && activeTab === 'menu' && menuCategories.map(category => {
          const categoryItems = menuItems.filter(item => String(item.categoryId) === String(category.id));
          if (categoryItems.length === 0) return null;

          return (
            <Card key={category.id} id={`category-${category.id}`} className="glass-grid-card mb-6 overflow-hidden">
              <div className="flex items-center justify-between border-b bg-white px-4 py-3">
                <h2 className="text-lg font-bold">{category.name}</h2>
                <span className="rounded-md border border-teal-200 bg-white px-2 py-0.5 text-xs text-teal-800">
                  {categoryItems.length} item{categoryItems.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid gap-4 p-4">
                {categoryItems.map(item => (
                  <Card key={item.id} className={`glass-grid-card p-4 ${item.available ? '' : 'opacity-75'}`}>
                    <div className="flex gap-4 items-start">
                      {getMenuItemImage(item.name, item.image) && (
                        <button
                          type="button"
                          className="h-24 w-24 shrink-0 rounded-xl border bg-white p-1 transition hover:shadow cursor-zoom-in"
                          onClick={() =>
                            setPreviewImage({
                              src: getMenuItemImage(item.name, item.image),
                              name: item.name,
                            })
                          }
                        >
                          <img
                            src={getMenuItemImage(item.name, item.image)}
                            alt={item.name}
                            className={`h-full w-full rounded-lg object-contain ${item.available ? '' : 'grayscale'}`}
                          />
                        </button>
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold">{item.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                        <p className="text-lg font-bold mt-2">${item.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2 self-end">
                        {!item.available ? (
                          <Button variant="outline" disabled>
                            Unavailable
                          </Button>
                        ) : cart[item.id] ? (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              disabled={!phoneConfirmed}
                              onClick={() => removeFromCart(item.id)}
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="w-8 text-center font-semibold">{cart[item.id]}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              disabled={!phoneConfirmed}
                              onClick={() => addToCart(item.id)}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <Button disabled={!phoneConfirmed} onClick={() => addToCart(item.id)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          );
        })}

        {phoneConfirmed && activeTab === 'cart' && (
          <Card className="glass-grid-card p-4 mb-6">
            <h3 className="font-semibold mb-3">Your Cart</h3>
            {getCartDetails().length === 0 ? (
              <p className="text-sm text-muted-foreground">Your cart is empty.</p>
            ) : (
              <div className="space-y-3">
                {getCartDetails().map((ci) => (
                  <div key={ci.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-sm">{ci.name}</div>
                        <div className="text-xs text-muted-foreground">${ci.price.toFixed(2)} each</div>
                      </div>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => removeItemFromCart(ci.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => removeFromCart(ci.id)}>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-semibold">{ci.qty}</span>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => addToCart(ci.id)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="font-semibold">${ci.subtotal.toFixed(2)}</div>
                    </div>
                    <div className="mt-2">
                      <Input
                        placeholder={`Add note (${NOTE_PLACEHOLDERS[noteHintIndex]})`}
                        value={itemNotes[ci.id] || ''}
                        onChange={(e) => setItemNotes((prev) => ({ ...prev, [ci.id]: e.target.value }))}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold">${getCartTotal().toFixed(2)}</span>
                </div>
                <Button onClick={placeOrder} className="w-full" size="lg" disabled={placingOrder}>
                  {placingOrder ? 'Placing Order...' : 'Place Order'}
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>

      {phoneConfirmed && activeTab === 'menu' && getCartItemCount() > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-white/95 backdrop-blur">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Selected Items ({getCartItemCount()})</p>
              <p className="text-base font-bold">${getCartTotal().toFixed(2)}</p>
            </div>
            <Button onClick={() => setActiveTab('cart')}>View Cart</Button>
          </div>
        </div>
      )}
    </div>
    <Dialog open={Boolean(previewImage)} onOpenChange={(open) => !open && setPreviewImage(null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{previewImage?.name || 'Item image'}</DialogTitle>
        </DialogHeader>
        {previewImage?.src && (
          <div className="rounded-lg border bg-white p-3 flex items-center justify-center">
            <img src={previewImage.src} alt={previewImage.name} className="max-h-[70vh] w-auto object-contain rounded" />
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
