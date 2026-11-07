import { reactive } from 'vue';
import { AuthUser, Region, RegionTreeItem, UserRegionRole } from '@shared/types';

export const authState = reactive<{
  user: AuthUser | null;
  token: string | null;
  roles: UserRegionRole[];
  managedRegionIds: number[];
  teamAdminRegionIds: number[];
  canManageTeam: boolean;
}>({
  user: JSON.parse(localStorage.getItem('abgabe_user') || 'null'),
  token: localStorage.getItem('abgabe_token') || null,
  roles: [],
  managedRegionIds: [],
  teamAdminRegionIds: [],
  canManageTeam: Boolean(JSON.parse(localStorage.getItem('abgabe_user') || 'null')?.isSuperAdmin)
});

export function setAuthUser(user: AuthUser | null, token: string | null) {
  authState.user = user;
  authState.token = token;
  if (!user || !token) {
    authState.roles = [];
    authState.managedRegionIds = [];
    authState.teamAdminRegionIds = [];
    authState.canManageTeam = false;
    localStorage.removeItem('abgabe_user');
    localStorage.removeItem('abgabe_token');
  } else {
    authState.canManageTeam = Boolean(user.isSuperAdmin) || authState.canManageTeam;
    localStorage.setItem('abgabe_user', JSON.stringify(user));
    localStorage.setItem('abgabe_token', token);
  }
}

export async function refreshAuthProfile(): Promise<boolean> {
  if (!authState.token) {
    return false;
  }
  try {
    const data = await fetchApi<{
      user: AuthUser;
      roles: UserRegionRole[];
      managedRegionIds: number[];
      teamAdminRegionIds: number[];
      canManageTeam: boolean;
    }>('/api/auth/me');

    authState.user = data.user;
    authState.roles = data.roles || [];
    authState.managedRegionIds = data.managedRegionIds || [];
    authState.teamAdminRegionIds = data.teamAdminRegionIds || [];
    authState.canManageTeam = Boolean(data.canManageTeam || data.user?.isSuperAdmin);
    localStorage.setItem('abgabe_user', JSON.stringify(data.user));
    return true;
  } catch {
    return false;
  }
}

export const appState = reactive<{
  currentRegion: Region | null;
  regions: Region[];
  regionsTree: RegionTreeItem[];
  filterWithoutRegistration: boolean;
  pendingSuggestionsCount: number;
}>({
  currentRegion: null,
  regions: [],
  regionsTree: [],
  filterWithoutRegistration: false,
  pendingSuggestionsCount: 0
});

/* ==========================================================================
   Theme State (Light / Dark Mode — persisted in localStorage)
   ========================================================================== */
function detectInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem('fs_theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const themeState = reactive<{
  mode: 'light' | 'dark';
}>({
  mode: detectInitialTheme()
});

export function applyTheme(mode: 'light' | 'dark') {
  themeState.mode = mode;
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }
  try {
    localStorage.setItem('fs_theme', mode);
  } catch {
    // ignore storage errors
  }
}

export function toggleTheme() {
  applyTheme(themeState.mode === 'dark' ? 'light' : 'dark');
}

// Ensure DOM matches initial reactive state
if (typeof window !== 'undefined') {
  applyTheme(themeState.mode);
}

/* ==========================================================================
   Toast Notifications (Sibling replacement for native alert / pulseSuccess)
   ========================================================================== */
export interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

let nextToastId = 1;

export const toastState = reactive<{
  items: ToastItem[];
}>({
  items: []
});

export function dismissToast(id: number) {
  const idx = toastState.items.findIndex(t => t.id === id);
  if (idx !== -1) {
    toastState.items.splice(idx, 1);
  }
}

export function pushToast(type: ToastItem['type'], message: string, durationMs = 4800) {
  const id = nextToastId++;
  toastState.items.push({ id, type, message });
  if (durationMs > 0 && typeof window !== 'undefined') {
    window.setTimeout(() => dismissToast(id), durationMs);
  }
}

export const notifySuccess = (message: string) => pushToast('success', message);
export const notifyError = (message: string) => pushToast('error', message, 6500);
export const notifyInfo = (message: string) => pushToast('info', message);

export async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  const hadSessionToken = Boolean(authState.token);
  if (authState.token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authState.token}`);
  }
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const msg = errorBody.error || errorBody.message || `HTTP ${res.status}`;
    if (res.status === 401 && hadSessionToken) {
      setAuthUser(null, null);
      notifyError(msg || 'Deine Sitzung ist abgelaufen oder wurde widerrufen. Bitte neu anmelden.');
    }
    throw new Error(msg);
  }
  return res.json();
}
