import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

const LiveStreamContext = createContext(null);

export const LiveStreamProvider = ({ children }) => {
  const [activeStream, setActiveStream]   = useState(null);   // { _id, title, category, startedAt }
  const [localStream, setLocalStream]     = useState(null);   // MediaStream
  const [camOn, setCamOn]                 = useState(true);
  const [micOn, setMicOn]                 = useState(true);
  const [isMinimized, setIsMinimized]     = useState(false);
  const [viewerCount, setViewerCount]     = useState(0);
  const [recentGifts, setRecentGifts]     = useState([]);
  const [roomMode, setRoomMode]           = useState('solo');
  const videoRef                          = useRef(null);     // shared video element ref

  const startLive = useCallback((stream, mediaStream) => {
    setActiveStream({ ...stream, startedAt: stream.startedAt || new Date() });
    setLocalStream(mediaStream);
    setCamOn(true);
    setMicOn(true);
    setIsMinimized(false);
    setRecentGifts([]);
    setRoomMode('solo');
    setViewerCount(0);
  }, []);

  const endLive = useCallback(() => {
    localStream?.getTracks().forEach(t => t.stop());
    setActiveStream(null);
    setLocalStream(null);
    setIsMinimized(false);
    setViewerCount(0);
    setRecentGifts([]);
    setRoomMode('solo');
  }, [localStream]);

  const minimize = useCallback(() => setIsMinimized(true),  []);
  const maximize = useCallback(() => setIsMinimized(false), []);

  const toggleCam = useCallback(() => {
    if (!localStream) return;
    localStream.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCamOn(v => !v);
  }, [localStream]);

  const toggleMic = useCallback(() => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMicOn(v => !v);
  }, [localStream]);

  const addGift = useCallback((gift) => {
    setRecentGifts(prev => [gift, ...prev.slice(0, 9)]);
  }, []);

  return (
    <LiveStreamContext.Provider value={{
      activeStream, localStream, setLocalStream,
      camOn, micOn, isMinimized,
      viewerCount, setViewerCount,
      recentGifts, roomMode, setRoomMode,
      videoRef,
      startLive, endLive, minimize, maximize,
      toggleCam, toggleMic, addGift,
      setCamOn, setMicOn,
    }}>
      {children}
    </LiveStreamContext.Provider>
  );
};

export const useLiveStream = () => useContext(LiveStreamContext);
