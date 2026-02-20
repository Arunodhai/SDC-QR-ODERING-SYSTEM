import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const supabaseUrl = `https://${projectId}.supabase.co`;
const supabase = createClient(supabaseUrl, publicAnonKey);
const imageBucket = 'menu-images';

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

export const updateOrderPayment = async (id: string, paymentStatus: string) => {
  const { data, error } = await supabase
    .from('orders')
    .update({ payment_status: paymentStatus })
    .eq('id', Number(id))
    .select('*,order_items(*)')
    .single();

  if (error) throw new Error(errMsg(error, 'Failed to update order payment'));
  return { order: toOrder(data) };
};

export const getUnpaidBillByTableAndPhone = async (tableNumber: number, phone: string) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*,order_items(*)')
    .eq('table_number', Number(tableNumber))
    .eq('customer_phone', phone)
    .eq('payment_status', 'UNPAID')
    .order('created_at', { ascending: true });

  if (error) throw new Error(errMsg(error, 'Failed to fetch unpaid bill'));
  const orders = (data || []).map(toOrder);
  const total = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  return { orders, total };
};

export const markOrdersPaidBulk = async (orderIds: string[]) => {
  if (!orderIds.length) return { success: true };
  const ids = orderIds.map((id) => Number(id));
  const { error } = await supabase
    .from('orders')
    .update({ payment_status: 'PAID' })
    .in('id', ids);

  if (error) throw new Error(errMsg(error, 'Failed to mark orders as paid'));
  return { success: true };
};

export const cancelPendingOrder = async (id: string, phone?: string) => {
  let query = supabase.from('orders').delete().eq('id', Number(id)).eq('status', 'PENDING');
  if (phone) query = query.eq('customer_phone', phone);
  const { error } = await query;

  if (error) throw new Error(errMsg(error, 'Failed to cancel order'));
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
