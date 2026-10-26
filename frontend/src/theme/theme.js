import { useEffect, useState } from 'react';

const KEY = 'dd-theme';
const listeners = new Set();

export function getTheme() {
  const t = document.documentElement.getAttribute('data-theme');
  return t === 'light' ? 'light' : 'dark';
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Storage can be blocked; the theme still applies for this session.
  }
  listeners.forEach((fn) => fn(theme));
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

export function useTheme() {
  const [theme, set] = useState(getTheme);
  useEffect(() => {
    listeners.add(set);
    return () => listeners.delete(set);
  }, []);
  return theme;
}

export function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

// Shift+T toggles the theme anywhere, except while typing in a field.
export function useThemeShortcut() {
  useEffect(() => {
    const onKey = (e) => {
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 't') {
        if (isTypingTarget(document.activeElement)) return;
        e.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
