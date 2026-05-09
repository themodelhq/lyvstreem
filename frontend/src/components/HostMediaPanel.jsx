import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';
import {
  FiMic, FiMicOff, FiVideo, FiVideoOff,
  FiSliders, FiX, FiVolume2, FiSun, FiRotateCcw,
  FiCamera, FiSettings
} from 'react-icons/fi';

const FILTERS = [
  { id: 'none',    label: 'None',    css: '' },
  { id: 'beauty',  label: 'Beauty',  css: 'brightness(1.1) contrast(0.9) saturate(1.2)' },
  { id: 'warm',    label: 'Warm',    css: 'sepia(0.3) saturate(1.4) brightness(1.05)' },
  { id: 'cool',    label: 'Cool',    css: 'saturate(0.8) hue-rotate(20deg) brightness(1.05)' },
  { id: 'vivid',   label: 'Vivid',   css: 'saturate(1.6) contrast(1.1)' },
  { id: 'noir',    label: 'Noir',    css: 'grayscale(0.8) contrast(1.2)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(0.5) contrast(0.9) brightness(0.9)' },
];

const RESOLUTIONS = ['480p', '720p', '1080p'];
const FRAMERATES  = [15, 24, 30, 60];

/**
 * HostMediaPanel — camera/audio settings panel for the host.
 * 
 * Props:
 *   localStreamRef   — React ref holding the active MediaStream (owned by GoLivePage)
 *   onStreamUpdated  — callback(newStream) when the stream is replaced (device switch)
 *   camOn / micOn    — current state
 *   onCamToggle / onMicToggle — toggle handlers
 *   streamId         — for socket broadcasts
 */
export default function HostMediaPanel({
  streamId,
  localStreamRef,
  onStreamUpdated,
  camOn, micOn,
  onCamToggle, onMicToggle,
}) {
  const { socket } = useSocket();
  const previewRef = useRef(null);

  const [showPanel, setShowPanel]         = useState(false);
  const [activeTab, setActiveTab]         = useState('camera');
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [brightness, setBrightness]       = useState(100);
  const [contrast, setContrast]           = useState(100);
  const [saturation, setSaturation]       = useState(100);
  const [mirrorMode, setMirrorMode]       = useState(true);
  const [resolution, setResolution]       = useState('720p');
  const [frameRate, setFrameRate]         = useState(30);
  const [availableCams, setAvailableCams] = useState([]);
  const [availableMics, setAvailableMics] = useState([]);
  const [selectedCamId, setSelectedCamId] = useState('');
  const [selectedMicId, setSelectedMicId] = useState('');

  // Enumerate devices when panel opens
  useEffect(() => {
    if (!showPanel) return;
    navigator.mediaDevices?.enumerateDevices().then(devices => {
      setAvailableCams(devices.filter(d => d.kind === 'videoinput'));
      setAvailableMics(devices.filter(d => d.kind === 'audioinput'));
    }).catch(() => {});
  }, [showPanel]);

  // Attach current stream to panel preview
  useEffect(() => {
    if (previewRef.current && localStreamRef?.current && showPanel) {
      previewRef.current.srcObject = localStreamRef.current;
      previewRef.current.play().catch(() => {});
    }
  }, [showPanel, localStreamRef?.current]);

  // Broadcast media state on toggle
  useEffect(() => {
    if (streamId) {
      socket?.emit('host_media_state', { streamId, camOn, micOn });
    }
  }, [camOn, micOn, streamId]);

  // Switch to a different camera device
  const switchCamera = async (deviceId) => {
    if (!deviceId) return;
    try {
      const resMap = { '480p': [640, 480], '720p': [1280, 720], '1080p': [1920, 1080] };
      const [w, h] = resMap[resolution] || [1280, 720];
      const constraints = {
        video: { deviceId: { exact: deviceId }, width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: frameRate } },
        audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true,
      };
      // Stop only video tracks — keep audio alive
      localStreamRef?.current?.getVideoTracks().forEach(t => t.stop());
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      // Replace video track in existing stream so audio is preserved
      const [newVideoTrack] = newStream.getVideoTracks();
      const existing = localStreamRef?.current;
      if (existing && newVideoTrack) {
        existing.getVideoTracks().forEach(t => existing.removeTrack(t));
        existing.addTrack(newVideoTrack);
        if (previewRef.current) {
          previewRef.current.srcObject = existing;
          previewRef.current.play().catch(() => {});
        }
        onStreamUpdated?.(existing);
      }
      setSelectedCamId(deviceId);
      toast.success('Camera switched!');
    } catch (err) {
      console.error('switchCamera:', err);
      toast.error('Could not switch camera');
    }
  };

  // Switch microphone
  const switchMic = async (deviceId) => {
    if (!deviceId) return;
    try {
      const constraints = { video: false, audio: { deviceId: { exact: deviceId } } };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const [newAudioTrack] = newStream.getAudioTracks();
      const existing = localStreamRef?.current;
      if (existing && newAudioTrack) {
        existing.getAudioTracks().forEach(t => { t.stop(); existing.removeTrack(t); });
        existing.addTrack(newAudioTrack);
        onStreamUpdated?.(existing);
      }
      setSelectedMicId(deviceId);
      toast.success('Microphone switched!');
    } catch {
      toast.error('Could not switch microphone');
    }
  };

  const resetFilters = () => {
    setSelectedFilter('none');
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
  };

  const videoStyle = {
    filter: [
      FILTERS.find(f => f.id === selectedFilter)?.css || '',
      brightness !== 100 ? `brightness(${brightness}%)` : '',
      contrast  !== 100 ? `contrast(${contrast}%)`   : '',
      saturation !== 100 ? `saturate(${saturation}%)` : '',
    ].filter(Boolean).join(' ') || undefined,
    transform: mirrorMode ? 'scaleX(-1)' : 'none',
  };

  return (
    <>
      {/* Inline control bar */}
      <div className="flex items-center gap-2 bg-dark-800/90 backdrop-blur-xl border border-white/10 rounded-2xl px-3 py-2 shadow-xl">
        {/* Cam toggle */}
        <button onClick={onCamToggle}
          className={`p-2.5 rounded-xl transition-all ${camOn ? 'bg-dark-700 text-white hover:bg-dark-600' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}
          title={camOn ? 'Turn off camera' : 'Turn on camera'}>
          {camOn ? <FiVideo className="text-lg" /> : <FiVideoOff className="text-lg" />}
        </button>

        {/* Mic toggle */}
        <button onClick={onMicToggle}
          className={`p-2.5 rounded-xl transition-all ${micOn ? 'bg-dark-700 text-white hover:bg-dark-600' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}
          title={micOn ? 'Mute mic' : 'Unmute mic'}>
          {micOn ? <FiMic className="text-lg" /> : <FiMicOff className="text-lg" />}
        </button>

        <div className="w-px h-6 bg-white/10 mx-0.5" />

        {/* Mirror toggle */}
        <button onClick={() => setMirrorMode(v => !v)}
          className={`p-2.5 rounded-xl transition-all text-sm ${mirrorMode ? 'bg-brand-500/20 text-brand-400' : 'bg-dark-700 text-white/50'}`}
          title="Mirror camera">
          <FiRotateCcw className="text-lg" />
        </button>

        {/* Settings panel toggle */}
        <button onClick={() => setShowPanel(v => !v)}
          className={`p-2.5 rounded-xl transition-all ${showPanel ? 'bg-brand-500 text-white' : 'bg-dark-700 text-white/60 hover:text-white'}`}
          title="Media settings">
          <FiSliders className="text-lg" />
        </button>

        {/* Status dots */}
        <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-white/10">
          <div className={`w-2 h-2 rounded-full ${camOn ? 'bg-green-400' : 'bg-red-500'}`} title="Camera" />
          <div className={`w-2 h-2 rounded-full ${micOn ? 'bg-green-400' : 'bg-red-500'}`} title="Mic" />
        </div>
      </div>

      {/* Extended settings panel */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full mb-3 left-0 right-0 glass-card overflow-hidden shadow-2xl z-50"
            style={{ maxHeight: '72vh', overflowY: 'auto' }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 sticky top-0 bg-dark-800 z-10">
              <h3 className="text-white font-semibold flex items-center gap-2 text-sm">
                <FiSettings className="text-brand-400" /> Media Controls
              </h3>
              <button onClick={() => setShowPanel(false)} className="p-1 text-white/50 hover:text-white">
                <FiX />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-3 bg-dark-700/50">
              {[
                { id: 'camera', label: 'Camera', icon: FiCamera },
                { id: 'audio',  label: 'Audio',  icon: FiMic },
                { id: 'quality',label: 'Quality', icon: FiSettings },
              ].map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === id ? 'bg-brand-500 text-white' : 'text-white/50 hover:text-white'}`}>
                  <Icon className="text-sm" /> {label}
                </button>
              ))}
            </div>

            {/* ── Camera tab ── */}
            {activeTab === 'camera' && (
              <div className="p-4 space-y-4">
                {/* Live preview */}
                <div className="relative rounded-xl overflow-hidden aspect-video bg-black">
                  <video ref={previewRef} autoPlay muted playsInline className="w-full h-full object-cover" style={videoStyle} />
                  {!camOn && (
                    <div className="absolute inset-0 bg-dark-900/90 flex items-center justify-center">
                      <FiVideoOff className="text-white/30 text-3xl" />
                    </div>
                  )}
                </div>

                {/* Filter presets */}
                <div>
                  <p className="text-white/50 text-xs uppercase tracking-widest mb-2">Filters</p>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {FILTERS.map(f => (
                      <button key={f.id} onClick={() => setSelectedFilter(f.id)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${selectedFilter === f.id ? 'bg-brand-500 text-white' : 'bg-dark-700 text-white/50 hover:text-white'}`}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sliders */}
                {[
                  { label: 'Brightness', icon: FiSun,     value: brightness, setter: setBrightness, min: 50, max: 150 },
                  { label: 'Contrast',   icon: FiSliders,  value: contrast,   setter: setContrast,   min: 50, max: 150 },
                  { label: 'Saturation', icon: FiVolume2,  value: saturation, setter: setSaturation, min: 0,  max: 200 },
                ].map(({ label, icon: Icon, value, setter, min, max }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs text-white/50 mb-1.5">
                      <span className="flex items-center gap-1"><Icon className="text-[11px]" /> {label}</span>
                      <span>{value}%</span>
                    </div>
                    <input type="range" min={min} max={max} value={value}
                      onChange={e => setter(+e.target.value)}
                      className="w-full accent-brand-500 h-1.5" />
                  </div>
                ))}

                <div className="flex gap-2">
                  <button onClick={resetFilters}
                    className="btn-ghost text-xs py-2 flex items-center gap-1.5">
                    <FiRotateCcw size={12} /> Reset
                  </button>
                  <button onClick={() => setMirrorMode(v => !v)}
                    className={`text-xs py-2 px-3 rounded-full border transition-all flex items-center gap-1.5 ${mirrorMode ? 'bg-brand-500/20 text-brand-400 border-brand-500/30' : 'border-white/10 text-white/50'}`}>
                    <FiRotateCcw size={12} /> Mirror {mirrorMode ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Camera device selector */}
                {availableCams.length > 1 && (
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-widest mb-2">Camera Device</p>
                    <select value={selectedCamId} onChange={e => switchCamera(e.target.value)}
                      className="w-full bg-dark-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500 appearance-none">
                      <option value="">— Select camera —</option>
                      {availableCams.map(d => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* ── Audio tab ── */}
            {activeTab === 'audio' && (
              <div className="p-4 space-y-4">
                <div className={`rounded-xl p-3 flex items-center gap-3 ${micOn ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                  {micOn ? <FiMic className="text-green-400" /> : <FiMicOff className="text-red-400" />}
                  <div>
                    <p className={`text-sm font-medium ${micOn ? 'text-green-400' : 'text-red-400'}`}>
                      Microphone {micOn ? 'Active' : 'Muted'}
                    </p>
                    <p className="text-white/40 text-xs">{micOn ? 'Viewers can hear you' : 'Click mic to unmute'}</p>
                  </div>
                </div>

                {availableMics.length > 1 && (
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-widest mb-2">Microphone Device</p>
                    <select value={selectedMicId} onChange={e => switchMic(e.target.value)}
                      className="w-full bg-dark-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500 appearance-none">
                      <option value="">— Default microphone —</option>
                      {availableMics.map(d => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Mic ${d.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* ── Quality tab ── */}
            {activeTab === 'quality' && (
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-white/50 text-xs uppercase tracking-widest mb-2">Resolution</p>
                  <div className="flex gap-2">
                    {RESOLUTIONS.map(r => (
                      <button key={r} onClick={() => setResolution(r)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${resolution === r ? 'bg-brand-500 text-white' : 'bg-dark-700 text-white/50'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-white/50 text-xs uppercase tracking-widest mb-2">Frame Rate</p>
                  <div className="flex gap-2">
                    {FRAMERATES.map(fps => (
                      <button key={fps} onClick={() => setFrameRate(fps)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${frameRate === fps ? 'bg-brand-500 text-white' : 'bg-dark-700 text-white/50'}`}>
                        {fps}fps
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-dark-700/50 rounded-xl p-4 space-y-2 text-sm">
                  <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Current Session</p>
                  {[
                    ['Resolution', resolution],
                    ['Frame Rate', `${frameRate}fps`],
                    ['Camera', camOn ? '🟢 On' : '🔴 Off'],
                    ['Microphone', micOn ? '🟢 On' : '🔴 Off'],
                    ['Mirror', mirrorMode ? 'On' : 'Off'],
                    ['Filter', selectedFilter],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-white/40 text-xs">{k}</span>
                      <span className="text-white text-xs">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
