const storageKey = 'qos-theme';
const listeners = new Set();
const system = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function savedTheme() {
  try {
    const saved = globalThis.localStorage?.getItem(storageKey);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* A blocked storage must not prevent theme switching. */ }
  return null;
}
let theme = savedTheme() || (system?.matches ? 'dark' : 'light');
function applyTheme() {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b1420' : '#f5f7fa');
}
function syncTheme(next) {
  if (next === theme) return;
  theme = next;
  applyTheme();
  for (const listener of listeners) listener();
}
applyTheme();
export const getTheme = () => theme;
export function setTheme(next) {
  if (!['light', 'dark'].includes(next)) return;
  try { localStorage.setItem(storageKey, next); } catch { /* Keep the session choice usable. */ }
  syncTheme(next);
}
export function subscribeTheme(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) syncTheme(savedTheme() || (system.matches ? 'dark' : 'light'));
  });
  system.addEventListener('change', () => {
    if (!savedTheme()) syncTheme(system.matches ? 'dark' : 'light');
  });
}
