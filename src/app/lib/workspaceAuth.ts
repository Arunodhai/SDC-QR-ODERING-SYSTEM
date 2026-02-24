export type WorkspaceProfile = {
  id: string;
  restaurantName: string;
  outletName: string;
  ownerEmail: string;
  adminUsername: string;
  kitchenUsername: string;
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

  const records = readWorkspaceRecords();
  const takenOwner = records.some((record) => normalizeEmail(record.ownerEmail) === ownerEmail);
  if (takenOwner) throw new Error('An account already exists with this owner email');

  const now = new Date().toISOString();
  const ownerSalt = randomSalt();
  const adminSalt = randomSalt();
  const kitchenSalt = randomSalt();

  const nextRecord: WorkspaceRecord = {
    id: randomId(),
    restaurantName,
    outletName,
    ownerEmail,
    adminUsername,
    kitchenUsername,
    ownerSalt,
    adminSalt,
    kitchenSalt,
    ownerPasswordHash: await hashSecret(ownerPassword, ownerSalt),
    adminPasswordHash: await hashSecret(adminPassword, adminSalt),
    kitchenPasswordHash: await hashSecret(kitchenPassword, kitchenSalt),
    createdAt: now,
    updatedAt: now,
  };

  writeWorkspaceRecords([nextRecord, ...records]);
  writeWorkspaceSession({
    workspaceId: nextRecord.id,
    ownerEmail: nextRecord.ownerEmail,
    signedInAt: now,
  });
  setActiveWorkspaceId(nextRecord.id);

  return { workspace: getCurrentWorkspaceProfile() };
}

export async function loginWorkspace(ownerEmail: string, ownerPassword: string) {
  const email = normalizeEmail(ownerEmail);
  const password = String(ownerPassword || '').trim();
  const record = readWorkspaceRecords().find((item) => normalizeEmail(item.ownerEmail) === email);
  if (!record) throw new Error('Workspace account not found');
  const hashed = await hashSecret(password, record.ownerSalt);
  if (hashed !== record.ownerPasswordHash) throw new Error('Invalid email or password');

  writeWorkspaceSession({
    workspaceId: record.id,
    ownerEmail: record.ownerEmail,
    signedInAt: new Date().toISOString(),
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

  record.updatedAt = new Date().toISOString();
  writeWorkspaceRecords([...records]);
  return { success: true, username: record.kitchenUsername };
}
