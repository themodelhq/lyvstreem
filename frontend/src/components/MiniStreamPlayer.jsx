import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveStream } from '../context/LiveStreamContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiMaximize2, FiX, FiUsers } from 'react-icons/fi';

export default function MiniStreamPlayer() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const {
    activeStream, isMinimized,
    localStream, camOn, setCamOn, micOn, setMicOn,
    restore, endLiveSession,
  } = useLiveStream();

  const videoRef = useRef(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [ending, setEnding] = useState(false);
  const [elapsed, setElapsed] = useState('00:00');

  // Attach local stream to mini video
  useEffect(() => {
    if (videoRef.current && localStream?.current) {
      videoRef.current.srcObject = localStream.current;
    }
  }, [isMinimized, localStream?.current]);

  // Live clock
  useEffect(() => {
    if (!activeStream?.startedAt) return;
    const tick = () => {
      const d = Date.now() - new Date(activeStream.startedAt).getTime();
      const h = Math.floor(d / 3600000);
      const m = Math.floor((d % 3600000) / 60000);
      const s = Math.floor((d % 60000) / 1000);
      setElapsed(h > 0
        ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
        : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeStream?.startedAt]);

  // Viewer count
  useEffect(() => {
    if (!socket || !activeStream) return;
    socket.on('viewer_count', ({ count }) => setViewerCount(count));
    return () => socket.off('viewer_count');
  }, [socket, activeStream]);

  const toggleCam = () => {
    localStream?.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCamOn(v => !v);
    socket?.emit('host_media_state', { streamId: activeStream._id, camOn: !camOn, micOn });
  };

  const toggleMic = () => {
    localStream?.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMicOn(v => !v);
    socket?.emit('host_media_state', { streamId: activeStream._id, camOn, micOn: !micOn });
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
      drag dragMomentum={false}
      className="fixed top-20 right-4 z-[500] w-48 rounded-2xl overflow-hidden shadow-2xl border border-white/20 cursor-move select-none"
      style={{ touchAction: 'none' }}
    >
      {/* Video preview */}
      <div className="relative aspect-video bg-dark-900">
        {camOn
          ? <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
          : <div className="w-full h-full flex items-center justify-center bg-dark-800">
              <FiVideoOff className="text-white/30 text-2xl" />
            </div>
        }

        {/* LIVE badge + clock */}
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
          <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
            <span className="w-1 h-1 bg-white rounded-full animate-pulse" /> LIVE
          </span>
          <span className="bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-md font-mono">{elapsed}</span>
        </div>

        {/* Viewer count */}
        <div className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-md flex items-center gap-1">
          <FiUsers className="text-[8px]" />{viewerCount}
        </div>

        {/* Restore button overlay */}
        <button
          onClick={handleRestore}
          className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/40 transition-opacity"
        >
          <FiMaximize2 className="text-white text-xl" />
        </button>
      </div>

      {/* Control bar */}
      <div className="bg-dark-900/95 backdrop-blur px-2 py-2 flex items-center justify-between gap-1">
        <button onClick={toggleMic}
          className={`p-1.5 rounded-lg transition-all ${micOn ? 'text-white/70 hover:text-white' : 'bg-red-500/20 text-red-400'}`}>
          {micOn ? <FiMic className="text-sm" /> : <FiMicOff className="text-sm" />}
        </button>
        <button onClick={toggleCam}
          className={`p-1.5 rounded-lg transition-all ${camOn ? 'text-white/70 hover:text-white' : 'bg-red-500/20 text-red-400'}`}>
          {camOn ? <FiVideo className="text-sm" /> : <FiVideoOff className="text-sm" />}
        </button>
        <button onClick={handleRestore}
          className="p-1.5 text-white/70 hover:text-white transition-all">
          <FiMaximize2 className="text-sm" />
        </button>
        <button onClick={handleEnd} disabled={ending}
          className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all text-xs font-bold px-2">
          {ending ? '...' : 'End'}
        </button>
      </div>

      {/* Stream title */}
      <div className="bg-dark-900 px-2 pb-2">
        <p className="text-white/60 text-[9px] truncate">{activeStream.title}</p>
      </div>
    </motion.div>
  );
}
