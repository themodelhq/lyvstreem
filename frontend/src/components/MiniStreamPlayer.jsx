import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLiveStream } from '../context/LiveStreamContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiMaximize2, FiUsers } from 'react-icons/fi';

export default function MiniStreamPlayer() {
  const navigate   = useNavigate();
  const { socket } = useSocket();
  const ctx        = useLiveStream();

  const videoRef               = useRef(null);
  const [viewerCount, setVC]   = useState(0);
  const [ending, setEnding]    = useState(false);
  const [elapsed, setElapsed]  = useState('00:00');

  const activeStream = ctx?.activeStream;
  const isMinimized  = ctx?.isMinimized;
  const camOn        = ctx?.camOn;
  const micOn        = ctx?.micOn;

  // Attach stream to video. Re-runs on camOn so that when the camera
  // toggles back on (which re-creates the <video> element) we re-bind the
  // MediaStream as srcObject.
  useEffect(() => {
    if (!isMinimized || !camOn) return;
    let cancelled = false;
    const attach = () => {
      if (cancelled) return;
      const stream = ctx?.localStream?.current;
      const v = videoRef.current;
      if (!v || !stream || !stream.active) return;
      if (v.srcObject !== stream) v.srcObject = stream;
      v.play().catch(() => {});
    };
    // Two rAFs ensures the new <video> element is in the DOM before we attach
    const r1 = requestAnimationFrame(() => requestAnimationFrame(attach));
    return () => { cancelled = true; cancelAnimationFrame(r1); };
  }, [isMinimized, camOn, activeStream?._id]);

  // Clock
  useEffect(() => {
    if (!activeStream?.startedAt) return;
    const tick = () => {
      const d = Date.now() - new Date(activeStream.startedAt).getTime();
      const h = Math.floor(d / 3600000);
      const m = Math.floor((d % 3600000) / 60000);
      const s = Math.floor((d % 60000) / 1000);
      setElapsed(h > 0
        ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
        : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeStream?.startedAt]);

  // Viewer count
  useEffect(() => {
    if (!socket || !activeStream) return;
    const h = ({ count }) => setVC(count);
    socket.on('viewer_count', h);
    return () => socket.off('viewer_count', h);
  }, [socket, activeStream]);

  const toggleCam = () => {
    const stream = ctx?.localStream?.current;
    stream?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    ctx?.setCamOn(v => !v);
    socket?.emit('host_media_state', { streamId: activeStream._id, camOn: !camOn, micOn });
  };

  const toggleMic = () => {
    const stream = ctx?.localStream?.current;
    stream?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    ctx?.setMicOn(v => !v);
    socket?.emit('host_media_state', { streamId: activeStream._id, camOn, micOn: !micOn });
  };

  const handleRestore = () => {
    ctx?.restore();
    navigate(`/go-live?restore=${activeStream._id}`);
  };

  const handleEnd = async () => {
    if (!window.confirm('End your live stream?')) return;
    setEnding(true);
    try {
      await api.post(`/streams/${activeStream._id}/end`);
      socket?.emit('end_stream', { streamId: activeStream._id });
      try { ctx?.localStream?.current?.getTracks().forEach(t => t.stop()); } catch (_) {}
      ctx?.endLiveSession();
      toast.success('Stream ended');
    } catch (err) {
      // 404 = already cleaned up server-side. Treat as a successful end.
      if (err.response?.status !== 404) {
        console.error('Mini end stream error:', err);
      }
      try { ctx?.localStream?.current?.getTracks().forEach(t => t.stop()); } catch (_) {}
      ctx?.endLiveSession();
      toast.success('Stream ended');
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
      className="fixed top-20 right-4 z-[500] w-48 rounded-2xl overflow-hidden shadow-2xl border border-white/20 select-none bg-dark-900"
      style={{ touchAction: 'none' }}
    >
      <div
        className="relative aspect-video bg-dark-900 cursor-pointer"
        onClick={handleRestore}
        role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleRestore(); }}
        title="Tap to return to your stream">
        {camOn
          ? <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1] pointer-events-none" />
          : <div className="w-full h-full flex items-center justify-center bg-dark-800 pointer-events-none">
              <FiVideoOff className="text-white/30 text-2xl" />
            </div>}
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 pointer-events-none">
          <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
            <span className="w-1 h-1 bg-white rounded-full animate-pulse" /> LIVE
          </span>
          <span className="bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-md font-mono">{elapsed}</span>
        </div>
        <div className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 pointer-events-none">
          <FiUsers className="text-[8px]" />{viewerCount}
        </div>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/40 transition-opacity pointer-events-none">
          <FiMaximize2 className="text-white text-xl" />
        </div>
      </div>

      <div className="bg-dark-900/95 px-2 py-2 flex items-center justify-between gap-1">
        <button onClick={toggleMic}
          className={`p-1.5 rounded-lg ${micOn ? 'text-white/70' : 'bg-red-500/20 text-red-400'}`}>
          {micOn ? <FiMic className="text-sm" /> : <FiMicOff className="text-sm" />}
        </button>
        <button onClick={toggleCam}
          className={`p-1.5 rounded-lg ${camOn ? 'text-white/70' : 'bg-red-500/20 text-red-400'}`}>
          {camOn ? <FiVideo className="text-sm" /> : <FiVideoOff className="text-sm" />}
        </button>
        <button onClick={handleRestore} className="p-1.5 text-white/60 hover:text-white">
          <FiMaximize2 className="text-sm" />
        </button>
        <button onClick={handleEnd} disabled={ending}
          className="px-2 py-1 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-lg text-[10px] font-bold transition-all">
          {ending ? '...' : 'End'}
        </button>
      </div>
      <div className="bg-dark-900 px-2 pb-2">
        <p className="text-white/50 text-[9px] truncate">{activeStream.title}</p>
      </div>
    </motion.div>
  );
}
