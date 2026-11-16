// Minimal example: a PWA-ready app shell using @xplshn/anto-ui.
// Run with any React + Vite/Next setup; copy src/sw-template.js to
// your public/ dir as sw.js first.

import React from 'react';
import {
  Sidebar, StatusBar, Btn, Badge, ToastProvider, useToast,
  injectManifest, registerServiceWorker, usePWAInstall, useOnline,
} from '@xplshn/anto-ui';
import '@xplshn/anto-ui/tokens.css';

injectManifest({ name: 'Anto Demo', themeColor: '#4466ff' });
registerServiceWorker({ url: '/sw.js' });

function Toolbar() {
  const toast = useToast();
  const { installable, promptInstall } = usePWAInstall();
  const online = useOnline();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
      height: 'var(--space-8)', background: 'var(--bg2)',
      borderBottom: 'var(--border-width) solid var(--border)', padding: '0 var(--space-3)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>anto demo</span>
      {!online && <Badge variant="warn">offline</Badge>}
      <div style={{ flex: 1 }} />
      {installable && <Btn size="sm" onClick={() => promptInstall()}>install</Btn>}
      <Btn size="sm" variant="primary" onClick={() => toast.push('saved', 'ok')}>save</Btn>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <Toolbar />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar
            items={[{ id: 'files', icon: 'folder', label: 'files' }]}
            active="files"
          />
          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)' }}>
            <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>
              content goes here
            </p>
          </div>
        </div>
        <StatusBar left={<span>ready</span>} />
      </div>
    </ToastProvider>
  );
}
