import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

const LiveStreamContext = createContext(null);

export const LiveStreamProvider = ({ children }) => {
  const [activeStream, setActiveStream] = useState(null);
  const [camOn, setCamOn]               = useState(true);
  const [micOn, setMicOn]               = useState(true);
  const [isMinimized, setIsMinimized]   = useState(false);

  // Keep MediaStream in a ref — never in state (avoids re-renders + stale closure issues)
  const localStreamRef = useRef(null);

  // ── Start a live session ───────────────────────────────────────────────────
  const startLiveSession = useCallback((stream, mediaStream) => {
    setActiveStream({ ...stream, startedAt: stream.startedAt || new Date() });
    if (mediaStream) localStreamRef.current = mediaStream;
    setCamOn(true);
    setMicOn(true);
    setIsMinimized(false);
  }, []);

  // Alias used in some older call sites
  const startLive = startLiveSession;

  // ── End a live session ─────────────────────────────────────────────────────
  const endLiveSession = useCallback(() => {
    try {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    } catch (_) {}
    localStreamRef.current = null;
    setActiveStream(null);
    setIsMinimized(false);
  }, []);

  // Alias
  const endLive = endLiveSession;

  // ── Minimize / restore ─────────────────────────────────────────────────────
  const minimize = useCallback(() => setIsMinimized(true),  []);
  const restore  = useCallback(() => setIsMinimized(false), []);

  // ── Media toggles ──────────────────────────────────────────────────────────
  const toggleCam = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCamOn(v => !v);
  }, []);

  const toggleMic = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMicOn(v => !v);
  }, []);

  return (
    <LiveStreamContext.Provider value={{
      // State
      activeStream,
      isMinimized,
      camOn, setCamOn,
      micOn, setMicOn,
      // Ref — expose as object with .current so existing code works
      localStream: localStreamRef,
      // Methods — all named variants for backward compat
      startLiveSession,
      startLive,
      endLiveSession,
      endLive,
      minimize,
      restore,
      toggleCam,
      toggleMic,
    }}>
      {children}
    </LiveStreamContext.Provider>
  );
};

export const useLiveStream = () => useContext(LiveStreamContext);
