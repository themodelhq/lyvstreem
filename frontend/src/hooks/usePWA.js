import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * usePWA — handles install prompt, SW registration, update detection,
 * online/offline status, and push notification subscription.
 */
export default function usePWA() {
  const [installPrompt, setInstallPrompt]   = useState(null);
  const [isInstalled, setIsInstalled]       = useState(false);
  const [isOnline, setIsOnline]             = useState(navigator.onLine);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [swRegistration, setSwRegistration] = useState(null);
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const waitingWorkerRef = useRef(null);

  // ── Detect install state ──────────────────────────────────────────────────
  useEffect(() => {
    // Standalone = already installed
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) {
      setIsInstalled(true);
    }

    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // ── Online / Offline ──────────────────────────────────────────────────────
  useEffect(() => {
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ── Register Service Worker ───────────────────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(registration => {
        setSwRegistration(registration);
        console.log('[PWA] SW registered:', registration.scope);

        // Check for update on load
        registration.update();

        // New worker waiting to activate
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] Update available');
              waitingWorkerRef.current = newWorker;
              setUpdateAvailable(true);
            }
          });
        });

        // Handle case where SW already waiting
        if (registration.waiting && navigator.serviceWorker.controller) {
          waitingWorkerRef.current = registration.waiting;
          setUpdateAvailable(true);
        }
      })
      .catch(err => console.error('[PWA] SW registration failed:', err));

    // Listen for controller change (after skipWaiting) → reload
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    });
  }, []);

  // ── Trigger update (call skipWaiting) ────────────────────────────────────
  const applyUpdate = useCallback(() => {
    if (waitingWorkerRef.current) {
      waitingWorkerRef.current.postMessage({ type: 'SKIP_WAITING' });
    }
  }, []);

  // ── Install app ───────────────────────────────────────────────────────────
  const triggerInstall = useCallback(async () => {
    if (!installPrompt) return false;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      setIsInstalled(true);
    }
    return outcome === 'accepted';
  }, [installPrompt]);

  // ── Request push notification permission ──────────────────────────────────
  const requestNotifications = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'unsupported';
    const permission = await Notification.requestPermission();
    setNotifPermission(permission);
    return permission;
  }, []);

  // ── Send local notification (for testing / in-app alerts) ────────────────
  const sendLocalNotification = useCallback((title, options = {}) => {
    if (notifPermission !== 'granted') return;
    if (swRegistration) {
      swRegistration.showNotification(title, {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        vibrate: [200, 100, 200],
        ...options,
      });
    } else {
      new Notification(title, { icon: '/icons/icon-192x192.png', ...options });
    }
  }, [swRegistration, notifPermission]);

  return {
    installPrompt,
    isInstalled,
    isOnline,
    updateAvailable,
    swRegistration,
    notifPermission,
    triggerInstall,
    applyUpdate,
    requestNotifications,
    sendLocalNotification,
    canInstall: !!installPrompt && !isInstalled,
  };
}
