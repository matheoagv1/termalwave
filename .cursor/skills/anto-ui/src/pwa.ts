// anto design system: pwa helpers
//
// three things every anto pwa needs: a manifest, a service worker and an
// install prompt, this file covers all three in the least code that still
// leaves every knob exposed. no build-step dependency, so it works with any
// bundler or a plain <script type="module">

import * as React from 'react';

// --- manifest --------------------------------------------------------------

export interface ManifestOptions {
  name: string;
  shortName?: string;
  description?: string;
  /** hex, matches --bg for the active theme, defaults to the dark background */
  backgroundColor?: string;
  /** hex, matches --accent, defaults to the accent blue */
  themeColor?: string;
  startUrl?: string;
  display?: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  icons?: Array<{ src: string; sizes: string; type?: string; purpose?: string }>;
}

/** build a manifest.json object, serve it yourself or use injectManifest() */
export function buildManifest(opts: ManifestOptions): Record<string, unknown> {
  return {
    name: opts.name,
    short_name: opts.shortName ?? opts.name,
    description: opts.description ?? '',
    start_url: opts.startUrl ?? '.',
    display: opts.display ?? 'standalone',
    background_color: opts.backgroundColor ?? '#111114',
    theme_color: opts.themeColor ?? '#4466ff',
    icons: opts.icons ?? [],
  };
}

/**
 * inject a manifest at runtime as a blob url on the link rel="manifest" tag,
 * convenient for prototypes and single page apps that skip a static
 * manifest.json build step. for production write manifest.json to disk
 * instead, a real file is cacheable and crawlable while a blob url is
 * neither
 */
export function injectManifest(opts: ManifestOptions): void {
  if (typeof document === 'undefined') return;
  const json = JSON.stringify(buildManifest(opts));
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'manifest';
    document.head.appendChild(link);
  }
  link.href = url;
}

// --- service worker ----------------------------------------------------

export interface SWRegisterOptions {
  url?: string;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
}

/**
 * register a service worker, call once in the app entry point, pairs with
 * the cache-first worker in `sw-template.js`, copy that file to the public
 * root as `sw.js` and point `url` at it, or bring your own
 */
export function registerServiceWorker(opts: SWRegisterOptions = {}): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  const url = opts.url ?? '/sw.js';

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(url).then(reg => {
      opts.onSuccess?.(reg);
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            opts.onUpdate?.(reg);
          }
        });
      });
    }).catch(() => {
      // registration failure should not break the app, it is only an enhancement
    });
  });
}

// --- install prompt ------------------------------------------------------

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PWAInstallState {
  /** true once the browser has signaled the app is installable */
  installable: boolean;
  /** true once the app is already running standalone, or installed */
  installed: boolean;
  /** trigger the native install prompt, no-op when not installable */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

/**
 * drive an install button, handles the beforeinstallprompt event and
 * standalone detection so callers only render a Btn conditioned on
 * installable or installed
 */
export function usePWAInstall(): PWAInstallState {
  const deferred = React.useRef<BeforeInstallPromptEvent | null>(null);
  const [installable, setInstallable] = React.useState(false);
  const [installed, setInstalled] = React.useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(display-mode: standalone)').matches === true
  );

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred.current = e as BeforeInstallPromptEvent;
      setInstallable(true);
    };
    const onInstalled = () => { setInstalled(true); setInstallable(false); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = React.useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferred.current) return 'unavailable';
    await deferred.current.prompt();
    const { outcome } = await deferred.current.userChoice;
    deferred.current = null;
    setInstallable(false);
    return outcome;
  }, []);

  return { installable, installed, promptInstall };
}

// --- online/offline --------------------------------------------------------

/** track connectivity so the interface can show an offline badge or toast */
export function useOnline(): boolean {
  const [online, setOnline] = React.useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  React.useEffect(() => {
    const set = () => setOnline(navigator.onLine);
    window.addEventListener('online', set);
    window.addEventListener('offline', set);
    return () => {
      window.removeEventListener('online', set);
      window.removeEventListener('offline', set);
    };
  }, []);
  return online;
}
