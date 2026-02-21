import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const supabaseUrl = `https://${projectId}.supabase.co`;
const supabase = createClient(supabaseUrl, publicAnonKey);
const imageBucket = 'menu-images';
const kitchenSessionKey = 'sdc:kitchen-session-v1';

const kitchenAuthSetupHint =
  'Kitchen auth is not configured in DB. Run sql/create_kitchen_auth.sql in Supabase SQL editor.';

const isMissingKitchenAuthRpc = (error: any) => {
  const message = String(error?.message || '');
  return (
    message.includes('verify_kitchen_credentials') ||
    message.includes('change_kitchen_password') ||
    message.includes('change_kitchen_username')
  );
};

const errMsg = (error: any, fallback: string) => {
  if (!error) return fallback;
  return error.message || error.error_description || fallback;
};

const toMenuItem = (row: any) => ({
  id: String(row.id),
  categoryId: String(row.category_id),
  name: row.name,
  price: Number(row.price || 0),
  description: row.description || '',
  image: row.image_url || '',
  available: Boolean(row.is_available),
  createdAt: row.created_at,
});

const toOrderItem = (row: any) => ({
  name: row.item_name,
  price: Number(row.unit_price || 0),
  quantity: Number(row.quantity || 0),
});

const toOrder = (row: any) => ({
  id: String(row.id),
  tableId: String(row.table_number),
  tableNumber: Number(row.table_number),
  customerName: row.customer_name || 'Guest',
  customerPhone: row.customer_phone || '',
  items: (row.order_items || []).map(toOrderItem),
  total: Number(row.total_amount || 0),
  status: row.status,
  paymentStatus: row.payment_status,
  paymentMethod: row.payment_method,
  createdAt: row.created_at,
});

const aggregateBillLineItems = (orders: any[]) => {
  const map = new Map<string, { name: string; quantity: number; unitPrice: number; lineTotal: number }>();
  (orders || []).forEach((order) => {
    (order.items || []).forEach((item: any) => {
      const key = `${item.name}__${Number(item.price || 0)}`;
      const existing = map.get(key) || {
        name: item.name,
        quantity: 0,
        unitPrice: Number(item.price || 0),
        lineTotal: 0,
      };
      const qty = Number(item.quantity || 0);
      const unit = Number(item.price || 0);
      existing.quantity += qty;
      existing.lineTotal += qty * unit;
      map.set(key, existing);
    });
  });
  return Array.from(map.values());
};

export const adminSignIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(errMsg(error, 'Admin login failed'));
  return data;
};

export const adminSignOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(errMsg(error, 'Logout failed'));
  return { success: true };
};

export const getAdminSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(errMsg(error, 'Failed to get session'));
  return data.session;
};

export const kitchenSignIn = async (password: string, name = 'Kitchen Manager') => {
  const enteredName = String(name || '').trim();
  const enteredPassword = String(password || '').trim();
  if (!enteredName) {
    throw new Error('Username is required');
  }
  if (!enteredPassword) {
    throw new Error('Kitchen password is required');
  }

  const { data, error } = await supabase.rpc('verify_kitchen_credentials', {
    p_username: enteredName,
    p_password: enteredPassword,
  });
  if (error) {
    if (isMissingKitchenAuthRpc(error)) {
      throw new Error(kitchenAuthSetupHint);
    }
    throw new Error(errMsg(error, 'Failed to verify kitchen password'));
  }

  if (!data) {
    throw new Error('Invalid username or password');
  }

  const session = {
    role: 'kitchen',
    name: enteredName,
    signedInAt: new Date().toISOString(),
  };
  localStorage.setItem(kitchenSessionKey, JSON.stringify(session));
  return { session };
};

export const getKitchenSession = async () => {
  const raw = localStorage.getItem(kitchenSessionKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(kitchenSessionKey);
    return null;
  }
};

export const setKitchenSessionName = async (name: string) => {
  const session = await getKitchenSession();
  if (!session) return null;
  const next = { ...session, name: String(name || '').trim() };
  localStorage.setItem(kitchenSessionKey, JSON.stringify(next));
  return next;
};

export const kitchenSignOut = async () => {
  localStorage.removeItem(kitchenSessionKey);
  return { success: true };
};

export const changeKitchenPassword = async (username: string, currentPassword: string, nextPassword: string) => {
  const trimmedUser = String(username || '').trim();
  if (!trimmedUser) {
    throw new Error('Username is required');
  }

  const trimmedNext = String(nextPassword || '').trim();
  if (trimmedNext.length < 6) {
    throw new Error('New password must be at least 6 characters');
  }

  const { data, error } = await supabase.rpc('change_kitchen_password', {
    p_username: trimmedUser,
    p_current: String(currentPassword || '').trim(),
    p_next: trimmedNext,
  });
  if (error) {
    if (isMissingKitchenAuthRpc(error)) {
      throw new Error(kitchenAuthSetupHint);
    }
    throw new Error(errMsg(error, 'Failed to update kitchen password'));
  }
  if (!data) {
    throw new Error('Invalid username or current password');
  }

  return { success: true };
};

export const changeKitchenUsername = async (
  currentUsername: string,
  currentPassword: string,
  nextUsername: string,
) => {
  const trimmedCurrent = String(currentUsername || '').trim();
  const trimmedNext = String(nextUsername || '').trim();
  if (!trimmedCurrent) {
    throw new Error('Current username is required');
  }
  if (trimmedNext.length < 3) {
    throw new Error('New username must be at least 3 characters');
  }

  const { data, error } = await supabase.rpc('change_kitchen_username', {
    p_current_username: trimmedCurrent,
    p_current_password: String(currentPassword || '').trim(),
    p_next_username: trimmedNext,
  });
  if (error) {
    if (isMissingKitchenAuthRpc(error)) {
      throw new Error(kitchenAuthSetupHint);
    }
    throw new Error(errMsg(error, 'Failed to update kitchen username'));
  }
  if (!data) {
    throw new Error('Invalid current username or password');
  }

  return { success: true, username: trimmedNext };
};

export const healthCheck = async () => {
  const { error } = await supabase.from('categories').select('id').limit(1);
  if (error) throw new Error(errMsg(error, 'Supabase connection failed'));
  return { status: 'ok' };
};

// Categories
export const getCategories = async () => {
  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error) throw new Error(errMsg(error, 'Failed to fetch categories'));

  const categories = (data || []).map((row, index) => ({
    id: String(row.id),
    name: row.name,
    order: index,
    createdAt: row.created_at,
  }));

  return { categories };
};

export const createCategory = async (name: string, _order: number) => {
  const { data, error } = await supabase.from('categories').insert({ name }).select().single();
  if (error) throw new Error(errMsg(error, 'Failed to create category'));

  return {
    category: {
      id: String(data.id),
      name: data.name,
      order: 0,
      createdAt: data.created_at,
    },
  };
};

export const updateCategory = async (id: string, updates: any) => {
  const { data, error } = await supabase
    .from('categories')
    .update({ name: updates.name })
    .eq('id', Number(id))
    .select()
    .single();

  if (error) throw new Error(errMsg(error, 'Failed to update category'));
  return { category: { id: String(data.id), name: data.name, createdAt: data.created_at } };
};

export const deleteCategory = async (id: string) => {
  const { error } = await supabase.from('categories').delete().eq('id', Number(id));
  if (error) throw new Error(errMsg(error, 'Failed to delete category'));
  return { success: true };
};

// Menu Items
export const getMenuItems = async () => {
  const { data, error } = await supabase.from('menu_items').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(errMsg(error, 'Failed to fetch menu items'));
  return { items: (data || []).map(toMenuItem) };
};

export const createMenuItem = async (item: any) => {
  const payload = {
    category_id: Number(item.categoryId),
    name: item.name,
    price: Number(item.price),
    description: item.description || '',
    image_url: item.image || null,
    is_available: item.available !== false,
  };

  const { data, error } = await supabase.from('menu_items').insert(payload).select().single();
  if (error) throw new Error(errMsg(error, 'Failed to create menu item'));
  return { item: toMenuItem(data) };
};

export const updateMenuItem = async (id: string, updates: any) => {
  const patch: any = {};
  if (updates.categoryId !== undefined) patch.category_id = Number(updates.categoryId);
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.price !== undefined) patch.price = Number(updates.price);
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.image !== undefined) patch.image_url = updates.image || null;
  if (updates.available !== undefined) patch.is_available = Boolean(updates.available);

  const { data, error } = await supabase
    .from('menu_items')
    .update(patch)
    .eq('id', Number(id))
    .select()
    .single();

  if (error) throw new Error(errMsg(error, 'Failed to update menu item'));
  return { item: toMenuItem(data) };
};

export const deleteMenuItem = async (id: string) => {
  const { error } = await supabase.from('menu_items').delete().eq('id', Number(id));
  if (error) throw new Error(errMsg(error, 'Failed to delete menu item'));
  return { success: true };
};

export const uploadImage = async (file: File) => {
  const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : 'jpg';
  const path = `menu/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buckets = [imageBucket, 'make-880825c9-menu-images'];

  let lastError: any = null;
  for (const bucket of buckets) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
    if (!error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return { url: data.publicUrl, path };
    }
    lastError = error;
  }

  throw new Error(
    `${errMsg(lastError, 'Failed to upload image')}. Check bucket "menu-images" and storage policies for authenticated users.`,
  );
};

// Tables
export const getTables = async () => {
  const { data, error } = await supabase.from('restaurant_tables').select('*').order('table_number');
  if (error) throw new Error(errMsg(error, 'Failed to fetch tables'));

  const tables = (data || []).map((row) => ({
    id: String(row.id),
    tableNumber: Number(row.table_number),
  }));

  return { tables };
};

export const createTable = async (tableNumber: number) => {
  const { data, error } = await supabase
    .from('restaurant_tables')
    .insert({ table_number: tableNumber })
    .select()
    .single();

  if (error) throw new Error(errMsg(error, 'Failed to create table'));
  return { table: { id: String(data.id), tableNumber: Number(data.table_number) } };
};

export const deleteTable = async (id: string) => {
  const { error } = await supabase.from('restaurant_tables').delete().eq('id', Number(id));
  if (error) throw new Error(errMsg(error, 'Failed to delete table'));
  return { success: true };
};

// Orders
export const getOrders = async () => {
  const { data, error } = await supabase
    .from('orders')
    .select('*,order_items(*)')
    .order('created_at', { ascending: false });

  if (error) throw new Error(errMsg(error, 'Failed to fetch orders'));
  return { orders: (data || []).map(toOrder) };
};

export const getOrderById = async (id: string) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*,order_items(*)')
    .eq('id', Number(id))
    .single();

  if (error) throw new Error(errMsg(error, 'Failed to fetch order'));
  return { order: toOrder(data) };
};

export const createOrder = async (order: any) => {
  const total = Number(order.total || 0);

  let createdOrder: any = null;

  const { data: createdOrderWithPhone, error: orderErrorWithPhone } = await supabase
    .from('orders')
    .insert({
      table_number: Number(order.tableNumber),
      customer_name: order.customerName || 'Guest',
      customer_phone: order.customerPhone || null,
      status: 'PENDING',
      payment_method: 'COUNTER',
      payment_status: 'UNPAID',
      total_amount: total,
    })
    .select()
    .single();

  if (orderErrorWithPhone) {
    // Backward compatibility for schemas without customer_phone.
    if (String(orderErrorWithPhone.message || '').includes('customer_phone')) {
      const { data: createdOrderFallback, error: orderErrorFallback } = await supabase
        .from('orders')
        .insert({
          table_number: Number(order.tableNumber),
          customer_name: order.customerName || 'Guest',
          status: 'PENDING',
          payment_method: 'COUNTER',
          payment_status: 'UNPAID',
          total_amount: total,
        })
        .select()
        .single();

      if (orderErrorFallback) throw new Error(errMsg(orderErrorFallback, 'Failed to create order'));
      createdOrder = createdOrderFallback;
    } else {
      throw new Error(errMsg(orderErrorWithPhone, 'Failed to create order'));
    }
  } else {
    createdOrder = createdOrderWithPhone;
  }

  const itemsPayload = (order.items || []).map((item: any) => ({
    order_id: createdOrder.id,
    menu_item_id: item.id ? Number(item.id) : null,
    item_name: item.note ? `${item.name} (Note: ${item.note})` : item.name,
    unit_price: Number(item.price || 0),
    quantity: Number(item.quantity || 0),
    line_total: Number(item.price || 0) * Number(item.quantity || 0),
  }));

  if (itemsPayload.length > 0) {
    const { error: itemsError } = await supabase.from('order_items').insert(itemsPayload);
    if (itemsError) throw new Error(errMsg(itemsError, 'Failed to create order items'));
  }

  const { data: fullOrder, error: fullOrderError } = await supabase
    .from('orders')
    .select('*,order_items(*)')
    .eq('id', createdOrder.id)
    .single();

  if (fullOrderError) throw new Error(errMsg(fullOrderError, 'Failed to fetch created order'));
  return { order: toOrder(fullOrder) };
};

export const updateOrderStatus = async (id: string, status: string) => {
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', Number(id))
    .select('*,order_items(*)')
    .single();

  if (error) throw new Error(errMsg(error, 'Failed to update order status'));
  return { order: toOrder(data) };
};

export const updateOrderPayment = async (id: string, paymentStatus: string, paymentMethod?: string) => {
  const patch: Record<string, any> = { payment_status: paymentStatus };
  if (paymentMethod) patch.payment_method = paymentMethod === 'CASH' ? 'COUNTER' : paymentMethod;
  const { data, error } = await supabase
    .from('orders')
    .update(patch)
    .eq('id', Number(id))
    .select('*,order_items(*)')
    .single();

  if (error) throw new Error(errMsg(error, 'Failed to update order payment'));
  return { order: toOrder(data) };
};

export const getUnpaidBillByTableAndPhone = async (tableNumber: number, phone: string) => {
  const latestPaidBoundary = await supabase
    .from('orders')
    .select('created_at')
    .eq('table_number', Number(tableNumber))
    .eq('customer_phone', phone)
    .eq('payment_status', 'PAID')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestPaidBoundary.error) {
    throw new Error(errMsg(latestPaidBoundary.error, 'Failed to resolve billing session'));
  }

  let query = supabase
    .from('orders')
    .select('*,order_items(*)')
    .eq('table_number', Number(tableNumber))
    .eq('customer_phone', phone)
    .eq('payment_status', 'UNPAID')
    .neq('status', 'CANCELLED')
    .order('created_at', { ascending: true });

  if (latestPaidBoundary.data?.created_at) {
    query = query.gt('created_at', latestPaidBoundary.data.created_at);
  }

  const { data, error } = await query;

  if (error) throw new Error(errMsg(error, 'Failed to fetch unpaid bill'));
  const orders = (data || []).map(toOrder);
  const total = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const lineItems = aggregateBillLineItems(orders);
  return { orders, total, lineItems };
};

const paymentEnumHint =
  "DB enum payment_method_type is missing one or more values. Add values like UPI/CARD if needed.";

const isPaymentMethodEnumError = (error: any) =>
  String(error?.message || '').includes('payment_method_type') &&
  String(error?.message || '').includes('invalid input value');

export const markOrdersPaidBulk = async (orderIds: string[], paymentMethod: string) => {
  if (!orderIds.length) return { success: true };
  const ids = orderIds.map((id) => Number(id));
  const primaryMethod = paymentMethod === 'CASH' ? 'COUNTER' : paymentMethod;

  const { error } = await supabase
    .from('orders')
    .update({ payment_status: 'PAID', payment_method: primaryMethod })
    .in('id', ids);

  if (!error) return { success: true, storedMethod: primaryMethod };

  // Fallback for schemas that don't yet include UPI/CARD enum variants.
  if (isPaymentMethodEnumError(error)) {
    const fallbackMethod = 'COUNTER';
    const { error: fallbackError } = await supabase
      .from('orders')
      .update({ payment_status: 'PAID', payment_method: fallbackMethod })
      .in('id', ids);
    if (!fallbackError) {
      return { success: true, storedMethod: fallbackMethod, downgraded: true };
    }
    throw new Error(`${errMsg(fallbackError, 'Failed to mark orders as paid')} ${paymentEnumHint}`);
  }

  throw new Error(errMsg(error, 'Failed to mark orders as paid'));
};

export const cancelPendingOrder = async (id: string, phone?: string) => {
  let query = supabase
    .from('orders')
    .update({ status: 'CANCELLED' })
    .eq('id', Number(id))
    .eq('status', 'PENDING');
  if (phone) query = query.eq('customer_phone', phone);
  const { error } = await query.select('id').single();

  if (!error) return { success: true };

  const msg = String(error.message || '');
  const enumCancelledMissing =
    msg.includes('invalid input value for enum order_status') && msg.includes('CANCELLED');

  if (!enumCancelledMissing) {
    throw new Error(errMsg(error, 'Failed to cancel order'));
  }

  // Backward compatibility: if DB enum doesn't include CANCELLED, hard-delete pending order.
  let deleteQuery = supabase
    .from('orders')
    .delete()
    .eq('id', Number(id))
    .eq('status', 'PENDING');
  if (phone) deleteQuery = deleteQuery.eq('customer_phone', phone);
  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw new Error(errMsg(deleteError, 'Failed to cancel order'));
  return { success: true };
};

export const getActiveOrdersByTableAndPhone = async (tableNumber: number, phone: string) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*,order_items(*)')
    .eq('table_number', Number(tableNumber))
    .eq('customer_phone', phone)
    .in('status', ['PENDING', 'PREPARING', 'READY'])
    .order('created_at', { ascending: false });

  if (error) {
    if (String(error.message || '').includes('customer_phone')) {
      throw new Error('DB is missing customer_phone column. Run sql/add_customer_phone.sql in Supabase SQL editor.');
    }
    throw new Error(errMsg(error, 'Failed to fetch active orders'));
  }

  return { orders: (data || []).map(toOrder) };
};

export const getOrdersByTableAndPhone = async (tableNumber: number, phone: string) => {
  const latestPaidBoundary = await supabase
    .from('orders')
    .select('created_at')
    .eq('table_number', Number(tableNumber))
    .eq('customer_phone', phone)
    .eq('payment_status', 'PAID')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestPaidBoundary.error) {
    if (String(latestPaidBoundary.error.message || '').includes('customer_phone')) {
      throw new Error('DB is missing customer_phone column. Run sql/add_customer_phone.sql in Supabase SQL editor.');
    }
    throw new Error(errMsg(latestPaidBoundary.error, 'Failed to resolve order session'));
  }

  let query = supabase
    .from('orders')
    .select('*,order_items(*)')
    .eq('table_number', Number(tableNumber))
    .eq('customer_phone', phone)
    .eq('payment_status', 'UNPAID')
    .order('created_at', { ascending: false });

  if (latestPaidBoundary.data?.created_at) {
    query = query.gt('created_at', latestPaidBoundary.data.created_at);
  }

  const { data, error } = await query;

  if (error) {
    if (String(error.message || '').includes('customer_phone')) {
      throw new Error('DB is missing customer_phone column. Run sql/add_customer_phone.sql in Supabase SQL editor.');
    }
    throw new Error(errMsg(error, 'Failed to fetch orders'));
  }

  return { orders: (data || []).map(toOrder) };
};

export const getLatestFinalBillByTableAndPhone = async (tableNumber: number, phone: string) => {
  const { data, error } = await supabase
    .from('final_bills')
    .select('*')
    .eq('table_number', Number(tableNumber))
    .eq('customer_phone', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (String(error.message || '').includes('final_bills')) {
      throw new Error('DB is missing final_bills table. Run sql/create_final_bills.sql in Supabase SQL editor.');
    }
    throw new Error(errMsg(error, 'Failed to fetch final bill'));
  }
  if (!data) return { bill: null };

  return {
    bill: {
      id: String(data.id),
      tableNumber: Number(data.table_number),
      customerPhone: data.customer_phone,
      total: Number(data.total_amount || 0),
      lineItems: data.line_items || [],
      orderIds: (data.order_ids || []).map((id: any) => String(id)),
      isPaid: Boolean(data.is_paid),
      createdAt: data.created_at,
      paidAt: data.paid_at || null,
    },
  };
};

export const getFinalBills = async () => {
  const { data, error } = await supabase
    .from('final_bills')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    if (String(error.message || '').includes('final_bills')) {
      throw new Error('DB is missing final_bills table. Run sql/create_final_bills.sql in Supabase SQL editor.');
    }
    throw new Error(errMsg(error, 'Failed to fetch final bills'));
  }

  return {
    bills: (data || []).map((row: any) => ({
      id: String(row.id),
      tableNumber: Number(row.table_number),
      customerPhone: row.customer_phone || '',
      orderIds: (row.order_ids || []).map((id: any) => String(id)),
      isPaid: Boolean(row.is_paid),
      total: Number(row.total_amount || 0),
      createdAt: row.created_at,
      paidAt: row.paid_at || null,
    })),
  };
};

export const generateFinalBillByTableAndPhone = async (tableNumber: number, phone: string) => {
  const bill = await getUnpaidBillByTableAndPhone(tableNumber, phone);
  if (!bill.orders.length) {
    return { bill: null };
  }

  const payload = {
    table_number: Number(tableNumber),
    customer_phone: phone,
    order_ids: bill.orders.map((o: any) => Number(o.id)),
    line_items: bill.lineItems,
    total_amount: Number(bill.total || 0),
    is_paid: false,
  };

  const { data, error } = await supabase.from('final_bills').insert(payload).select().single();
  if (error) {
    if (String(error.message || '').includes('final_bills')) {
      throw new Error('DB is missing final_bills table. Run sql/create_final_bills.sql in Supabase SQL editor.');
    }
    throw new Error(errMsg(error, 'Failed to generate final bill'));
  }

  return {
    bill: {
      id: String(data.id),
      tableNumber: Number(data.table_number),
      customerPhone: data.customer_phone,
      total: Number(data.total_amount || 0),
      lineItems: data.line_items || [],
      orderIds: (data.order_ids || []).map((id: any) => String(id)),
      isPaid: Boolean(data.is_paid),
      createdAt: data.created_at,
      paidAt: data.paid_at || null,
    },
  };
};

export const markFinalBillPaid = async (billId: string, paymentMethod: string) => {
  const { data, error } = await supabase
    .from('final_bills')
    .update({ is_paid: true, paid_at: new Date().toISOString() })
    .eq('id', Number(billId))
    .select('*')
    .single();

  if (error) throw new Error(errMsg(error, 'Failed to mark final bill as paid'));

  const orderIds = (data.order_ids || []).map((id: any) => String(id));
  let storedMethod = paymentMethod === 'CASH' ? 'COUNTER' : paymentMethod;
  let downgraded = false;
  if (orderIds.length) {
    const res = await markOrdersPaidBulk(orderIds, paymentMethod);
    storedMethod = (res as any).storedMethod || storedMethod;
    downgraded = Boolean((res as any).downgraded);
  }

  return { success: true, storedMethod, downgraded };
};

export const getPaidBillHistoryByPhone = async (phone: string) => {
  const { data, error } = await supabase
    .from('final_bills')
    .select('*')
    .eq('customer_phone', phone)
    .eq('is_paid', true)
    .order('paid_at', { ascending: false });

  if (error) {
    if (String(error.message || '').includes('final_bills')) {
      throw new Error('DB is missing final_bills table. Run sql/create_final_bills.sql in Supabase SQL editor.');
    }
    throw new Error(errMsg(error, 'Failed to fetch paid bill history'));
  }

  const bills = (data || []).map((row: any) => ({
    idNum: Number(row.id),
    id: String(row.id),
    tableNumber: Number(row.table_number),
    customerPhone: row.customer_phone,
    total: Number(row.total_amount || 0),
    lineItems: row.line_items || [],
    orderIds: (row.order_ids || []).map((id: any) => String(id)),
    orderIdsNum: (row.order_ids || []).map((id: any) => Number(id)),
    isPaid: Boolean(row.is_paid),
    createdAt: row.created_at,
    paidAt: row.paid_at || null,
  }));

  const allOrderIds = Array.from(new Set(bills.flatMap((b) => b.orderIdsNum))).filter(Boolean);
  let orderMap = new Map<number, any>();
  if (allOrderIds.length) {
    const { data: orderRows, error: orderError } = await supabase
      .from('orders')
      .select('*,order_items(*)')
      .in('id', allOrderIds)
      .order('created_at', { ascending: true });
    if (orderError) throw new Error(errMsg(orderError, 'Failed to fetch bill round details'));
    orderMap = new Map((orderRows || []).map((row: any) => [Number(row.id), toOrder(row)]));
  }

  const enrichedBills = await Promise.all(
    bills.map(async (b) => {
      const includedRounds = b.orderIdsNum
        .map((idNum: number) => orderMap.get(idNum))
        .filter(Boolean)
        .sort((a: any, c: any) => new Date(a.createdAt).getTime() - new Date(c.createdAt).getTime());

      if (!includedRounds.length) return null;

      const firstAt = includedRounds[0].createdAt;
      const lastAt = includedRounds[includedRounds.length - 1].createdAt;

      const { data: sessionRows, error: sessionError } = await supabase
        .from('orders')
        .select('id,created_at')
        .eq('table_number', b.tableNumber)
        .eq('customer_phone', b.customerPhone)
        .gte('created_at', firstAt)
        .lte('created_at', lastAt)
        .order('created_at', { ascending: true });

      if (sessionError) throw new Error(errMsg(sessionError, 'Failed to fetch bill session rounds'));

      const roundByOrderId = new Map<number, number>();
      (sessionRows || []).forEach((row: any, idx: number) => {
        roundByOrderId.set(Number(row.id), idx + 1);
      });

      return {
        id: b.id,
        tableNumber: b.tableNumber,
        customerPhone: b.customerPhone,
        total: b.total,
        lineItems: b.lineItems,
        orderIds: b.orderIds,
        isPaid: b.isPaid,
        createdAt: b.createdAt,
        paidAt: b.paidAt,
        rounds: includedRounds.map((round: any, idx: number) => ({
          ...round,
          roundNumber: roundByOrderId.get(Number(round.id)) || idx + 1,
        })),
      };
    }),
  );

  return {
    bills: enrichedBills.filter(Boolean),
  };
};
