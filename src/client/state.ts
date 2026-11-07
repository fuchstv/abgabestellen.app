import { reactive } from 'vue';
import { AuthUser, Region, RegionTreeItem } from '@shared/types';

export const authState = reactive<{
  user: AuthUser | null;
  token: string | null;
}>({
  user: JSON.parse(localStorage.getItem('abgabe_user') || 'null'),
  token: localStorage.getItem('abgabe_token') || null
});

export function setAuthUser(user: AuthUser | null, token: string | null) {
  authState.user = user;
  authState.token = token;
  if (user && token) {
    localStorage.setItem('abgabe_user', JSON.stringify(user));
    localStorage.setItem('abgabe_token', token);
  } else {
    localStorage.removeItem('abgabe_user');
    localStorage.removeItem('abgabe_token');
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
  if (authState.token) {
    headers.set('Authorization', `Bearer ${authState.token}`);
  }
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || errorBody.message || `HTTP ${res.status}`);
  }
  return res.json();
}
