import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLiveStream } from '../context/LiveStreamContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiMaximize2, FiUsers } from 'react-icons/fi';

export default function MiniStreamPlayer() {
  const navigate  = useNavigate();
  const { socket } = useSocket();
  const {
    activeStream, isMinimized,
    localStream,
    camOn, setCamOn,
    micOn, setMicOn,
    restore, endLiveSession,
  } = useLiveStream();

  const videoRef  = useRef(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [ending, setEnding]           = useState(false);
  const [elapsed, setElapsed]         = useState('00:00');

  // Attach stream to mini video — use the ref directly
  useEffect(() => {
    if (!isMinimized) return;
    const attachVideo = () => {
      const stream = localStream?.current;
      if (videoRef.current && stream && stream.active) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    };
    // Slight delay to let the component render
    const t = setTimeout(attachVideo, 80);
    return () => clearTimeout(t);
  }, [isMinimized, localStream]);

  // Live clock
  useEffect(() => {
    if (!activeStream?.startedAt) return;
    const tick = () => {
      const d = Date.now() - new Date(activeStream.startedAt).getTime();
      const h = Math.floor(d / 3600000);
      const m = Math.floor((d % 3600000) / 60000);
      const s = Math.floor((d % 60000) / 1000);
      setElapsed(
        h > 0
          ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
          : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeStream?.startedAt]);

  // Viewer count from socket
  useEffect(() => {
    if (!socket || !activeStream) return;
    const handler = ({ count }) => setViewerCount(count);
    socket.on('viewer_count', handler);
    return () => socket.off('viewer_count', handler);
  }, [socket, activeStream]);

  const toggleCam = () => {
    const stream = localStream?.current;
    stream?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    const next = !camOn;
    setCamOn(next);
    socket?.emit('host_media_state', { streamId: activeStream._id, camOn: next, micOn });
  };

  const toggleMic = () => {
    const stream = localStream?.current;
    stream?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    const next = !micOn;
    setMicOn(next);
    socket?.emit('host_media_state', { streamId: activeStream._id, camOn, micOn: next });
  };

  const handleRestore = () => {
    restore();
    navigate(`/go-live?restore=${activeStream._id}`);
  };

  const handleEnd = async () => {
    if (!window.confirm('End your live stream?')) return;
    setEnding(true);
    try {
      await api.post(`/streams/${activeStream._id}/end`);
      socket?.emit('end_stream', { streamId: activeStream._id });
      // Stop all tracks
      localStream?.current?.getTracks().forEach(t => t.stop());
      endLiveSession();
      toast.success('Stream ended');
    } catch {
      toast.error('Failed to end stream');
    } finally {
      setEnding(false);
    }
  };

  if (!activeStream || !isMinimized) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: -20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -20 }}
      drag
      dragMomentum={false}
      className="fixed top-20 right-4 z-[500] w-48 rounded-2xl overflow-hidden shadow-2xl border border-white/20 select-none bg-dark-900"
      style={{ touchAction: 'none', cursor: 'grab' }}
    >
      {/* Video preview */}
      <div className="relative aspect-video bg-dark-900">
        {camOn ? (
          <video
            ref={videoRef}
            autoPlay muted playsInline
            className="w-full h-full object-cover scale-x-[-1]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-dark-800">
            <FiVideoOff className="text-white/30 text-2xl" />
          </div>
        )}

        {/* LIVE badge + clock */}
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 pointer-events-none">
          <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
            <span className="w-1 h-1 bg-white rounded-full animate-pulse" /> LIVE
          </span>
          <span className="bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-md font-mono">{elapsed}</span>
        </div>

        {/* Viewer count */}
        <div className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 pointer-events-none">
          <FiUsers className="text-[8px]" />{viewerCount}
        </div>

        {/* Tap to restore */}
        <button
          onClick={handleRestore}
          className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/40 transition-opacity"
          style={{ cursor: 'pointer' }}
        >
          <FiMaximize2 className="text-white text-xl" />
        </button>
      </div>

      {/* Controls */}
      <div className="bg-dark-900/95 px-2 py-2 flex items-center justify-between gap-1">
        <button onClick={toggleMic}
          className={`p-1.5 rounded-lg transition-all ${micOn ? 'text-white/70 hover:text-white' : 'bg-red-500/20 text-red-400'}`}>
          {micOn ? <FiMic className="text-sm" /> : <FiMicOff className="text-sm" />}
        </button>
        <button onClick={toggleCam}
          className={`p-1.5 rounded-lg transition-all ${camOn ? 'text-white/70 hover:text-white' : 'bg-red-500/20 text-red-400'}`}>
          {camOn ? <FiVideo className="text-sm" /> : <FiVideoOff className="text-sm" />}
        </button>
        <button onClick={handleRestore}
          className="p-1.5 text-white/60 hover:text-white transition-all">
          <FiMaximize2 className="text-sm" />
        </button>
        <button onClick={handleEnd} disabled={ending}
          className="px-2 py-1 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all text-[10px] font-bold">
          {ending ? '...' : 'End'}
        </button>
      </div>

      {/* Title */}
      <div className="bg-dark-900 px-2 pb-2">
        <p className="text-white/50 text-[9px] truncate">{activeStream.title}</p>
      </div>
    </motion.div>
  );
}
