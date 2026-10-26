// Shared sign-in state: one /api/auth/me request, shared by every component.
import { useEffect, useState } from 'react';
import * as api from './api.js';

let state = { loading: true, configured: false, user: null };
const listeners = new Set();
const set = (next) => {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn(state));
};

let started = false;
export function refreshAuth() {
  started = true;
  return api
    .me()
    .then((r) => set({ loading: false, configured: r.configured, user: r.user }))
    .catch(() => set({ loading: false, configured: false, user: null }));
}

export async function signOut() {
  await api.logout().catch(() => {});
  set({ user: null });
}

export function useAuth() {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    if (!started) refreshAuth();
    return () => listeners.delete(setS);
  }, []);
  return s;
}
