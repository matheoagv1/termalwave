// anto design system: react hooks
//
// state and subscription helpers with no DOM of their own. media queries
// live here next to the async and store bridges because every consumer
// rewrites the same five once an app grows past a demo.

import * as React from 'react';

// a readable store: anything with a current value and a subscribe.
// matches the app-side createStore shape without importing it, so the
// kit stays store-agnostic and any observable plugs in.
export interface ReadableStore<T> {
  get(): T;
  subscribe(fn: () => void): () => void;
}

// subscribes a component to a store through useSyncExternalStore.
// the single bridge between cross-module state and react.
export function useStore<T>(store: ReadableStore<T>): T {
  return React.useSyncExternalStore(store.subscribe, store.get, store.get);
}

// runs the latest fn on an interval. null pauses. the ref indirection
// keeps the timer stable across renders that only change the callback.
export function useInterval(fn: () => void, ms: number | null): void {
  const ref = React.useRef(fn);
  ref.current = fn;
  React.useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

// a clock that re-renders on an interval. only for what ages on its own:
// relative timestamps, poll staleness, countdowns.
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = React.useState(() => Date.now());
  useInterval(() => setNow(Date.now()), intervalMs);
  return now;
}

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
  reload: () => void;
}

// loads once per deps change and again on every reload. a rejected load
// keeps the previous data and raises error, so the caller can show the
// last good value plus a warning instead of blanking out.
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);
  const loadRef = React.useRef(load);
  loadRef.current = load;

  React.useEffect(() => {
    let live = true;
    setLoading(true);
    loadRef.current()
      .then(res => { if (live) { setData(res); setError(false); } })
      .catch(() => { if (live) setError(true); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = React.useCallback(() => setNonce(n => n + 1), []);
  return { data, loading, error, reload };
}

// closes a floating panel when the pointer lands outside of it.
export function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void): void {
  const cb = React.useRef(onOutside);
  cb.current = onOutside;
  React.useEffect(() => {
    const handler = (e: PointerEvent): void => {
      const target = e.target;
      if (!target || !(target instanceof Node)) return;
      if (!ref.current?.contains(target)) cb.current();
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [ref]);
}

// tracks a media query reactively. seeded from the browser so the first
// render is already correct, false during server rendering or wherever
// matchMedia is missing entirely.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(() => queryMatches(query));

  React.useEffect(() => {
    const mql = getQueryList(query);
    if (!mql) return;
    const onChange = (): void => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

function queryMatches(query: string): boolean {
  return getQueryList(query)?.matches ?? false;
}

function getQueryList(query: string): MediaQueryList | null {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia(query);
  }
  const g = globalThis as { matchMedia?: (q: string) => MediaQueryList };
  if (typeof g.matchMedia === 'function') return g.matchMedia(query);
  return null;
}

// the reduced-motion query tokens.css already keys off of, so JS and CSS
// agree on one source. skip a JS-driven animation entirely on top of the
// automatic CSS opt-out.
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
