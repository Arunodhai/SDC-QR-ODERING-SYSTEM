import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';

export type WorkspaceProfile = {
  id: string;
  restaurantName: string;
  outletName: string;
  ownerEmail: string;
  adminUsername: string;
  kitchenUsername: string;
  currencyCode?: string;
  createdAt: string;
  updatedAt: string;
};

type WorkspaceRecord = WorkspaceProfile & {
  ownerPasswordHash: string;
  ownerSalt: string;
  adminPasswordHash: string;
  adminSalt: string;
  kitchenPasswordHash: string;
  kitchenSalt: string;
};

type WorkspaceSession = {
  workspaceId: string;
  ownerEmail: string;
  signedInAt: string;
};

const supabaseUrl = `https://${projectId}.supabase.co`;
const supabase = createClient(supabaseUrl, publicAnonKey);

const workspacesKey = 'sdc:workspaces:v1';
const workspaceSessionKey = 'sdc:workspace-session:v1';
const activeWorkspaceIdKey = 'sdc:active-workspace-id:v1';

const textEncoder = new TextEncoder();

const canUseStorage = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

const normalizeEmail = (value: string) => String(value || '').trim().toLowerCase();
const normalizeUsername = (value: string) => String(value || '').trim().toLowerCase();

const randomId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `workspace-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const randomSalt = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const slugify = (value: string) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);

const nowIso = () => new Date().toISOString();

async function hashSecret(secret: string, salt: string) {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(`${salt}:${secret}`));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readWorkspaceRecords() {
  if (!canUseStorage()) return [] as WorkspaceRecord[];
  return parseJson<WorkspaceRecord[]>(localStorage.getItem(workspacesKey), []);
}

function writeWorkspaceRecords(records: WorkspaceRecord[]) {
  if (!canUseStorage()) return;
  localStorage.setItem(workspacesKey, JSON.stringify(records));
}

function writeWorkspaceSession(session: WorkspaceSession) {
  if (!canUseStorage()) return;
  localStorage.setItem(workspaceSessionKey, JSON.stringify(session));
}

function upsertWorkspaceRecord(next: WorkspaceRecord) {
  const records = readWorkspaceRecords();
  const withoutSame = records.filter((item) => item.id !== next.id && normalizeEmail(item.ownerEmail) !== normalizeEmail(next.ownerEmail));
  writeWorkspaceRecords([next, ...withoutSame]);
}

async function fetchRemoteWorkspaceProfile(workspaceId?: string): Promise<WorkspaceProfile | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message || 'Failed to get current user');
  const user = userData.user;
  if (!user) return null;

  let targetWorkspaceId = String(workspaceId || '').trim();
  if (!targetWorkspaceId) {
    const membershipRes = await supabase
      .from('workspace_memberships')
      .select('workspace_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (membershipRes.error) throw new Error(membershipRes.error.message || 'Failed to fetch memberships');
    targetWorkspaceId = String(membershipRes.data?.workspace_id || '').trim();
  }
  if (!targetWorkspaceId) return null;

  const wsPrimary = await supabase
    .from('workspaces')
    .select('id,restaurant_name,outlet_name,owner_email,admin_username,currency_code,created_at,updated_at')
    .eq('id', targetWorkspaceId)
    .single();

  let wsRow: any = wsPrimary.data;
  if (wsPrimary.error) {
    const wsFallback = await supabase
      .from('workspaces')
      .select('id,restaurant_name,outlet_name,owner_email,currency_code,created_at,updated_at')
      .eq('id', targetWorkspaceId)
      .single();
    if (wsFallback.error) throw new Error(wsFallback.error.message || 'Failed to fetch workspace');
    wsRow = wsFallback.data;
  }

  const kitchenRes = await supabase
    .from('workspace_kitchen_auth')
    .select('username')
    .eq('workspace_id', targetWorkspaceId)
    .maybeSingle();

  return {
    id: String(wsRow.id),
    restaurantName: String(wsRow.restaurant_name || 'Workspace'),
    outletName: String(wsRow.outlet_name || ''),
    ownerEmail: String(wsRow.owner_email || user.email || ''),
    adminUsername: String(wsRow.admin_username || 'admin'),
    kitchenUsername: String(kitchenRes.data?.username || 'kitchen'),
    currencyCode: String(wsRow.currency_code || 'USD').toUpperCase(),
    createdAt: String(wsRow.created_at || nowIso()),
    updatedAt: String(wsRow.updated_at || nowIso()),
  };
}

function buildWorkspaceRecord(input: {
  profile: WorkspaceProfile;
  ownerPassword: string;
  adminPassword: string;
  kitchenPassword: string;
}) {
  return Promise.all([
    randomSalt(),
    randomSalt(),
    randomSalt(),
  ]).then(async ([ownerSalt, adminSalt, kitchenSalt]) => {
    const ownerPasswordHash = await hashSecret(input.ownerPassword, ownerSalt);
    const adminPasswordHash = await hashSecret(input.adminPassword, adminSalt);
    const kitchenPasswordHash = await hashSecret(input.kitchenPassword, kitchenSalt);
    return {
      ...input.profile,
      ownerSalt,
      adminSalt,
      kitchenSalt,
      ownerPasswordHash,
      adminPasswordHash,
      kitchenPasswordHash,
    } as WorkspaceRecord;
  });
}

export function getWorkspaceSession() {
  if (!canUseStorage()) return null as WorkspaceSession | null;
  return parseJson<WorkspaceSession | null>(localStorage.getItem(workspaceSessionKey), null);
}

export function clearWorkspaceSession() {
  if (!canUseStorage()) return;
  localStorage.removeItem(workspaceSessionKey);
  localStorage.removeItem(activeWorkspaceIdKey);
}

export function setActiveWorkspaceId(workspaceId: string) {
  if (!canUseStorage()) return;
  const trimmed = String(workspaceId || '').trim();
  if (!trimmed) {
    localStorage.removeItem(activeWorkspaceIdKey);
    return;
  }
  localStorage.setItem(activeWorkspaceIdKey, trimmed);
}

export function getActiveWorkspaceId() {
  if (!canUseStorage()) return '';
  const fromSession = getWorkspaceSession()?.workspaceId || '';
  if (fromSession) return String(fromSession);
  return String(localStorage.getItem(activeWorkspaceIdKey) || '');
}

export function getCurrentWorkspaceProfile() {
  const session = getWorkspaceSession();
  if (!session) return null as WorkspaceProfile | null;
  const record = readWorkspaceRecords().find((item) => item.id === session.workspaceId);
  if (!record) return null;
  const {
    ownerPasswordHash: _ownerPasswordHash,
    ownerSalt: _ownerSalt,
    adminPasswordHash: _adminPasswordHash,
    adminSalt: _adminSalt,
    kitchenPasswordHash: _kitchenPasswordHash,
    kitchenSalt: _kitchenSalt,
    ...profile
  } = record;
  return profile;
}

export function isWorkspaceAuthenticated() {
  return Boolean(getCurrentWorkspaceProfile());
}

export async function registerWorkspace(input: {
  restaurantName: string;
  outletName: string;
  ownerEmail: string;
  ownerPassword: string;
  adminUsername: string;
  adminPassword: string;
  kitchenUsername: string;
  kitchenPassword: string;
}) {
  const restaurantName = String(input.restaurantName || '').trim();
  const outletName = String(input.outletName || '').trim();
  const ownerEmail = normalizeEmail(input.ownerEmail);
  const ownerPassword = String(input.ownerPassword || '').trim();
  const adminUsername = String(input.adminUsername || '').trim();
  const adminPassword = String(input.adminPassword || '').trim();
  const kitchenUsername = String(input.kitchenUsername || '').trim();
  const kitchenPassword = String(input.kitchenPassword || '').trim();

  if (!restaurantName) throw new Error('Restaurant name is required');
  if (!outletName) throw new Error('Outlet name is required');
  if (!ownerEmail || !ownerEmail.includes('@')) throw new Error('Valid owner email is required');
  if (ownerPassword.length < 6) throw new Error('Owner password must be at least 6 characters');
  if (adminUsername.length < 3) throw new Error('Admin username must be at least 3 characters');
  if (adminPassword.length < 6) throw new Error('Admin password must be at least 6 characters');
  if (kitchenUsername.length < 3) throw new Error('Kitchen username must be at least 3 characters');
  if (kitchenPassword.length < 6) throw new Error('Kitchen password must be at least 6 characters');

  // First try login, so existing owners can create additional workspaces
  // without repeatedly triggering signup-email rate limits.
  let authReady = false;
  const signInFirst = await supabase.auth.signInWithPassword({
    email: ownerEmail,
    password: ownerPassword,
  });
  if (!signInFirst.error) {
    authReady = true;
  } else {
    const signUpRes = await supabase.auth.signUp({
      email: ownerEmail,
      password: ownerPassword,
    });
    if (signUpRes.error) {
      const message = String(signUpRes.error.message || '');
      const lower = message.toLowerCase();
      if (lower.includes('rate limit')) {
        throw new Error('Email rate limit exceeded. Wait 1-2 minutes and try again, or use the Login tab.');
      }
      if (lower.includes('invalid')) {
        throw new Error('Owner email is invalid. Please enter a valid email address.');
      }
      if (lower.includes('already registered')) {
        throw new Error('Owner email already exists. Use Login tab or provide the correct owner password.');
      }
      throw new Error(message || 'Failed to register workspace owner');
    }
    if (signUpRes.data.session) {
      authReady = true;
    } else {
      const secondSignIn = await supabase.auth.signInWithPassword({
        email: ownerEmail,
        password: ownerPassword,
      });
      if (!secondSignIn.error) {
        authReady = true;
      }
    }
  }

  if (!authReady) {
    throw new Error(
      'Owner account created but sign-in is pending email confirmation. Confirm the email or disable confirmation in Supabase Auth settings.',
    );
  }

  const baseSlug = slugify(`${restaurantName}-${outletName}`) || slugify(restaurantName) || 'workspace';
  const slugCandidate = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  const createRes = await supabase.rpc('create_workspace_with_owner', {
    p_slug: slugCandidate,
    p_restaurant_name: restaurantName,
    p_outlet_name: outletName,
    p_owner_email: ownerEmail,
    p_admin_username: adminUsername,
    p_kitchen_username: kitchenUsername,
    p_kitchen_password: kitchenPassword,
  });

  if (createRes.error) {
    throw new Error(
      `${createRes.error.message || 'Failed to create workspace'}. Run sql/create_multi_tenant_schema_and_rls.sql and try again.`,
    );
  }

  const workspaceId = String(createRes.data || '').trim();
  const remoteProfile = await fetchRemoteWorkspaceProfile(workspaceId);
  if (!remoteProfile) throw new Error('Workspace created but profile fetch failed');

  const profile: WorkspaceProfile = {
    ...remoteProfile,
    adminUsername,
    kitchenUsername: remoteProfile.kitchenUsername || kitchenUsername,
  };

  const record = await buildWorkspaceRecord({
    profile,
    ownerPassword,
    adminPassword,
    kitchenPassword,
  });
  upsertWorkspaceRecord(record);
  writeWorkspaceSession({
    workspaceId: profile.id,
    ownerEmail: profile.ownerEmail,
    signedInAt: nowIso(),
  });
  setActiveWorkspaceId(profile.id);

  return { workspace: getCurrentWorkspaceProfile() };
}

export async function loginWorkspace(ownerEmail: string, ownerPassword: string) {
  const email = normalizeEmail(ownerEmail);
  const password = String(ownerPassword || '').trim();
  const remoteLogin = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (remoteLogin.error) {
    const localRecord = readWorkspaceRecords().find((item) => normalizeEmail(item.ownerEmail) === email);
    if (!localRecord) throw new Error('Workspace account not found');
    const hashed = await hashSecret(password, localRecord.ownerSalt);
    if (hashed !== localRecord.ownerPasswordHash) throw new Error('Invalid email or password');
    writeWorkspaceSession({
      workspaceId: localRecord.id,
      ownerEmail: localRecord.ownerEmail,
      signedInAt: nowIso(),
    });
    setActiveWorkspaceId(localRecord.id);
    return { workspace: getCurrentWorkspaceProfile() };
  }

  const remoteProfile = await fetchRemoteWorkspaceProfile();
  if (!remoteProfile) throw new Error('No workspace is linked to this owner account');

  const existingRecord = readWorkspaceRecords().find((item) => item.id === remoteProfile.id);
  let record: WorkspaceRecord;

  if (existingRecord) {
    record = {
      ...existingRecord,
      ...remoteProfile,
      adminUsername: remoteProfile.adminUsername || existingRecord.adminUsername,
      kitchenUsername: remoteProfile.kitchenUsername || existingRecord.kitchenUsername,
      updatedAt: remoteProfile.updatedAt || nowIso(),
    };
  } else {
    // First login on this device: seed local cache from server and owner password.
    const ownerSalt = randomSalt();
    const adminSalt = randomSalt();
    const kitchenSalt = randomSalt();
    record = {
      ...remoteProfile,
      ownerSalt,
      adminSalt,
      kitchenSalt,
      ownerPasswordHash: await hashSecret(password, ownerSalt),
      adminPasswordHash: await hashSecret(password, adminSalt),
      kitchenPasswordHash: await hashSecret(password, kitchenSalt),
    };
  }

  upsertWorkspaceRecord(record);
  writeWorkspaceSession({
    workspaceId: record.id,
    ownerEmail: record.ownerEmail,
    signedInAt: nowIso(),
  });
  setActiveWorkspaceId(record.id);

  return { workspace: getCurrentWorkspaceProfile() };
}

export async function loginAdminUser(username: string, password: string) {
  const workspace = getCurrentWorkspaceProfile();
  if (!workspace) throw new Error('Workspace not authenticated');
  const record = readWorkspaceRecords().find((item) => item.id === workspace.id);
  if (!record) throw new Error('Workspace not found');
  const expectedUser = normalizeUsername(record.adminUsername);
  const enteredUser = normalizeUsername(username);
  if (!enteredUser) throw new Error('Admin username is required');
  if (enteredUser !== expectedUser) throw new Error('Invalid admin username or password');
  const hashed = await hashSecret(String(password || '').trim(), record.adminSalt);
  if (hashed !== record.adminPasswordHash) throw new Error('Invalid admin username or password');
  return { success: true, workspaceId: record.id, username: record.adminUsername };
}

export async function loginKitchenUser(username: string, password: string) {
  const workspace = getCurrentWorkspaceProfile();
  if (!workspace) throw new Error('Workspace not authenticated');
  const record = readWorkspaceRecords().find((item) => item.id === workspace.id);
  if (!record) throw new Error('Workspace not found');
  const expectedUser = normalizeUsername(record.kitchenUsername);
  const enteredUser = normalizeUsername(username);
  if (!enteredUser) throw new Error('Kitchen username is required');
  if (enteredUser !== expectedUser) throw new Error('Invalid kitchen username or password');
  const hashed = await hashSecret(String(password || '').trim(), record.kitchenSalt);
  if (hashed !== record.kitchenPasswordHash) throw new Error('Invalid kitchen username or password');
  return { success: true, workspaceId: record.id, username: record.kitchenUsername };
}

export async function updateKitchenCredentials(input: {
  currentUsername: string;
  currentPassword: string;
  nextUsername?: string;
  nextPassword?: string;
}) {
  const workspace = getCurrentWorkspaceProfile();
  if (!workspace) throw new Error('Workspace not authenticated');
  const records = readWorkspaceRecords();
  const record = records.find((item) => item.id === workspace.id);
  if (!record) throw new Error('Workspace not found');

  const enteredCurrentUsername = normalizeUsername(input.currentUsername);
  if (enteredCurrentUsername !== normalizeUsername(record.kitchenUsername)) {
    throw new Error('Invalid current username or password');
  }

  const currentPasswordHash = await hashSecret(String(input.currentPassword || '').trim(), record.kitchenSalt);
  if (currentPasswordHash !== record.kitchenPasswordHash) {
    throw new Error('Invalid current username or password');
  }

  if (input.nextUsername) {
    const nextUsername = String(input.nextUsername || '').trim();
    if (nextUsername.length < 3) throw new Error('New username must be at least 3 characters');
    record.kitchenUsername = nextUsername;
  }

  if (input.nextPassword) {
    const nextPassword = String(input.nextPassword || '').trim();
    if (nextPassword.length < 6) throw new Error('New password must be at least 6 characters');
    const nextSalt = randomSalt();
    record.kitchenSalt = nextSalt;
    record.kitchenPasswordHash = await hashSecret(nextPassword, nextSalt);
  }

  record.updatedAt = nowIso();
  writeWorkspaceRecords([...records]);
  return { success: true, username: record.kitchenUsername };
}
