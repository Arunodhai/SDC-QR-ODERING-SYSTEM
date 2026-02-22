import { useMemo, useState, useEffect } from 'react';
import { BellRing, ChefHat, ChevronDown, Clock, History, KeyRound, LogOut, UserRoundPen } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import * as api from '../lib/api';
import { format, formatDistanceToNow } from 'date-fns';

const STATUS_COLORS = {
  PENDING: 'bg-red-100 text-red-800',
  PREPARING: 'bg-yellow-100 text-yellow-800',
  READY: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-[#00FA9A] text-black',
  CANCELLED: 'bg-red-100 text-red-800',
};

const STATUS_FLOW = ['PENDING', 'PREPARING', 'READY', 'COMPLETED'];
const ACTIVE_STATUSES = ['PENDING', 'PREPARING', 'READY'] as const;
const HISTORY_STATUSES = ['COMPLETED', 'CANCELLED'] as const;
const STATUS_TITLES: Record<string, string> = {
  PENDING: 'New Orders',
  PREPARING: 'In Preparation',
  READY: 'Ready to Serve',
};
const statusLabel = (status: string) => (status === 'COMPLETED' ? 'SERVED' : status);

const localDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function KitchenPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [historyDate, setHistoryDate] = useState(localDateKey(new Date()));
  const [kitchenUserName, setKitchenUserName] = useState('Kitchen Manager');
  const [serviceRequests, setServiceRequests] = useState<any[]>([]);
  const [unavailableItemIds, setUnavailableItemIds] = useState<Set<string>>(new Set());
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showUsernameDialog, setShowUsernameDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [usernamePassword, setUsernamePassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [updatingUsername, setUpdatingUsername] = useState(false);
  const isAdminKitchen = location.pathname.startsWith('/admin/');

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let unsubscribe: (() => void) | null = null;
    let mounted = true;

    (async () => {
      try {
        if (isAdminKitchen) {
          const adminSession = await api.getAdminSession();
          if (!adminSession) {
            navigate('/admin/login');
            return;
          }
        } else {
          const kitchenSession = await api.getKitchenSession();
          if (!kitchenSession) {
            navigate('/kitchen/login');
            return;
          }
          if (mounted) {
            setKitchenUserName(kitchenSession.name || 'Kitchen Manager');
          }
        }
        if (!mounted) return;
        await loadOrders();
        interval = setInterval(loadOrders, 5000);
        unsubscribe = api.subscribeToOrderChanges(() => {
          loadOrders();
        });
      } catch (error) {
        console.error('Session check failed:', error);
        navigate(isAdminKitchen ? '/admin/login' : '/kitchen/login');
      }
    })();

    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
      if (unsubscribe) unsubscribe();
    };
  }, [navigate, isAdminKitchen]);

  const handleKitchenLogout = async () => {
    await api.kitchenSignOut();
    navigate('/kitchen/login');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match');
      return;
    }

    setUpdatingPassword(true);
    try {
      await api.changeKitchenPassword(kitchenUserName, currentPassword, newPassword);
      toast.success('Kitchen password updated');
      setShowPasswordDialog(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingUsername(true);
    try {
      const result = await api.changeKitchenUsername(kitchenUserName, usernamePassword, newUsername);
      await api.setKitchenSessionName(result.username);
      setKitchenUserName(result.username);
      toast.success('Kitchen username updated');
      setShowUsernameDialog(false);
      setUsernamePassword('');
      setNewUsername('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update username');
    } finally {
      setUpdatingUsername(false);
    }
  };

  const loadOrders = async () => {
    try {
      const [ordersRes, requestsRes, menuRes] = await Promise.all([
        api.getOrders(),
        api.getOpenServiceRequests().catch(() => ({ requests: [] })),
        api.getMenuItems().catch(() => ({ items: [] })),
      ]);
      setAllOrders(ordersRes.orders || []);
      setServiceRequests(requestsRes.requests || []);
      const unavailableIds = new Set(
        (menuRes.items || [])
          .filter((item: any) => !item.available)
          .map((item: any) => String(item.id)),
      );
      setUnavailableItemIds(unavailableIds);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const activeOrders = useMemo(() => {
    return [...allOrders]
      .filter((o: any) => ACTIVE_STATUSES.includes(o.status))
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [allOrders]);

  const historyOrders = useMemo(() => {
    return [...allOrders]
      .filter((o: any) => HISTORY_STATUSES.includes(o.status))
      .filter((o: any) => localDateKey(new Date(o.createdAt)) === historyDate)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allOrders, historyDate]);

  const updateStatus = async (orderId: string, currentStatus: string) => {
    const currentIndex = STATUS_FLOW.indexOf(currentStatus);
    if (currentIndex < STATUS_FLOW.length - 1) {
      const newStatus = STATUS_FLOW[currentIndex + 1];
      try {
        await api.updateOrderStatus(orderId, newStatus);
        toast.success(`Order status updated to ${statusLabel(newStatus)}`);
        loadOrders();
      } catch (error) {
        console.error('Error updating order status:', error);
        toast.error('Failed to update order status');
      }
    }
  };

  const markOutOfStock = async (orderId: string) => {
    try {
      const res = await api.applyUnavailableItemsToOrder(orderId);
      if (!res.unavailableItems.length) {
        toast.info('No unavailable items found in this order.');
      } else if (res.allItemsUnavailable) {
        toast.warning(`All items unavailable. Order cancelled: ${res.unavailableItems.join(', ')}`);
      } else {
        toast.success(`Removed unavailable item(s): ${res.unavailableItems.join(', ')}`);
      }
      loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to apply unavailable items');
    }
  };

  const activeGroupedByPhone = useMemo(() => {
    const groupedByPhone = activeOrders.reduce((acc: Record<string, any[]>, order: any) => {
      const key = order.customerPhone || `NO_PHONE_${order.id}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(order);
      return acc;
    }, {});

    return Object.entries(groupedByPhone)
      .map(([phone, groupOrders]) => {
        const sorted = [...groupOrders].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        return {
          phone,
          customerName: sorted.find((o: any) => o.customerName)?.customerName || 'Guest',
          orders: sorted,
          firstAt: sorted[0]?.createdAt,
        };
      })
      .sort((a, b) => new Date(a.firstAt).getTime() - new Date(b.firstAt).getTime());
  }, [activeOrders]);

  const historyGrouped = useMemo(() => {
    const grouped = historyOrders.reduce((acc: Record<string, any[]>, order: any) => {
      const key = `${order.tableNumber}__${order.customerPhone || 'NO_PHONE'}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(order);
      return acc;
    }, {});

    return Object.entries(grouped).map(([key, orders]) => {
      const [tableStr, phone] = key.split('__');
      return {
        key,
        tableNumber: Number(tableStr),
        phone: phone === 'NO_PHONE' ? '' : phone,
        customerName: orders.find((o: any) => o.customerName)?.customerName || 'Guest',
        orders,
      };
    });
  }, [historyOrders]);

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="text-center">
          <ChefHat className="w-12 h-12 animate-pulse mx-auto mb-4" />
          <p className="text-lg">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
            <div>
              <h1 className="brand-display text-2xl font-bold flex items-center gap-2">
                <ChefHat className="w-6 h-6" />
                Kitchen Orders
              </h1>
              <p className="text-sm text-muted-foreground">
                {viewMode === 'active' ? `${activeOrders.length} active orders` : `${historyOrders.length} historical orders`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <nav className="flex gap-1 rounded-xl border bg-white p-1">
                <Button
                  size="sm"
                  variant={viewMode === 'active' ? 'default' : 'ghost'}
                  className="rounded-lg"
                  onClick={() => setViewMode('active')}
                >
                  Active
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'history' ? 'default' : 'ghost'}
                  className="rounded-lg"
                  onClick={() => setViewMode('history')}
                >
                  <History className="h-4 w-4 mr-1" />
                  History
                </Button>
              </nav>
              {viewMode === 'history' && (
                <input
                  type="date"
                  value={historyDate}
                  onChange={(e) => setHistoryDate(e.target.value)}
                  className="h-9 rounded-md border px-3 text-sm"
                />
              )}
            </div>
          </div>
          {!isAdminKitchen && (
            <div className="flex items-center gap-4 rounded-xl border bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-black">{kitchenUserName}</p>
                <p className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">Kitchen manager access</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                  <ChevronDown className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => setShowUsernameDialog(true)}>
                    <UserRoundPen className="h-4 w-4" />
                    Change Username
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowPasswordDialog(true)}>
                    <KeyRound className="h-4 w-4" />
                    Change Password
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleKitchenLogout}>
                    <LogOut className="h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        {viewMode === 'active' && serviceRequests.length > 0 && (
          <Card className="glass-grid-card mb-4 p-4">
            <div className="mb-2 flex items-center gap-2">
              <BellRing className="h-4 w-4 text-amber-600" />
              <h3 className="font-semibold">Need Assistance Requests</h3>
            </div>
            <div className="space-y-2">
              {serviceRequests.slice(0, 5).map((request: any) => (
                <div key={request.id} className="flex items-center justify-between rounded-md border bg-white px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">Table {request.table_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {request.customer_name || 'Guest'} • {request.customer_phone || '-'} • {request.message}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await api.resolveServiceRequest(String(request.id));
                        toast.success('Request marked as assisted');
                        loadOrders();
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : 'Failed to update request');
                      }
                    }}
                  >
                    Mark Assisted
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}
        {viewMode === 'active' ? (
          activeGroupedByPhone.length === 0 ? (
            <div className="text-center py-12">
              <ChefHat className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No active orders</p>
            </div>
          ) : (
            <div className="space-y-5">
              {activeGroupedByPhone.map((group) => {
                const phoneLabel = group.phone.startsWith('NO_PHONE_') ? 'No mobile provided' : group.phone;
                const tables = [...new Set(group.orders.map((o: any) => o.tableNumber))].join(', ');
                return (
                  <Card key={group.phone} className="glass-grid-card p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-base font-semibold text-foreground">Table(s): {tables}</p>
                        <p className="text-sm text-muted-foreground">
                          Name: {group.customerName || 'Guest'} • Mobile: {phoneLabel}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        First order {formatDistanceToNow(new Date(group.firstAt), { addSuffix: true })}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      {ACTIVE_STATUSES.map((status) => {
                        const statusOrders = group.orders.filter((o: any) => o.status === status);
                        return (
                          <div key={status} className="rounded-lg border p-3 bg-white">
                            <div className="mb-2 flex items-center justify-between">
                              <h4 className="font-semibold text-sm">{STATUS_TITLES[status]}</h4>
                              <Badge className={STATUS_COLORS[status as keyof typeof STATUS_COLORS]}>
                                {statusOrders.length}
                              </Badge>
                            </div>
                            {statusOrders.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No orders</p>
                            ) : (
                              <div className="space-y-2">
                                {statusOrders.map((order: any) => (
                                  <div key={order.id} className="rounded-md border p-2">
                                    {(() => {
                                      const unavailableNames = (order.items || [])
                                        .filter(
                                          (item: any) =>
                                            !item.isCancelled &&
                                            item.menuItemId &&
                                            unavailableItemIds.has(String(item.menuItemId)),
                                        )
                                        .map((item: any) => item.name);
                                      const hasUnavailable = unavailableNames.length > 0;
                                      const alreadyApplied =
                                        !hasUnavailable && String(order.statusReason || '').toLowerCase().includes('unavailable');
                                      return (
                                        <>
                                    <div className="flex items-start justify-between mb-1">
                                      <div>
                                        <p className="text-sm font-semibold">Order #{order.id}</p>
                                      </div>
                                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                                      </span>
                                    </div>
                                    <div className="mt-3 space-y-1 mb-2">
                                      {order.items.map((item: any, idx: number) => (
                                        <div key={idx} className="flex justify-between text-xs">
                                          <span>{item.quantity}x {item.name}</span>
                                          <span className="font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
                                        </div>
                                      ))}
                                    </div>
                                    {hasUnavailable ? (
                                      <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
                                        Unavailable now: {Array.from(new Set(unavailableNames)).join(', ')}
                                      </div>
                                    ) : null}
                                    <div className="mt-3 mb-2 text-xs font-semibold text-right">Total: ${order.total.toFixed(2)}</div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <Button
                                        className="w-full"
                                        size="sm"
                                        onClick={() => updateStatus(order.id, order.status)}
                                      >
                                        {order.status === 'PENDING' && 'Start Preparing'}
                                        {order.status === 'PREPARING' && 'Mark Ready'}
                                        {order.status === 'READY' && 'Mark Served'}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        className="w-full border-red-300 text-red-700 hover:bg-red-50"
                                        size="sm"
                                        onClick={() => markOutOfStock(order.id)}
                                        disabled={!hasUnavailable}
                                      >
                                        {alreadyApplied ? 'Applied' : 'Apply Unavailable'}
                                      </Button>
                                    </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        ) : historyGrouped.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No kitchen history for {historyDate}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {historyGrouped.map((group) => (
              <Card key={group.key} className="glass-grid-card p-4">
                <div className="mb-3">
                  <h3 className="text-lg font-bold">Table {group.tableNumber}</h3>
                  <p className="text-sm text-muted-foreground">Name: {group.customerName || 'Guest'}</p>
                  <p className="text-sm text-muted-foreground">Mobile: {group.phone || '-'}</p>
                </div>
                <div className="space-y-2">
                  {group.orders.map((order: any) => (
                    <div key={order.id} className="rounded-md border bg-white p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">Order #{order.id}</span>
                          <Badge className={STATUS_COLORS[order.status as keyof typeof STATUS_COLORS]}>
                            {statusLabel(order.status)}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(order.createdAt), 'h:mm a')}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {order.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span>{item.quantity}x {item.name}</span>
                            <span>${(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-right text-sm font-semibold">Total: ${Number(order.total || 0).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {!isAdminKitchen && (
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Kitchen Password</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-kitchen-password">Current Password</Label>
                <Input
                  id="current-kitchen-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-kitchen-password">New Password</Label>
                <Input
                  id="new-kitchen-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-kitchen-password">Confirm New Password</Label>
                <Input
                  id="confirm-kitchen-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={updatingPassword}>
                {updatingPassword ? 'Updating Password...' : 'Update Password'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {!isAdminKitchen && (
        <Dialog open={showUsernameDialog} onOpenChange={setShowUsernameDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Kitchen Username</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleChangeUsername} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-kitchen-username">Current Username</Label>
                <Input id="current-kitchen-username" value={kitchenUserName} readOnly disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-kitchen-username">New Username</Label>
                <Input
                  id="new-kitchen-username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                  minLength={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username-change-password">Current Password</Label>
                <Input
                  id="username-change-password"
                  type="password"
                  value={usernamePassword}
                  onChange={(e) => setUsernamePassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={updatingUsername}>
                {updatingUsername ? 'Updating Username...' : 'Update Username'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
