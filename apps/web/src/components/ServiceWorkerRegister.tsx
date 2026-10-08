'use client';

import { useEffect } from 'react';
import { syncManager } from '../lib/offline/SyncManager';

export function ServiceWorkerRegister() {
  useEffect(() => {
    // 1. Register Service Worker in production/modern browsers
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[ServiceWorker] Registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[ServiceWorker] Registration failed (non-critical):', err);
        });
    }

    // 2. Initialize sync manager
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    const getToken = () => localStorage.getItem('pos_access_token');
    syncManager.init(apiUrl, getToken);
  }, []);

  return null;
}
