import { useCallback, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'spectra-theme';

function initTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

let theme: Theme = initTheme();
const listeners = new Set<() => void>();

function apply(t: Theme) {
  theme = t;
  document.documentElement.classList.toggle('dark', t === 'dark');
  document.documentElement.style.colorScheme = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

// Apply on module load (before first paint of components).
document.documentElement.classList.toggle('dark', theme === 'dark');
document.documentElement.style.colorScheme = theme;

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useTheme() {
  const current = useSyncExternalStore(subscribe, () => theme);
  const setTheme = useCallback((t: Theme) => apply(t), []);
  const toggle = useCallback(
    (x?: number, y?: number) => {
      const next = current === 'dark' ? 'light' : 'dark';
      const doc = document as Document & {
        startViewTransition?: (cb: () => void) => void;
      };
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (doc.startViewTransition && x !== undefined && y !== undefined && !reduced) {
        document.documentElement.style.setProperty('--theme-x', `${(x / window.innerWidth) * 100}%`);
        document.documentElement.style.setProperty('--theme-y', `${(y / window.innerHeight) * 100}%`);
        doc.startViewTransition(() => apply(next));
      } else {
        apply(next);
      }
    },
    [current],
  );
  return { theme: current, setTheme, toggle };
}
