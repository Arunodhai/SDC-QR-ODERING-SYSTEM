import { useParams, useNavigate } from 'react-router';
import { useState, useEffect, useRef } from 'react';
import { Plus, Minus, ShoppingCart, Coffee, Trash2, ChevronDown, ChevronUp, ReceiptText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet';
import { toast } from 'sonner';
import * as api from '../lib/api';

const STATUS_TEXT_COLORS: Record<string, string> = {
  PENDING: 'text-amber-600',
  PREPARING: 'text-blue-600',
  READY: 'text-green-600',
  COMPLETED: 'text-indigo-600',
  CANCELLED: 'text-red-600',
};

const sameIdSet = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const aa = [...a].sort();
  const bb = [...b].sort();
  return aa.every((v, i) => v === bb[i]);
};

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
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [currentBill, setCurrentBill] = useState<{
    orders: any[];
    total: number;
    lineItems?: Array<{ name: string; quantity: number; unitPrice: number; lineTotal: number }>;
  } | null>(null);
  const [latestFinalBill, setLatestFinalBill] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'menu' | 'bill'>('menu');
  const [billChangedHighlight, setBillChangedHighlight] = useState(false);
  const [loadingActiveOrders, setLoadingActiveOrders] = useState(false);
  const [isCartSheetOpen, setIsCartSheetOpen] = useState(false);
  const [showSelectedItems, setShowSelectedItems] = useState(false);
  const [swipeStart, setSwipeStart] = useState<{ id: string; x: number } | null>(null);
  const [swipeOffsetById, setSwipeOffsetById] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const previousBillTotalRef = useRef<number | null>(null);
  const latestFinalBillIdRef = useRef<string>('');

  useEffect(() => {
    loadMenu();
    const params = new URLSearchParams(window.location.search);
    const fromQuery = (params.get('phone') || '').replace(/[^\d]/g, '');
    const returning = params.get('returning') === '1';
    if (fromQuery) {
      setCustomerPhone(fromQuery);
      if (returning && tableNumber) {
        setPhoneConfirmed(true);
        loadActiveOrders(fromQuery);
      }
    }
  }, [tableNumber]);

  const loadMenu = async () => {
    try {
      const [categoriesRes, itemsRes] = await Promise.all([
        api.getCategories(),
        api.getMenuItems(),
      ]);
      setCategories(categoriesRes.categories);
      setMenuItems(itemsRes.items.filter((item: any) => item.available));
    } catch (error) {
      console.error('Error loading menu:', error);
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

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
      return sum + (item?.price || 0) * qty;
    }, 0);
  };

  const getCartDetails = () => {
    return Object.entries(cart)
      .map(([itemId, qty]) => {
        const item = menuItems.find(i => i.id === itemId);
        if (!item) return null;
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
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  };

  const isValidPhone = (value: string) => /^\d{8,15}$/.test(value.trim());

  const loadActiveOrders = async (phone: string) => {
    if (!tableNumber || !phone) return;
    setLoadingActiveOrders(true);
    try {
      const trimmedPhone = phone.trim();
      const [activeRes, billRes] = await Promise.all([
        api.getActiveOrdersByTableAndPhone(Number(tableNumber), trimmedPhone),
        api.getUnpaidBillByTableAndPhone(Number(tableNumber), trimmedPhone),
      ]);
      setActiveOrders(activeRes.orders || []);
      setCurrentBill(billRes);
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
            setBillChangedHighlight(true);
            setActiveTab('bill');
            setTimeout(() => setBillChangedHighlight(false), 6000);
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
      console.error('Error loading active orders:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load your active orders');
    } finally {
      setLoadingActiveOrders(false);
    }
  };

  const confirmPhone = () => {
    if (!isValidPhone(customerPhone)) {
      toast.error('Enter a valid mobile number (8-15 digits)');
      return;
    }
    const phone = customerPhone.trim();
    setPhoneConfirmed(true);
    loadActiveOrders(phone);
  };

  useEffect(() => {
    if (!phoneConfirmed || !customerPhone || !tableNumber) return;
    const timer = setInterval(() => {
      loadActiveOrders(customerPhone);
    }, 5000);
    return () => clearInterval(timer);
  }, [phoneConfirmed, customerPhone, tableNumber]);

  useEffect(() => {
    const sourceTotal =
      latestFinalBill && !latestFinalBill.isPaid
        ? Number(latestFinalBill.total || 0)
        : Number(currentBill?.total || 0);
    if (sourceTotal === undefined || sourceTotal === null) return;
    const total = Number(sourceTotal || 0);
    if (previousBillTotalRef.current !== null && previousBillTotalRef.current !== total) {
      setBillChangedHighlight(true);
      const timer = setTimeout(() => setBillChangedHighlight(false), 6000);
      previousBillTotalRef.current = total;
      return () => clearTimeout(timer);
    }
    previousBillTotalRef.current = total;
  }, [currentBill, latestFinalBill]);

  const placeOrder = async () => {
    if (Object.keys(cart).length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    if (!isValidPhone(customerPhone)) {
      toast.error('Enter a valid mobile number before placing order');
      return;
    }

    try {
      const orderItems = Object.entries(cart).map(([itemId, qty]) => {
        const item = menuItems.find(i => i.id === itemId);
        return {
          id: itemId,
          name: item.name,
          price: item.price,
          quantity: qty,
          note: (itemNotes[itemId] || '').trim(),
        };
      });

      const res = await api.createOrder({
        tableId: tableNumber,
        tableNumber: Number(tableNumber),
        customerName: customerName || 'Guest',
        customerPhone: customerPhone.trim(),
        items: orderItems,
        total: getCartTotal(),
      });

      toast.success('Order placed successfully!');
      const createdOrderId = res?.order?.id;
      navigate(`/order/success?orderId=${createdOrderId}&table=${tableNumber}&phone=${encodeURIComponent(customerPhone.trim())}`);
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error('Failed to place order');
    }
  };

  const handleRowTouchStart = (id: string, x: number) => {
    setSwipeStart({ id, x });
  };

  const handleRowTouchMove = (id: string, x: number) => {
    if (!swipeStart || swipeStart.id !== id) return;
    const delta = x - swipeStart.x;
    const clamped = Math.max(-120, Math.min(0, delta));
    setSwipeOffsetById((prev) => ({ ...prev, [id]: clamped }));
  };

  const handleRowTouchEnd = (id: string) => {
    const offset = swipeOffsetById[id] || 0;
    if (offset <= -80) {
      removeItemFromCart(id);
    }
    setSwipeOffsetById((prev) => ({ ...prev, [id]: 0 }));
    setSwipeStart(null);
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
    <div className="page-shell pb-36">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b bg-white/95">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="brand-display text-2xl font-bold flex items-center gap-2">
                <Coffee className="w-6 h-6" />
                Stories de Café
              </h1>
              <p className="text-sm text-muted-foreground">Table {tableNumber}</p>
              {phoneConfirmed && (
                <p className="text-xs text-muted-foreground">Tracking mobile: {customerPhone}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {phoneConfirmed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPhoneConfirmed(false);
                    setActiveTab('menu');
                    setActiveOrders([]);
                    setCurrentBill(null);
                    setLatestFinalBill(null);
                    latestFinalBillIdRef.current = '';
                    setCustomerPhone('');
                    setCart({});
                    setItemNotes({});
                    setCustomerName('');
                  }}
                >
                  Change Number
                </Button>
              )}
              {getCartItemCount() > 0 && (
                <Badge variant="secondary" className="text-lg px-3 py-1 bg-primary/10 text-primary">
                  <ShoppingCart className="w-4 h-4 mr-1" />
                  {getCartItemCount()}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {phoneConfirmed && (
        <div className="border-b bg-white/95">
          <div className="max-w-5xl mx-auto px-4 py-3">
            <div className="grid grid-cols-2 gap-2 rounded-xl border bg-white p-1">
              <Button
                variant={activeTab === 'menu' ? 'default' : 'ghost'}
                className="w-full rounded-lg"
                onClick={() => setActiveTab('menu')}
              >
                Menu
              </Button>
              <Button
                variant={activeTab === 'bill' ? 'default' : 'ghost'}
                className={`w-full rounded-lg ${billChangedHighlight ? 'animate-pulse ring-1 ring-primary/50' : ''}`}
                onClick={() => setActiveTab('bill')}
              >
                <ReceiptText className="w-4 h-4 mr-1" />
                Your Bill
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Menu */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {!phoneConfirmed && (
          <Card className="glass-grid-card p-4 mb-6">
            <h3 className="font-semibold mb-2">Enter Mobile Number to Continue</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Use the same number later to retrieve your active orders.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Mobile number"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value.replace(/[^\d]/g, ''))}
              />
              <Button onClick={confirmPhone}>Continue</Button>
            </div>
          </Card>
        )}

        {phoneConfirmed && activeTab === 'menu' && (
          <Card className="glass-grid-card p-4 mb-6">
            <h3 className="font-semibold mb-2">Your Active Orders</h3>
            {activeOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active orders for this number at Table {tableNumber}.</p>
            ) : (
              <div className="space-y-2">
                {activeOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div>
                      <div className="font-semibold">Order #{o.id}</div>
                      <div>
                        <span className="font-medium text-black">Status: </span>
                        <span className={`font-medium ${STATUS_TEXT_COLORS[o.status] || 'text-muted-foreground'}`}>{o.status}</span>
                      </div>
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
            <div className="mt-3 rounded-md border bg-gray-50 p-3">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Grand Total</span>
                <span>${Number(currentBill?.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </Card>
        )}

        {phoneConfirmed && activeTab === 'bill' && (
          <Card className="glass-grid-card p-4 mb-6">
            <h3 className="font-semibold mb-2">Your Bill</h3>
            {currentBill && currentBill.lineItems && currentBill.lineItems.length > 0 ? (
              <div className="space-y-2 text-sm">
                <div className="rounded-md border bg-gray-50 px-3 py-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Status</span>
                    <span className="font-semibold text-amber-600">UNPAID</span>
                  </div>
                </div>
                {currentBill.lineItems.map((item: any, idx: number) => (
                  <div key={`${item.name}_${idx}`} className="rounded-md border px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.name}</span>
                      <span className="font-semibold">${Number(item.lineTotal || 0).toFixed(2)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{Number(item.quantity || 0)} x ${Number(item.unitPrice || 0).toFixed(2)}</span>
                      <span>Line total</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="font-semibold">Grand Total</span>
                  <span className="text-lg font-bold">${Number(currentBill.total || 0).toFixed(2)}</span>
                </div>
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
                </div>
                {(latestFinalBill.lineItems || []).map((item: any, idx: number) => (
                  <div key={`${item.name}_${idx}`} className="rounded-md border px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.name}</span>
                      <span className="font-semibold">${Number(item.lineTotal || 0).toFixed(2)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{Number(item.quantity || 0)} x ${Number(item.unitPrice || 0).toFixed(2)}</span>
                      <span>Line total</span>
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

        {phoneConfirmed && activeTab === 'menu' && categories.map(category => {
          const categoryItems = menuItems.filter(item => String(item.categoryId) === String(category.id));
          if (categoryItems.length === 0) return null;

          return (
            <div key={category.id} className="mb-8">
              <h2 className="text-xl font-bold mb-4">{category.name}</h2>
              <div className="grid gap-4">
                {categoryItems.map(item => (
                  <Card key={item.id} className="glass-grid-card p-4">
                    <div className="flex flex-col gap-4 sm:flex-row">
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-36 w-full rounded-xl object-cover sm:h-24 sm:w-24"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold">{item.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                        <p className="text-lg font-bold mt-2">${item.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {cart[item.id] ? (
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
            </div>
          );
        })}
      </div>

      {/* Cart Summary */}
      {getCartItemCount() > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-white shadow-2xl">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <div className="mb-3">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md border bg-gray-50 px-3 py-2 text-sm font-semibold"
                onClick={() => setShowSelectedItems((v) => !v)}
              >
                <span>Selected Items ({getCartItemCount()})</span>
                {showSelectedItems ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
              {showSelectedItems && (
                <div className="mt-2 max-h-32 overflow-y-auto rounded-md border bg-gray-50 p-2">
                  {getCartDetails().map((ci) => (
                    <div key={ci.id} className="flex items-center justify-between py-1 text-sm">
                      <div>
                        <div>{ci.qty}x {ci.name}</div>
                        {ci.note ? <div className="text-xs text-muted-foreground">Note: {ci.note}</div> : null}
                      </div>
                      <span className="font-semibold">${ci.subtotal.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mb-3">
              <Sheet open={isCartSheetOpen} onOpenChange={setIsCartSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="w-full">Edit Cart</Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl p-0">
                  <SheetHeader className="border-b">
                    <SheetTitle>Edit Cart</SheetTitle>
                    <SheetDescription>Review items before placing order. Swipe left on mobile to remove.</SheetDescription>
                  </SheetHeader>

                  <div className="max-h-[55vh] overflow-y-auto p-4 space-y-3">
                    {getCartDetails().length === 0 && (
                      <p className="text-sm text-muted-foreground">Your cart is empty.</p>
                    )}
                    {getCartDetails().map((ci) => (
                      <div key={ci.id} className="relative overflow-hidden rounded-lg border">
                        <div className="absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-red-500 text-white text-xs font-semibold">
                          Remove
                        </div>
                        <div
                          className="relative bg-white p-3 transition-transform duration-150"
                          style={{ transform: `translateX(${swipeOffsetById[ci.id] || 0}px)` }}
                          onTouchStart={(e) => handleRowTouchStart(ci.id, e.touches[0].clientX)}
                          onTouchMove={(e) => handleRowTouchMove(ci.id, e.touches[0].clientX)}
                          onTouchEnd={() => handleRowTouchEnd(ci.id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="font-semibold text-sm">{ci.name}</div>
                              <div className="text-xs text-muted-foreground">${ci.price.toFixed(2)} each</div>
                            </div>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeItemFromCart(ci.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => removeFromCart(ci.id)}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-8 text-center font-semibold">{ci.qty}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => addToCart(ci.id)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="font-semibold">${ci.subtotal.toFixed(2)}</div>
                          </div>
                          <div className="mt-2">
                            <Input
                              placeholder="Add note (e.g., less spicy, no onion)"
                              value={itemNotes[ci.id] || ''}
                              onChange={(e) =>
                                setItemNotes((prev) => ({ ...prev, [ci.id]: e.target.value }))
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <SheetFooter className="border-t bg-white">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-semibold">Items</span>
                      <span>{getCartItemCount()}</span>
                    </div>
                    <div className="flex items-center justify-between text-base">
                      <span className="font-bold">Total</span>
                      <span className="font-bold">${getCartTotal().toFixed(2)}</span>
                    </div>
                    <Button
                      className="w-full mt-2"
                      onClick={() => setIsCartSheetOpen(false)}
                    >
                      Done
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            </div>
            <Separator className="mb-3" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-base font-semibold md:text-lg">Total</span>
              <span className="text-xl font-bold md:text-2xl">${getCartTotal().toFixed(2)}</span>
            </div>
            <Button onClick={placeOrder} className="w-full" size="lg">
              Place Order
            </Button>
          </div>
        </div>
      )}
    </div>

    </>
  );
}
