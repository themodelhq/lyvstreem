import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';
import {
  FiVideo, FiVideoOff, FiMic, FiMicOff, FiSettings, FiMonitor,
  FiRotateCcw, FiZoomIn, FiZoomOut, FiSun, FiSliders, FiX,
  FiCamera, FiVolume2, FiVolumeX, FiMaximize2
} from 'react-icons/fi';
import { BsCameraVideoFill, BsCameraVideo } from 'react-icons/bs';

const FILTERS = [
  { id: 'none', label: 'None', css: '' },
  { id: 'beauty', label: 'Beauty', css: 'brightness(1.1) contrast(0.9) saturate(1.2)' },
  { id: 'warm', label: 'Warm', css: 'sepia(0.3) saturate(1.4) brightness(1.05)' },
  { id: 'cool', label: 'Cool', css: 'saturate(0.8) hue-rotate(20deg) brightness(1.05)' },
  { id: 'vivid', label: 'Vivid', css: 'saturate(1.6) contrast(1.1)' },
  { id: 'noir', label: 'Noir', css: 'grayscale(0.8) contrast(1.2)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(0.5) contrast(0.9) brightness(0.9)' },
];

const NOISE_LEVELS = [
  { id: 'off', label: 'Off' },
  { id: 'low', label: 'Low' },
  { id: 'high', label: 'High (AI)' },
];

export default function HostMediaPanel({ streamId, localStream, setLocalStream, onCamToggle, onMicToggle, camOn, micOn }) {
  const { socket } = useSocket();
  const videoRef = useRef(null);

  const [showPanel, setShowPanel] = useState(false);
  const [activeTab, setActiveTab] = useState('camera'); // camera | audio | settings
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [mirrorMode, setMirrorMode] = useState(true);
  const [noiseLevel, setNoiseLevel] = useState('off');
  const [micVolume, setMicVolume] = useState(100);
  const [availableCams, setAvailableCams] = useState([]);
  const [availableMics, setAvailableMics] = useState([]);
  const [selectedCam, setSelectedCam] = useState('');
  const [selectedMic, setSelectedMic] = useState('');
  const [resolution, setResolution] = useState('720p');
  const [frameRate, setFrameRate] = useState(30);

  // Load devices
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then(devices => {
      setAvailableCams(devices.filter(d => d.kind === 'videoinput'));
      setAvailableMics(devices.filter(d => d.kind === 'audioinput'));
    }).catch(() => {});
  }, []);

  // Attach local stream to preview
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream, showPanel]);

  // Broadcast media state to viewers
  useEffect(() => {
    socket?.emit('host_media_state', { streamId, camOn, micOn });
  }, [camOn, micOn, streamId]);

  // Computed video style
  const videoStyle = {
    filter: [
      FILTERS.find(f => f.id === selectedFilter)?.css || '',
      `brightness(${brightness}%)`,
      `contrast(${contrast}%)`,
      `saturate(${saturation}%)`,
    ].filter(Boolean).join(' '),
    transform: mirrorMode ? 'scaleX(-1)' : 'none',
  };

  const switchCamera = async (deviceId) => {
    try {
      const constraints = {
        video: { deviceId: { exact: deviceId }, width: resolution === '1080p' ? 1920 : resolution === '720p' ? 1280 : 640, height: resolution === '1080p' ? 1080 : resolution === '720p' ? 720 : 480, frameRate },
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
      };
      localStream?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setSelectedCam(deviceId);
      if (videoRef.current) videoRef.current.srcObject = stream;
      toast.success('Camera switched!');
    } catch (err) {
      toast.error('Could not switch camera');
    }
  };

  const switchMic = async (deviceId) => {
    try {
      setSelectedMic(deviceId);
      toast.success('Microphone switched');
    } catch { toast.error('Could not switch microphone'); }
  };

  const resetFilters = () => {
    setSelectedFilter('none');
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
  };

  return (
    <>
      {/* Floating control bar */}
      <div className="flex items-center gap-2 bg-dark-800/90 backdrop-blur-xl border border-white/10 rounded-2xl px-3 py-2 shadow-xl">
        {/* Camera toggle */}
        <button
          onClick={() => { onCamToggle(); socket?.emit('host_media_state', { streamId, camOn: !camOn, micOn }); }}
          className={`p-2.5 rounded-xl transition-all ${camOn ? 'bg-dark-700 text-white hover:bg-dark-600' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}
          title={camOn ? 'Turn off camera' : 'Turn on camera'}
        >
          {camOn ? <FiVideo className="text-lg" /> : <FiVideoOff className="text-lg" />}
        </button>

        {/* Mic toggle */}
        <button
          onClick={() => { onMicToggle(); socket?.emit('host_media_state', { streamId, camOn, micOn: !micOn }); }}
          className={`p-2.5 rounded-xl transition-all ${micOn ? 'bg-dark-700 text-white hover:bg-dark-600' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}
          title={micOn ? 'Mute mic' : 'Unmute mic'}
        >
          {micOn ? <FiMic className="text-lg" /> : <FiMicOff className="text-lg" />}
        </button>

        <div className="w-px h-6 bg-white/10 mx-1" />

        {/* Mirror toggle */}
        <button
          onClick={() => setMirrorMode(v => !v)}
          className={`p-2.5 rounded-xl transition-all text-sm ${mirrorMode ? 'bg-brand-500/20 text-brand-400' : 'bg-dark-700 text-white/50'}`}
          title="Mirror camera"
        >
          <FiRotateCcw className="text-lg" />
        </button>

        {/* Settings panel toggle */}
        <button
          onClick={() => setShowPanel(v => !v)}
          className={`p-2.5 rounded-xl transition-all ${showPanel ? 'bg-brand-500 text-white' : 'bg-dark-700 text-white/60 hover:text-white'}`}
          title="Media settings"
        >
          <FiSliders className="text-lg" />
        </button>

        {/* Status indicators */}
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
            style={{ maxHeight: '70vh', overflowY: 'auto' }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <FiSettings /> Media Controls
              </h3>
              <button onClick={() => setShowPanel(false)} className="p-1 text-white/50 hover:text-white">
                <FiX />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-3 bg-dark-700/50">
              {[
                { id: 'camera', label: 'Camera', icon: FiCamera },
                { id: 'audio', label: 'Audio', icon: FiMic },
                { id: 'settings', label: 'Settings', icon: FiSettings },
              ].map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === id ? 'bg-brand-500 text-white' : 'text-white/50 hover:text-white'}`}>
                  <Icon className="text-sm" /> {label}
                </button>
              ))}
            </div>

            {/* Camera tab */}
            {activeTab === 'camera' && (
              <div className="p-4 space-y-5">
                {/* Live preview */}
                <div className="relative rounded-xl overflow-hidden aspect-video bg-black">
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={videoStyle} />
                  {!camOn && (
                    <div className="absolute inset-0 bg-dark-900/90 flex items-center justify-center">
                      <div className="text-center text-white/40">
                        <FiVideoOff className="text-3xl mx-auto mb-1" />
                        <p className="text-xs">Camera off</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Filter presets */}
                <div>
                  <p className="text-white/60 text-xs uppercase tracking-widest mb-2">Filters</p>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {FILTERS.map(f => (
                      <button key={f.id} onClick={() => setSelectedFilter(f.id)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${selectedFilter === f.id ? 'bg-brand-500 text-white' : 'bg-dark-700 text-white/50 hover:text-white'}`}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Brightness / Contrast / Saturation */}
                {[
                  { label: 'Brightness', icon: FiSun, value: brightness, setter: setBrightness, min: 50, max: 150 },
                  { label: 'Contrast', icon: FiSliders, value: contrast, setter: setContrast, min: 50, max: 150 },
                  { label: 'Saturation', icon: FiSliders, value: saturation, setter: setSaturation, min: 0, max: 200 },
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
                  <button onClick={resetFilters} className="btn-ghost text-xs py-2 flex items-center gap-1.5">
                    <FiRotateCcw /> Reset
                  </button>
                  <button onClick={() => setMirrorMode(v => !v)}
                    className={`text-xs py-2 px-3 rounded-full border transition-all flex items-center gap-1.5 ${mirrorMode ? 'bg-brand-500/20 text-brand-400 border-brand-500/30' : 'border-white/10 text-white/50'}`}>
                    <FiRotateCcw /> Mirror {mirrorMode ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Camera selection */}
                {availableCams.length > 1 && (
                  <div>
                    <p className="text-white/60 text-xs uppercase tracking-widest mb-2">Camera Device</p>
                    <select value={selectedCam} onChange={e => switchCamera(e.target.value)}
                      className="w-full bg-dark-700 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500 appearance-none">
                      {availableCams.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 6)}`}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Audio tab */}
            {activeTab === 'audio' && (
              <div className="p-4 space-y-5">
                {/* Mic status */}
                <div className={`rounded-xl p-3 flex items-center gap-3 ${micOn ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                  {micOn ? <FiMic className="text-green-400" /> : <FiMicOff className="text-red-400" />}
                  <div>
                    <p className={`text-sm font-medium ${micOn ? 'text-green-400' : 'text-red-400'}`}>
                      Microphone {micOn ? 'Active' : 'Muted'}
                    </p>
                    <p className="text-white/40 text-xs">{micOn ? 'Viewers can hear you' : 'Click mic to unmute'}</p>
                  </div>
                </div>

                {/* Mic volume */}
                <div>
                  <div className="flex justify-between text-xs text-white/50 mb-1.5">
                    <span className="flex items-center gap-1"><FiVolume2 className="text-[11px]" /> Mic Volume</span>
                    <span>{micVolume}%</span>
                  </div>
                  <input type="range" min={0} max={150} value={micVolume}
                    onChange={e => setMicVolume(+e.target.value)}
                    className="w-full accent-brand-500 h-1.5" />
                </div>

                {/* Noise cancellation */}
                <div>
                  <p className="text-white/60 text-xs uppercase tracking-widest mb-2">Noise Suppression</p>
                  <div className="flex gap-2">
                    {NOISE_LEVELS.map(n => (
                      <button key={n.id} onClick={() => setNoiseLevel(n.id)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${noiseLevel === n.id ? 'bg-brand-500 text-white' : 'bg-dark-700 text-white/50'}`}>
                        {n.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mic selection */}
                {availableMics.length > 1 && (
                  <div>
                    <p className="text-white/60 text-xs uppercase tracking-widest mb-2">Microphone Device</p>
                    <select value={selectedMic} onChange={e => switchMic(e.target.value)}
                      className="w-full bg-dark-700 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500 appearance-none">
                      {availableMics.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 6)}`}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Settings tab */}
            {activeTab === 'settings' && (
              <div className="p-4 space-y-5">
                <div>
                  <p className="text-white/60 text-xs uppercase tracking-widest mb-2">Resolution</p>
                  <div className="flex gap-2">
                    {['480p', '720p', '1080p'].map(r => (
                      <button key={r} onClick={() => setResolution(r)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${resolution === r ? 'bg-brand-500 text-white' : 'bg-dark-700 text-white/50'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-white/60 text-xs uppercase tracking-widest mb-2">Frame Rate</p>
                  <div className="flex gap-2">
                    {[15, 24, 30, 60].map(fps => (
                      <button key={fps} onClick={() => setFrameRate(fps)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${frameRate === fps ? 'bg-brand-500 text-white' : 'bg-dark-700 text-white/50'}`}>
                        {fps}fps
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-dark-700/50 rounded-xl p-4 space-y-2 text-sm">
                  <p className="text-white/50 text-xs uppercase tracking-widest mb-2">Current Session</p>
                  <div className="flex justify-between"><span className="text-white/40">Resolution</span><span className="text-white">{resolution}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Frame Rate</span><span className="text-white">{frameRate}fps</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Camera</span><span className={camOn ? 'text-green-400' : 'text-red-400'}>{camOn ? 'On' : 'Off'}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Microphone</span><span className={micOn ? 'text-green-400' : 'text-red-400'}>{micOn ? 'On' : 'Off'}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Mirror</span><span className="text-white">{mirrorMode ? 'On' : 'Off'}</span></div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
