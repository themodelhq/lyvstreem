import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiDownload, FiX, FiWifi, FiWifiOff, FiRefreshCw, FiBell } from 'react-icons/fi';
import { BsCameraVideoFill } from 'react-icons/bs';
import usePWA from '../hooks/usePWA';
import toast from 'react-hot-toast';

// ── Offline toast (shown once) ────────────────────────────────────────────────
function OfflineBanner() {
  return (
    <motion.div
      initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
      className="fixed top-0 left-0 right-0 z-[999] flex items-center justify-center gap-2 bg-red-500 text-white text-sm font-semibold py-2.5 px-4 shadow-lg"
    >
      <FiWifiOff className="shrink-0" />
      You're offline — some features may not work
    </motion.div>
  );
}

// ── Update available banner ────────────────────────────────────────────────────
function UpdateBanner({ onApply, onDismiss }) {
  return (
    <motion.div
      initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
      className="fixed top-0 left-0 right-0 z-[999] flex items-center justify-between gap-3 bg-brand-600 text-white text-sm px-4 py-2.5 shadow-lg"
    >
      <div className="flex items-center gap-2">
        <FiRefreshCw className="shrink-0 animate-spin" />
        <span className="font-medium">LyvStreem update available!</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onApply} className="bg-white text-brand-600 font-bold text-xs px-3 py-1 rounded-full hover:bg-white/90 transition-colors">
          Update Now
        </button>
        <button onClick={onDismiss} className="text-white/60 hover:text-white p-1"><FiX /></button>
      </div>
    </motion.div>
  );
}

// ── Install bottom sheet (mobile) / side card (desktop) ───────────────────────
function InstallSheet({ onInstall, onDismiss }) {
  const isMobile = window.innerWidth < 768;

  const content = (
    <div className={`relative bg-dark-800 border border-white/10 shadow-2xl overflow-hidden ${isMobile ? 'rounded-t-3xl' : 'rounded-2xl max-w-sm'}`}>
      {/* Gradient top accent */}
      <div className="h-1 bg-gradient-to-r from-brand-500 via-purple-500 to-brand-700" />

      <div className="p-5">
        <button onClick={onDismiss} className="absolute top-4 right-4 p-1.5 text-white/40 hover:text-white transition-colors">
          <FiX />
        </button>

        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/30 shrink-0">
            <BsCameraVideoFill className="text-white text-2xl" />
          </div>
          <div>
            <h3 className="text-white font-display font-bold text-lg">Install LyvStreem</h3>
            <p className="text-white/50 text-xs">Add to your home screen</p>
          </div>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 mb-5">
          {['Works offline','Faster loading','Push notifications','Full-screen mode'].map(f => (
            <span key={f} className="text-xs bg-brand-500/15 text-brand-300 border border-brand-500/20 px-2.5 py-1 rounded-full">{f}</span>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={onDismiss} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5 transition-colors">
            Not now
          </button>
          <button onClick={onInstall}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:from-brand-400 hover:to-brand-600 transition-all shadow-md shadow-brand-500/30">
            <FiDownload /> Install App
          </button>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[998]"
      >
        {content}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }}
      className="fixed bottom-6 right-6 z-[998]"
    >
      {content}
    </motion.div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PWAProvider({ children }) {
  const {
    canInstall, isOnline, updateAvailable,
    triggerInstall, applyUpdate,
    requestNotifications, notifPermission,
  } = usePWA();

  const [showInstall, setShowInstall] = useState(false);
  const [showUpdate, setShowUpdate]   = useState(false);
  const [showOffline, setShowOffline] = useState(false);
  const [prevOnline, setPrevOnline]   = useState(true);

  // Delay install prompt so it doesn't interrupt first load
  useEffect(() => {
    if (!canInstall) return;
    const dismissed = sessionStorage.getItem('pwa-install-dismissed');
    if (dismissed) return;
    const timer = setTimeout(() => setShowInstall(true), 8000);
    return () => clearTimeout(timer);
  }, [canInstall]);

  // Update banner
  useEffect(() => {
    if (updateAvailable) setShowUpdate(true);
  }, [updateAvailable]);

  // Online/offline banner
  useEffect(() => {
    if (!isOnline && prevOnline) {
      setShowOffline(true);
      toast.error('You are offline', { id: 'offline', duration: Infinity });
    }
    if (isOnline && !prevOnline) {
      setShowOffline(false);
      toast.success('Back online!', { id: 'offline' });
    }
    setPrevOnline(isOnline);
  }, [isOnline]);

  const handleInstall = async () => {
    const accepted = await triggerInstall();
    setShowInstall(false);
    if (accepted) {
      toast.success('🎉 LyvStreem installed!');
      // Request notifications after install
      if (notifPermission === 'default') {
        setTimeout(() => requestNotifications(), 2000);
      }
    }
  };

  const handleDismissInstall = () => {
    setShowInstall(false);
    sessionStorage.setItem('pwa-install-dismissed', '1');
  };

  const handleApplyUpdate = () => {
    applyUpdate();
    setShowUpdate(false);
  };

  // Top margin when banner is showing
  const topOffset = showOffline || showUpdate ? 'mt-10' : '';

  return (
    <>
      <AnimatePresence>
        {showOffline && !isOnline && <OfflineBanner key="offline" />}
        {showUpdate   && <UpdateBanner key="update" onApply={handleApplyUpdate} onDismiss={() => setShowUpdate(false)} />}
        {showInstall  && <InstallSheet key="install" onInstall={handleInstall} onDismiss={handleDismissInstall} />}
      </AnimatePresence>
      <div className={topOffset}>
        {children}
      </div>
    </>
  );
}

// ── Standalone install button (for use in Settings page) ─────────────────────
export function PWAInstallButton() {
  const { canInstall, isInstalled, triggerInstall, requestNotifications, notifPermission } = usePWA();

  if (isInstalled) {
    return (
      <div className="flex items-center gap-2 text-green-400 text-sm">
        <span className="w-2 h-2 rounded-full bg-green-400" /> App installed
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {canInstall && (
        <button onClick={triggerInstall}
          className="flex items-center gap-2 btn-primary text-sm py-2.5">
          <FiDownload /> Install LyvStreem App
        </button>
      )}
      {notifPermission !== 'granted' && (
        <button onClick={requestNotifications}
          className="flex items-center gap-2 btn-ghost text-sm py-2.5">
          <FiBell /> Enable Notifications
        </button>
      )}
    </div>
  );
}
