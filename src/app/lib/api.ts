import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import {
  getActiveWorkspaceId as getStoredActiveWorkspaceId,
  getCurrentWorkspaceProfile,
  loginAdminUser,
  loginKitchenUser,
  updateKitchenCredentials,
} from './workspaceAuth';

const supabaseUrl = `https://${projectId}.supabase.co`;
const supabase = createClient(supabaseUrl, publicAnonKey);
const imageBucket = 'menu-images';
const adminAvatarBucket = 'admin-avatars';
const kitchenSessionKey = 'sdc:kitchen-session-v1';
const adminWorkspaceSessionKey = 'sdc:admin-workspace-session-v1';

const kitchenAuthSetupHint =
  'Kitchen auth is not configured in DB. Run sql/create_multi_tenant_schema_and_rls.sql in Supabase SQL editor.';

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
  dietaryType: row.dietary_type || 'NON_VEG',
  createdAt: row.created_at,
});

const toOrderItem = (row: any) => ({
  menuItemId: row.menu_item_id ? String(row.menu_item_id) : '',
  name: row.item_name,
  price: Number(row.unit_price || 0),
  quantity: Number(row.quantity || 0),
  lineTotal: Number(row.line_total || 0),
  isCancelled: Boolean(row.is_cancelled),
  cancelReason: row.cancel_reason || '',
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
  statusReason: row.status_reason || row.cancellation_reason || row.cancel_reason || '',
  paymentStatus: row.payment_status,
  paymentMethod: row.payment_method,
  createdAt: row.created_at,
});

const normalizeItemName = (name: string) =>
  String(name || '')
    .replace(/\s*\(Note:.*\)\s*$/i, '')
    .trim()
    .toLowerCase();

const getRemovedItemsFromReason = (reason?: string) => {
  const msg = String(reason || '');
  const match = msg.match(/Unavailable item(?:s)? removed:\s*(.+)$/i);
  if (!match?.[1]) return new Set<string>();
  return new Set(
    match[1]
      .split(',')
      .map((part) => normalizeItemName(part))
      .filter(Boolean),
  );
};

const aggregateBillLineItems = (orders: any[]) => {
  const map = new Map<string, { name: string; quantity: number; unitPrice: number; lineTotal: number }>();
  (orders || []).forEach((order) => {
    const removedNames = getRemovedItemsFromReason(order?.statusReason);
    (order.items || []).forEach((item: any) => {
      if (item.isCancelled) return;
      if (removedNames.has(normalizeItemName(item.name))) return;
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

const missingWorkspaceHint =
  'Workspace context is missing. Sign in to a workspace first or open the workspace-specific access link.';

const getActiveWorkspaceId = () => {
  const workspace = getCurrentWorkspaceProfile();
  const workspaceId = workspace?.id ? String(workspace.id) : String(getStoredActiveWorkspaceId() || '');
  if (!workspaceId) {
    throw new Error(missingWorkspaceHint);
  }
  return workspaceId;
};

const ensureOwnerAuthSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(errMsg(error, 'Failed to validate auth session'));
  if (!data.session) {
    throw new Error('Auth session missing. Please sign in from Workspace Sign In and try again.');
  }
  return data.session;
};

export const adminSignIn = async (identifier: string, password: string) => {
  const workspace = getCurrentWorkspaceProfile();
  if (workspace) {
    await ensureOwnerAuthSession();
    await loginAdminUser(identifier, password);
    const session = {
      role: 'admin',
      workspaceId: workspace.id,
      username: workspace.adminUsername,
      signedInAt: new Date().toISOString(),
    };
    localStorage.setItem(adminWorkspaceSessionKey, JSON.stringify(session));
    return { session };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email: identifier, password });
  if (error) throw new Error(errMsg(error, 'Admin login failed'));
  return data;
};

export const adminSignOut = async () => {
  localStorage.removeItem(adminWorkspaceSessionKey);
  const { error } = await supabase.auth.signOut();
  if (error && !String(error.message || '').toLowerCase().includes('session')) {
    throw new Error(errMsg(error, 'Logout failed'));
  }
  return { success: true };
};

export const getAdminSession = async () => {
  const workspaceRaw = localStorage.getItem(adminWorkspaceSessionKey);
  if (workspaceRaw) {
    try {
      const parsed = JSON.parse(workspaceRaw);
      const activeWorkspaceId = getActiveWorkspaceId();
      if (parsed?.workspaceId && activeWorkspaceId && String(parsed.workspaceId) !== String(activeWorkspaceId)) {
        localStorage.removeItem(adminWorkspaceSessionKey);
        return null;
      }
      return parsed;
    } catch {
      localStorage.removeItem(adminWorkspaceSessionKey);
    }
  }
  return null;
};

export const hasAdminWorkspaceSession = () => {
  try {
    const raw = localStorage.getItem(adminWorkspaceSessionKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const activeWorkspaceId = getCurrentWorkspaceProfile()?.id || '';
    if (parsed?.workspaceId && activeWorkspaceId && String(parsed.workspaceId) !== String(activeWorkspaceId)) {
      localStorage.removeItem(adminWorkspaceSessionKey);
      return false;
    }
    return Boolean(parsed?.role === 'admin');
  } catch {
    localStorage.removeItem(adminWorkspaceSessionKey);
    return false;
  }
};

const getCurrentAdminUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(errMsg(error, 'Failed to get current user'));
  if (!data.user) throw new Error('Admin is not authenticated');
  return data.user;
};

const isMissingAdminProfileSetup = (error: any) => {
  const message = String(error?.message || '');
  return (
    message.includes('admin_profiles') ||
    message.includes('admin-avatars') ||
    message.includes('storage') ||
    message.includes('bucket')
  );
};

const adminProfileSetupHint =
  'Run sql/create_multi_tenant_schema_and_rls.sql in Supabase SQL editor to enable tenant-safe admin profile and avatar storage.';

export const getAdminProfile = async () => {
  const user = await getCurrentAdminUser();
  const workspaceId = getActiveWorkspaceId();
  const { data, error } = await supabase
    .from('admin_profiles')
    .select('user_id, avatar_url, display_name')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    if (isMissingAdminProfileSetup(error)) {
      throw new Error(adminProfileSetupHint);
    }
    throw new Error(errMsg(error, 'Failed to fetch admin profile'));
  }

  if (!data) {
    return {
      profile: {
        userId: user.id,
        avatarUrl: '',
        displayName: user.user_metadata?.full_name || 'Admin',
      },
    };
  }

  return {
    profile: {
      userId: String(data.user_id),
      avatarUrl: data.avatar_url || '',
      displayName: data.display_name || user.user_metadata?.full_name || 'Admin',
    },
  };
};

export const uploadAdminAvatar = async (file: File) => {
  await ensureOwnerAuthSession();
  const user = await getCurrentAdminUser();
  const workspaceId = getActiveWorkspaceId();
  const ext = (file.name.includes('.') ? file.name.split('.').pop() : 'png') || 'png';
  const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `${workspaceId}/admin/${user.id}/avatar.${safeExt}`;

  const { error: uploadError } = await supabase.storage.from(adminAvatarBucket).upload(path, file, { upsert: true });
  if (uploadError) {
    if (isMissingAdminProfileSetup(uploadError)) {
      throw new Error(adminProfileSetupHint);
    }
    throw new Error(errMsg(uploadError, 'Failed to upload admin avatar'));
  }

  const { data: publicUrlData } = supabase.storage.from(adminAvatarBucket).getPublicUrl(path);
  return { url: `${publicUrlData.publicUrl}?v=${Date.now()}` };
};

export const upsertAdminProfileAvatar = async (avatarUrl: string) => {
  await ensureOwnerAuthSession();
  const user = await getCurrentAdminUser();
  const workspaceId = getActiveWorkspaceId();
  const displayName = (user.user_metadata?.full_name as string) || 'Admin';
  const { data, error } = await supabase
    .from('admin_profiles')
    .upsert(
      {
        workspace_id: workspaceId,
        user_id: user.id,
        avatar_url: avatarUrl || null,
        display_name: displayName,
      },
      { onConflict: 'user_id' },
    )
    .select('user_id, avatar_url, display_name, workspace_id')
    .single();

  if (error) {
    if (isMissingAdminProfileSetup(error)) {
      throw new Error(adminProfileSetupHint);
    }
    throw new Error(errMsg(error, 'Failed to update admin profile'));
  }

  return {
    profile: {
      userId: String(data.user_id),
      avatarUrl: data.avatar_url || '',
      displayName: data.display_name || displayName,
    },
  };
};

export const saveAdminAvatar = async (file: File) => {
  const { url } = await uploadAdminAvatar(file);
  const { profile } = await upsertAdminProfileAvatar(url);
  return { profile };
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

  const workspace = getCurrentWorkspaceProfile();
  if (workspace) {
    const { data, error } = await supabase.rpc('verify_kitchen_credentials', {
      p_workspace_id: workspace.id,
      p_username: enteredName,
      p_password: enteredPassword,
    });
    if (error) {
      // Local fallback keeps demo mode running if DB RPC is not migrated yet.
      await loginKitchenUser(enteredName, enteredPassword);
    } else if (!data) {
      throw new Error('Invalid username or password');
    }
  } else {
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
  }

  const session = {
    role: 'kitchen',
    name: enteredName,
    workspaceId: workspace?.id || '',
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
  const workspace = getCurrentWorkspaceProfile();
  if (workspace) {
    const { data, error } = await supabase.rpc('change_kitchen_password', {
      p_workspace_id: workspace.id,
      p_username: String(username || '').trim(),
      p_current: String(currentPassword || '').trim(),
      p_next: String(nextPassword || '').trim(),
    });
    if (error) {
      await updateKitchenCredentials({
        currentUsername: username,
        currentPassword,
        nextPassword,
      });
      return { success: true };
    }
    if (!data) throw new Error('Invalid username or current password');
    return { success: true };
  }

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
  const workspace = getCurrentWorkspaceProfile();
  if (workspace) {
    const { data, error } = await supabase.rpc('change_kitchen_username', {
      p_workspace_id: workspace.id,
      p_current_username: String(currentUsername || '').trim(),
      p_current_password: String(currentPassword || '').trim(),
      p_next_username: String(nextUsername || '').trim(),
    });
    if (error) {
      const result = await updateKitchenCredentials({
        currentUsername,
        currentPassword,
        nextUsername,
      });
      return { success: true, username: result.username };
    }
    if (!data) throw new Error('Invalid current username or password');
    return { success: true, username: String(nextUsername || '').trim() };
  }

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
  const workspaceId = getActiveWorkspaceId();
  const { error } = await supabase.from('categories').select('id').eq('workspace_id', workspaceId).limit(1);
  if (error) throw new Error(errMsg(error, 'Supabase connection failed'));
  return { status: 'ok' };
};

// Categories
export const getCategories = async () => {
  const workspaceId = getActiveWorkspaceId();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('name');
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
  await ensureOwnerAuthSession();
  const workspaceId = getActiveWorkspaceId();
  const { data, error } = await supabase
    .from('categories')
    .insert({ name, workspace_id: workspaceId })
    .select()
    .single();
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
  const workspaceId = getActiveWorkspaceId();
  const { data, error } = await supabase
    .from('categories')
    .update({ name: updates.name })
    .eq('workspace_id', workspaceId)
    .eq('id', Number(id))
    .select()
    .single();

  if (error) throw new Error(errMsg(error, 'Failed to update category'));
  return { category: { id: String(data.id), name: data.name, createdAt: data.created_at } };
};

export const deleteCategory = async (id: string) => {
  const workspaceId = getActiveWorkspaceId();
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', Number(id));
  if (error) throw new Error(errMsg(error, 'Failed to delete category'));
  return { success: true };
};

// Menu Items
export const getMenuItems = async () => {
  const workspaceId = getActiveWorkspaceId();
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(errMsg(error, 'Failed to fetch menu items'));
  return { items: (data || []).map(toMenuItem) };
};

export const createMenuItem = async (item: any) => {
  const workspaceId = getActiveWorkspaceId();
  const payload = {
    workspace_id: workspaceId,
    category_id: Number(item.categoryId),
    name: item.name,
    price: Number(item.price),
    description: item.description || '',
    image_url: item.image || null,
    is_available: item.available !== false,
    dietary_type: item.dietaryType || 'NON_VEG',
  };

  const { data, error } = await supabase.from('menu_items').insert(payload).select().single();
  if (error) throw new Error(errMsg(error, 'Failed to create menu item'));
  return { item: toMenuItem(data) };
};

export const updateMenuItem = async (id: string, updates: any) => {
  const workspaceId = getActiveWorkspaceId();
  const patch: any = {};
  if (updates.categoryId !== undefined) patch.category_id = Number(updates.categoryId);
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.price !== undefined) patch.price = Number(updates.price);
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.image !== undefined) patch.image_url = updates.image || null;
  if (updates.available !== undefined) patch.is_available = Boolean(updates.available);
  if (updates.dietaryType !== undefined) patch.dietary_type = updates.dietaryType || 'NON_VEG';

  const { data, error } = await supabase
    .from('menu_items')
    .update(patch)
    .eq('workspace_id', workspaceId)
    .eq('id', Number(id))
    .select()
    .single();

  if (error) throw new Error(errMsg(error, 'Failed to update menu item'));
  return { item: toMenuItem(data) };
};

export const deleteMenuItem = async (id: string) => {
  const workspaceId = getActiveWorkspaceId();
  const { error } = await supabase
    .from('menu_items')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', Number(id));
  if (error) throw new Error(errMsg(error, 'Failed to delete menu item'));
  return { success: true };
};

export const uploadImage = async (file: File) => {
  const workspaceId = getActiveWorkspaceId();
  const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : 'jpg';
  const path = `${workspaceId}/menu/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
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
  const workspaceId = getActiveWorkspaceId();
  const { data, error } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('table_number');
  if (error) throw new Error(errMsg(error, 'Failed to fetch tables'));

  const tables = (data || []).map((row) => ({
    id: String(row.id),
    tableNumber: Number(row.table_number),
  }));

  return { tables };
};

export const createTable = async (tableNumber: number) => {
  await ensureOwnerAuthSession();
  const workspaceId = getActiveWorkspaceId();
  const { data, error } = await supabase
    .from('restaurant_tables')
    .insert({ table_number: tableNumber, workspace_id: workspaceId })
    .select()
    .single();

  if (error) {
    const message = String(error.message || '').toLowerCase();
    if (message.includes('restaurant_tables_table_number_key') || message.includes('uq_restaurant_tables_workspace_table_number')) {
      throw new Error(`Table ${tableNumber} already exists in this workspace`);
    }
    throw new Error(errMsg(error, 'Failed to create table'));
  }
  return { table: { id: String(data.id), tableNumber: Number(data.table_number) } };
};

export const deleteTable = async (id: string) => {
  const workspaceId = getActiveWorkspaceId();
  const { error } = await supabase
    .from('restaurant_tables')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', Number(id));
  if (error) throw new Error(errMsg(error, 'Failed to delete table'));
  return { success: true };
};

// Orders
export const getOrders = async () => {
  const workspaceId = getActiveWorkspaceId();
  const { data, error } = await supabase
    .from('orders')
    .select('*,order_items(*)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(errMsg(error, 'Failed to fetch orders'));
  return { orders: (data || []).map(toOrder) };
};

export const getOrderById = async (id: string) => {
  const workspaceId = getActiveWorkspaceId();
  const { data, error } = await supabase
    .from('orders')
    .select('*,order_items(*)')
    .eq('workspace_id', workspaceId)
    .eq('id', Number(id))
    .single();

  if (error) throw new Error(errMsg(error, 'Failed to fetch order'));
  return { order: toOrder(data) };
};

export const createOrder = async (order: any) => {
  const workspaceId = getActiveWorkspaceId();
  const total = Number(order.total || 0);
  const requestedItems = (order.items || []).filter((item: any) => item?.id);
  const requestedIds = requestedItems.map((item: any) => Number(item.id)).filter(Boolean);

  if (requestedIds.length > 0) {
    const { data: menuRows, error: menuError } = await supabase
      .from('menu_items')
      .select('id,name,is_available')
      .eq('workspace_id', workspaceId)
      .in('id', requestedIds);

    if (menuError) throw new Error(errMsg(menuError, 'Failed to validate item availability'));

    const rowMap = new Map((menuRows || []).map((row: any) => [Number(row.id), row]));
    const unavailableNames: string[] = [];

    requestedItems.forEach((item: any) => {
      const row = rowMap.get(Number(item.id));
      if (!row || !row.is_available) {
        unavailableNames.push(String(item.name || row?.name || `Item ${item.id}`));
      }
    });

    if (unavailableNames.length > 0) {
      throw new Error(
        `These items are no longer available: ${Array.from(new Set(unavailableNames)).join(', ')}`,
      );
    }
  }

  let createdOrder: any = null;

  const { data: createdOrderWithPhone, error: orderErrorWithPhone } = await supabase
    .from('orders')
    .insert({
      workspace_id: workspaceId,
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
          workspace_id: workspaceId,
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
    workspace_id: workspaceId,
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
    .eq('workspace_id', workspaceId)
    .eq('id', createdOrder.id)
    .single();

  if (fullOrderError) throw new Error(errMsg(fullOrderError, 'Failed to fetch created order'));
  return { order: toOrder(fullOrder) };
};

const isMissingStatusReasonColumn = (error: any) => {
  const msg = String(error?.message || '');
  return msg.includes('status_reason') || msg.includes('cancellation_reason') || msg.includes('cancel_reason');
};

const isMissingOrderItemCancelColumns = (error: any) => {
  const msg = String(error?.message || '');
  return msg.includes('is_cancelled') || msg.includes('cancel_reason');
};

export const updateOrderStatus = async (id: string, status: string, statusReason?: string) => {
  const workspaceId = getActiveWorkspaceId();
  const patch: any = { status };
  if (statusReason !== undefined) patch.status_reason = statusReason;

  const { data, error } = await supabase
    .from('orders')
    .update(patch)
    .eq('workspace_id', workspaceId)
    .eq('id', Number(id))
    .select('*,order_items(*)')
    .single();

  if (error) {
    if (statusReason !== undefined && isMissingStatusReasonColumn(error)) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('orders')
        .update({ status })
        .eq('workspace_id', workspaceId)
        .eq('id', Number(id))
        .select('*,order_items(*)')
        .single();
      if (fallbackError) throw new Error(errMsg(fallbackError, 'Failed to update order status'));
      return { order: toOrder(fallbackData) };
    }
    throw new Error(errMsg(error, 'Failed to update order status'));
  }
  return { order: toOrder(data) };
};

export const updateOrderPayment = async (id: string, paymentStatus: string, paymentMethod?: string) => {
  const workspaceId = getActiveWorkspaceId();
  const patch: Record<string, any> = { payment_status: paymentStatus };
  if (paymentMethod) patch.payment_method = paymentMethod === 'CASH' ? 'COUNTER' : paymentMethod;
  const { data, error } = await supabase
    .from('orders')
    .update(patch)
    .eq('workspace_id', workspaceId)
    .eq('id', Number(id))
    .select('*,order_items(*)')
    .single();

  if (error) throw new Error(errMsg(error, 'Failed to update order payment'));
  return { order: toOrder(data) };
};

export const getUnpaidBillByTableAndPhone = async (tableNumber: number, phone: string) => {
  const workspaceId = getActiveWorkspaceId();
  const latestPaidBoundary = await supabase
    .from('orders')
    .select('created_at')
    .eq('workspace_id', workspaceId)
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
    .eq('workspace_id', workspaceId)
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
  const workspaceId = getActiveWorkspaceId();
  if (!orderIds.length) return { success: true };
  const ids = orderIds.map((id) => Number(id));
  const primaryMethod = paymentMethod === 'CASH' ? 'COUNTER' : paymentMethod;

  const { error } = await supabase
    .from('orders')
    .update({ payment_status: 'PAID', payment_method: primaryMethod })
    .eq('workspace_id', workspaceId)
    .in('id', ids);

  if (!error) return { success: true, storedMethod: primaryMethod };

  // Fallback for schemas that don't yet include UPI/CARD enum variants.
  if (isPaymentMethodEnumError(error)) {
    const fallbackMethod = 'COUNTER';
    const { error: fallbackError } = await supabase
      .from('orders')
      .update({ payment_status: 'PAID', payment_method: fallbackMethod })
      .eq('workspace_id', workspaceId)
      .in('id', ids);
    if (!fallbackError) {
      return { success: true, storedMethod: fallbackMethod, downgraded: true };
    }
    throw new Error(`${errMsg(fallbackError, 'Failed to mark orders as paid')} ${paymentEnumHint}`);
  }

  throw new Error(errMsg(error, 'Failed to mark orders as paid'));
};

export const cancelPendingOrder = async (id: string, phone?: string, reason = 'Cancelled by customer') => {
  const workspaceId = getActiveWorkspaceId();
  let query = supabase
    .from('orders')
    .update({ status: 'CANCELLED', status_reason: reason })
    .eq('workspace_id', workspaceId)
    .eq('id', Number(id))
    .eq('status', 'PENDING');
  if (phone) query = query.eq('customer_phone', phone);
  const { error } = await query.select('id').single();

  if (!error) return { success: true, reason };

  const msg = String(error.message || '');
  const enumCancelledMissing =
    msg.includes('invalid input value for enum order_status') && msg.includes('CANCELLED');
  const missingReasonOnly = isMissingStatusReasonColumn(error);

  if (missingReasonOnly) {
    let fallbackQuery = supabase
      .from('orders')
      .update({ status: 'CANCELLED' })
      .eq('workspace_id', workspaceId)
      .eq('id', Number(id))
      .eq('status', 'PENDING');
    if (phone) fallbackQuery = fallbackQuery.eq('customer_phone', phone);
    const { error: fallbackError } = await fallbackQuery.select('id').single();
    if (!fallbackError) return { success: true, reason };
    if (
      String(fallbackError.message || '').includes('invalid input value for enum order_status') &&
      String(fallbackError.message || '').includes('CANCELLED')
    ) {
      // continue to delete fallback below
    } else {
      throw new Error(errMsg(fallbackError, 'Failed to cancel order'));
    }
  }

  if (!enumCancelledMissing) {
    throw new Error(errMsg(error, 'Failed to cancel order'));
  }

  // Backward compatibility: if DB enum doesn't include CANCELLED, hard-delete pending order.
  let deleteQuery = supabase
    .from('orders')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', Number(id))
    .eq('status', 'PENDING');
  if (phone) deleteQuery = deleteQuery.eq('customer_phone', phone);
  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw new Error(errMsg(deleteError, 'Failed to cancel order'));
  return { success: true, reason };
};

export const rejectOrderOutOfStock = async (
  id: string,
  reason = 'One or more items became unavailable after order placement',
) => {
  const workspaceId = getActiveWorkspaceId();
  const payload: any = { status: 'CANCELLED', status_reason: reason };
  let query = supabase
    .from('orders')
    .update(payload)
    .eq('workspace_id', workspaceId)
    .eq('id', Number(id))
    .in('status', ['PENDING', 'PREPARING', 'READY'])
    .select('*,order_items(*)')
    .single();

  let { data, error } = await query;

  if (error && isMissingStatusReasonColumn(error)) {
    const fallback = await supabase
      .from('orders')
      .update({ status: 'CANCELLED' })
      .eq('workspace_id', workspaceId)
      .eq('id', Number(id))
      .in('status', ['PENDING', 'PREPARING', 'READY'])
      .select('*,order_items(*)')
      .single();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw new Error(errMsg(error, 'Failed to mark order as unavailable'));
  return { order: toOrder(data), reason };
};

export const applyUnavailableItemsToOrder = async (id: string) => {
  const workspaceId = getActiveWorkspaceId();
  const orderId = Number(id);
  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .select('*,order_items(*)')
    .eq('workspace_id', workspaceId)
    .eq('id', orderId)
    .single();

  if (orderError) throw new Error(errMsg(orderError, 'Failed to fetch order'));

  const orderItems = orderRow?.order_items || [];
  const menuItemIds = Array.from(
    new Set(
      orderItems
        .map((item: any) => Number(item.menu_item_id))
        .filter(Boolean),
    ),
  );

  if (!menuItemIds.length) {
    return { order: toOrder(orderRow), unavailableItems: [] as string[], allItemsUnavailable: false };
  }

  const { data: menuRows, error: menuError } = await supabase
    .from('menu_items')
    .select('id,name,is_available')
    .eq('workspace_id', workspaceId)
    .in('id', menuItemIds);
  if (menuError) throw new Error(errMsg(menuError, 'Failed to check item availability'));

  const menuMap = new Map((menuRows || []).map((row: any) => [Number(row.id), row]));
  const unavailableMenuNames = new Set(
    (menuRows || [])
      .filter((row: any) => !row.is_available)
      .map((row: any) => String(row.name || '').trim().toLowerCase()),
  );

  const targetItemRows = orderItems.filter((item: any) => {
    const menuId = Number(item.menu_item_id);
    const rawName = String(item.item_name || '').replace(/\s*\(Note:.*\)\s*$/i, '').trim().toLowerCase();
    const menu = menuId ? menuMap.get(menuId) : null;
    const alreadyCancelled = Boolean(item.is_cancelled);
    const unavailableById = Boolean(menu && !menu.is_available);
    const unavailableByName = rawName ? unavailableMenuNames.has(rawName) : false;
    return !alreadyCancelled && (unavailableById || unavailableByName);
  });

  if (!targetItemRows.length) {
    return { order: toOrder(orderRow), unavailableItems: [] as string[], allItemsUnavailable: false };
  }

  const unavailableNames = Array.from(
    new Set(
      targetItemRows.map((item: any) => {
        const menu = menuMap.get(Number(item.menu_item_id));
        return String(menu?.name || item.item_name || 'Unknown item');
      }),
    ),
  );

  const targetIds = targetItemRows.map((item: any) => Number(item.id)).filter(Boolean);
  if (targetIds.length) {
    const reasonText = `Unavailable item${unavailableNames.length > 1 ? 's' : ''}: ${unavailableNames.join(', ')}`;
    const { error: updateItemsError } = await supabase
      .from('order_items')
      .update({ is_cancelled: true, cancel_reason: reasonText })
      .eq('workspace_id', workspaceId)
      .in('id', targetIds);

    if (updateItemsError) {
      if (isMissingOrderItemCancelColumns(updateItemsError)) {
        const { error: deleteItemsError } = await supabase
          .from('order_items')
          .delete()
          .eq('workspace_id', workspaceId)
          .in('id', targetIds);
        if (deleteItemsError) throw new Error(errMsg(deleteItemsError, 'Failed to remove unavailable items'));
      } else {
        throw new Error(errMsg(updateItemsError, 'Failed to update unavailable items'));
      }
    }
  }

  const { data: refreshedOrderRow, error: refreshedError } = await supabase
    .from('orders')
    .select('*,order_items(*)')
    .eq('workspace_id', workspaceId)
    .eq('id', orderId)
    .single();
  if (refreshedError) throw new Error(errMsg(refreshedError, 'Failed to refresh order'));

  const refreshedItems = refreshedOrderRow?.order_items || [];
  const cancelledByThisAction = new Set(targetIds.map((v) => Number(v)));
  const payableItems = refreshedItems.filter(
    (item: any) => !item.is_cancelled && !cancelledByThisAction.has(Number(item.id)),
  );
  const newTotal = payableItems.reduce((sum: number, item: any) => sum + Number(item.line_total || 0), 0);
  const allItemsUnavailable = payableItems.length === 0;
  const orderReason = `Unavailable item${unavailableNames.length > 1 ? 's' : ''} removed: ${unavailableNames.join(', ')}`;
  const patch: any = { total_amount: newTotal, status_reason: orderReason };
  if (allItemsUnavailable) patch.status = 'CANCELLED';

  const { data: updatedOrderRow, error: updateOrderError } = await supabase
    .from('orders')
    .update(patch)
    .eq('workspace_id', workspaceId)
    .eq('id', orderId)
    .select('*,order_items(*)')
    .single();

  if (updateOrderError) {
    if (isMissingStatusReasonColumn(updateOrderError)) {
      const fallbackPatch: any = { total_amount: newTotal };
      if (allItemsUnavailable) fallbackPatch.status = 'CANCELLED';
      const { data: fallbackRow, error: fallbackError } = await supabase
        .from('orders')
        .update(fallbackPatch)
        .eq('workspace_id', workspaceId)
        .eq('id', orderId)
        .select('*,order_items(*)')
        .single();
      if (fallbackError) throw new Error(errMsg(fallbackError, 'Failed to update order'));
      return { order: toOrder(fallbackRow), unavailableItems: unavailableNames, allItemsUnavailable };
    }
    throw new Error(errMsg(updateOrderError, 'Failed to update order'));
  }

  return { order: toOrder(updatedOrderRow), unavailableItems: unavailableNames, allItemsUnavailable };
};

export const getActiveOrdersByTableAndPhone = async (tableNumber: number, phone: string) => {
  const workspaceId = getActiveWorkspaceId();
  const { data, error } = await supabase
    .from('orders')
    .select('*,order_items(*)')
    .eq('workspace_id', workspaceId)
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
  const workspaceId = getActiveWorkspaceId();
  const latestPaidBoundary = await supabase
    .from('orders')
    .select('created_at')
    .eq('workspace_id', workspaceId)
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
    .eq('workspace_id', workspaceId)
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
  const workspaceId = getActiveWorkspaceId();
  const { data, error } = await supabase
    .from('final_bills')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('table_number', Number(tableNumber))
    .eq('customer_phone', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (String(error.message || '').includes('final_bills')) {
      throw new Error('DB is missing final_bills table. Run sql/create_multi_tenant_schema_and_rls.sql in Supabase SQL editor.');
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
  const workspaceId = getActiveWorkspaceId();
  const { data, error } = await supabase
    .from('final_bills')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });

  if (error) {
    if (String(error.message || '').includes('final_bills')) {
      throw new Error('DB is missing final_bills table. Run sql/create_multi_tenant_schema_and_rls.sql in Supabase SQL editor.');
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
  const workspaceId = getActiveWorkspaceId();
  const bill = await getUnpaidBillByTableAndPhone(tableNumber, phone);
  if (!bill.orders.length) {
    return { bill: null };
  }

  const payload = {
    workspace_id: workspaceId,
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
      throw new Error('DB is missing final_bills table. Run sql/create_multi_tenant_schema_and_rls.sql in Supabase SQL editor.');
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
  const workspaceId = getActiveWorkspaceId();
  const { data, error } = await supabase
    .from('final_bills')
    .update({ is_paid: true, paid_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
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
  const workspaceId = getActiveWorkspaceId();
  const { data, error } = await supabase
    .from('final_bills')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('customer_phone', phone)
    .eq('is_paid', true)
    .order('paid_at', { ascending: false });

  if (error) {
    if (String(error.message || '').includes('final_bills')) {
      throw new Error('DB is missing final_bills table. Run sql/create_multi_tenant_schema_and_rls.sql in Supabase SQL editor.');
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
      .eq('workspace_id', workspaceId)
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
        .eq('workspace_id', workspaceId)
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

export const subscribeToOrderChanges = (onChange: (payload: any) => void) => {
  const workspaceId = getActiveWorkspaceId();
  const channel = supabase
    .channel(`orders-live-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `workspace_id=eq.${workspaceId}` },
      (payload) => onChange(payload),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const subscribeToMenuItemChanges = (onChange: (payload: any) => void) => {
  const workspaceId = getActiveWorkspaceId();
  const channel = supabase
    .channel(`menu-items-live-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'menu_items', filter: `workspace_id=eq.${workspaceId}` },
      (payload) => onChange(payload),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const createServiceRequest = async ({
  tableNumber,
  customerName,
  customerPhone,
  type = 'ASSISTANCE',
  message = 'Need assistance at table',
}: {
  tableNumber: number;
  customerName?: string;
  customerPhone?: string;
  type?: string;
  message?: string;
}) => {
  const workspaceId = getActiveWorkspaceId();
  const { data, error } = await supabase
    .from('service_requests')
    .insert({
      workspace_id: workspaceId,
      table_number: Number(tableNumber),
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      request_type: type,
      message,
      status: 'OPEN',
    })
    .select()
    .single();

  if (error) {
    if (String(error.message || '').includes('service_requests')) {
      throw new Error('DB is missing service_requests table. Run sql/create_multi_tenant_schema_and_rls.sql in Supabase SQL editor.');
    }
    throw new Error(errMsg(error, 'Failed to create service request'));
  }

  return { request: data };
};

export const getOpenServiceRequests = async () => {
  const workspaceId = getActiveWorkspaceId();
  const { data, error } = await supabase
    .from('service_requests')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'OPEN')
    .order('created_at', { ascending: false });

  if (error) {
    if (String(error.message || '').includes('service_requests')) {
      throw new Error('DB is missing service_requests table. Run sql/create_multi_tenant_schema_and_rls.sql in Supabase SQL editor.');
    }
    throw new Error(errMsg(error, 'Failed to fetch service requests'));
  }
  return { requests: data || [] };
};

export const resolveServiceRequest = async (id: string) => {
  const workspaceId = getActiveWorkspaceId();
  const { error } = await supabase
    .from('service_requests')
    .update({ status: 'RESOLVED' })
    .eq('workspace_id', workspaceId)
    .eq('id', Number(id));
  if (error) throw new Error(errMsg(error, 'Failed to resolve service request'));
  return { success: true };
};
