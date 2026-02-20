import { useParams, useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import { Plus, Minus, ShoppingCart, Coffee } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { toast } from 'sonner';
import * as api from '../lib/api';

export default function CustomerOrderPage() {
  const { tableNumber } = useParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [phoneConfirmed, setPhoneConfirmed] = useState(false);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [loadingActiveOrders, setLoadingActiveOrders] = useState(false);
  const [loading, setLoading] = useState(true);
  const phoneKey = `stories_phone_table_${tableNumber}`;

  useEffect(() => {
    loadMenu();
    const params = new URLSearchParams(window.location.search);
    const fromQuery = (params.get('phone') || '').replace(/[^\d]/g, '');
    const storedPhone = fromQuery || localStorage.getItem(phoneKey);
    if (storedPhone) {
      setCustomerPhone(storedPhone);
      setPhoneConfirmed(true);
      loadActiveOrders(storedPhone);
    }
  }, []);

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

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[itemId] > 1) {
        newCart[itemId]--;
      } else {
        delete newCart[itemId];
      }
      return newCart;
    });
  };

  const getCartTotal = () => {
    return Object.entries(cart).reduce((sum, [itemId, qty]) => {
      const item = menuItems.find(i => i.id === itemId);
      return sum + (item?.price || 0) * qty;
    }, 0);
  };

  const getCartItemCount = () => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  };

  const isValidPhone = (value: string) => /^\d{8,15}$/.test(value.trim());

  const loadActiveOrders = async (phone: string) => {
    if (!tableNumber || !phone) return;
    setLoadingActiveOrders(true);
    try {
      const res = await api.getActiveOrdersByTableAndPhone(Number(tableNumber), phone.trim());
      setActiveOrders(res.orders || []);
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
    localStorage.setItem(phoneKey, phone);
    setPhoneConfirmed(true);
    loadActiveOrders(phone);
  };

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
            </div>
            {getCartItemCount() > 0 && (
              <Badge variant="secondary" className="text-lg px-3 py-1 bg-primary/10 text-primary">
                <ShoppingCart className="w-4 h-4 mr-1" />
                {getCartItemCount()}
              </Badge>
            )}
          </div>
        </div>
      </div>

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

        {phoneConfirmed && (
          <Card className="glass-grid-card p-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <h3 className="font-semibold">Your Active Orders</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => loadActiveOrders(customerPhone)} disabled={loadingActiveOrders}>
                  {loadingActiveOrders ? 'Refreshing...' : 'Refresh'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    localStorage.removeItem(phoneKey);
                    setPhoneConfirmed(false);
                    setActiveOrders([]);
                  }}
                >
                  Change Number
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Tracking mobile: {customerPhone}</p>
            {activeOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active orders for this number at Table {tableNumber}.</p>
            ) : (
              <div className="space-y-2">
                {activeOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div>
                      <div className="font-semibold">Order #{o.id}</div>
                      <div className="text-muted-foreground">Status: {o.status}</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/order/success?orderId=${o.id}&table=${tableNumber}&phone=${encodeURIComponent(customerPhone)}`)}>
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {categories.map(category => {
          const categoryItems = menuItems.filter(item => String(item.categoryId) === String(category.id));
          if (categoryItems.length === 0) return null;

          return (
            <div key={category.id} className="mb-8">
              <h2 className="text-xl font-bold mb-4">{category.name}</h2>
              {!phoneConfirmed && (
                <p className="mb-3 text-sm text-muted-foreground">Enter mobile number above to start ordering.</p>
              )}
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
              <Input
                placeholder="Mobile number"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value.replace(/[^\d]/g, ''))}
              />
            </div>
            <div className="mb-3">
              <Input
                placeholder="Your name (optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
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
  );
}
