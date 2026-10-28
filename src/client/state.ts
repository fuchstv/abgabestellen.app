import { reactive, ref } from 'vue';
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
