'use client';

import { useSyncExternalStore } from 'react';

// useSyncExternalStore is the correct primitive for subscribing to a
// browser API like matchMedia — no useState/useEffect pair needed, no
// setState-in-effect, and it's tear-safe under concurrent rendering.
function subscribe(query: string, onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(query);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot(query: string): boolean {
  return window.matchMedia(query).matches;
}

function getServerSnapshot(): boolean {
  return false; // safe default: resolves to 'manual' mode until hydrated
}

/**
 * SSR-safe media query hook. Returns `false` on the server and on the
 * initial client snapshot to avoid hydration mismatches, then tracks the
 * real value.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => subscribe(query, onChange),
    () => getSnapshot(query),
    getServerSnapshot
  );
}

/**
 * `true` for touch-primary devices (phones/tablets), `false` for
 * mouse/trackpad-primary devices (desktops/laptops). This is a UX default,
 * not a permission gate — capability, not device fingerprint.
 */
export function useIsTouchPrimary(): boolean {
  return useMediaQuery('(pointer: coarse)');
}