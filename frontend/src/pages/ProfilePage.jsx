import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StreamCard from '../components/StreamCard';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiEdit2, FiUsers, FiHeart, FiVideo, FiTrash2,
  FiAlertTriangle, FiRefreshCw, FiX, FiFilm, FiPlay
} from 'react-icons/fi';

const TABS = ['Streams', 'Wall', 'About'];

export default function ProfilePage() {
  const { username }          = useParams();
  const { user: currentUser } = useAuth();
  const navigate              = useNavigate();

  const [profile, setProfile]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState('Streams');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [clearingStreams, setClearingStreams] = useState(false);
  const [clips, setClips]             = useState([]);
  const [clipsLoading, setClipsLoading] = useState(false);
  const [wallEnabledPublic, setWallEnabledPublic] = useState(true);
  const [activeClip, setActiveClip]   = useState(null);

  const isOwn = currentUser?.username === username;

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/users/${username}`);
      setProfile(res.data);
      setIsFollowing(res.data.isFollowing);
    } catch {
      toast.error('Profile not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, [username]);

  // Load wall clips whenever profile changes
  useEffect(() => {
    if (!profile?._id) return;
    setClipsLoading(true);
    api.get(`/clips/user/${profile._id}`)
      .then(res => {
        setClips(res.data?.clips || []);
        setWallEnabledPublic(res.data?.wallEnabled !== false);
      })
      .catch(() => { setClips([]); })
      .finally(() => setClipsLoading(false));
  }, [profile?._id]);

  const deleteClip = async (clipId) => {
    if (!window.confirm('Remove this clip from your wall?')) return;
    try {
      await api.delete(`/clips/${clipId}`);
      setClips(prev => prev.filter(c => c._id !== clipId));
      toast.success('Clip removed');
    } catch {
      toast.error('Failed to remove clip');
    }
  };

  const handleFollow = async () => {
    if (!currentUser) { toast.error('Sign in to follow'); return; }
    setFollowLoading(true);
    try {
      const res = await api.post(`/users/${profile._id}/follow`);
      setIsFollowing(res.data.following);
      setProfile(prev => ({
        ...prev,
        totalFollowers: prev.totalFollowers + (res.data.following ? 1 : -1),
      }));
    } catch { toast.error('Action failed'); }
    finally { setFollowLoading(false); }
  };

  // End a single stale stream
  const endStream = async (streamId) => {
    try {
      await api.post(`/streams/${streamId}/end`);
      toast.success('Stream ended');
      fetchProfile();
    } catch {
      toast.error('Failed to end stream');
    }
  };

  // Clear ALL stale/live streams at once
  const clearAllStaleStreams = async () => {
    if (!window.confirm('End all active/stale stream sessions? This cannot be undone.')) return;
    setClearingStreams(true);
    try {
      const res = await api.delete('/streams/clear-stale');
      toast.success(`Cleared ${res.data.cleared} session${res.data.cleared !== 1 ? 's' : ''}`);
      fetchProfile();
    } catch {
      toast.error('Failed to clear streams');
    } finally {
      setClearingStreams(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!profile) return (
    <div className="text-center py-20">
      <p className="text-white/60">User not found</p>
      <Link to="/" className="btn-primary mt-4 inline-block">Home</Link>
    </div>
  );

  const initials     = (profile.displayName?.[0] || profile.username?.[0] || '?').toUpperCase();
  const liveStream   = profile.streams?.find(s => s.isLive);
  const staleStreams  = profile.streams?.filter(s => s.isLive) || [];
  const endedStreams  = profile.streams?.filter(s => !s.isLive) || [];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Cover */}
      <div className="relative h-40 md:h-56 bg-gradient-to-br from-brand-900 to-dark-700 overflow-hidden">
        {profile.coverImage && (
          <img src={profile.coverImage} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-900/80 to-transparent" />
      </div>

      {/* Profile section */}
      <div className="px-4 md:px-6 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12 mb-6 relative z-10">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-2xl border-4 border-dark-900 bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-3xl font-bold overflow-hidden shadow-xl">
            {profile.avatar
              ? <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
              : initials}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-white font-display font-bold text-2xl">
                {profile.displayName || profile.username}
              </h1>
              {profile.isVerified && <span className="text-brand-400 text-lg" title="Verified">✓</span>}
              {liveStream && <span className="live-badge">LIVE</span>}
            </div>
            <p className="text-white/50 text-sm">@{profile.username}</p>
          </div>

          <div className="flex gap-2 flex-wrap">
            {isOwn ? (
              <>
                <Link to="/settings" className="btn-ghost text-sm py-2 flex items-center gap-2">
                  <FiEdit2 /> Edit Profile
                </Link>
                {staleStreams.length > 0 && (
                  <button onClick={clearAllStaleStreams} disabled={clearingStreams}
                    className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-full px-4 py-2 text-sm font-semibold transition-all">
                    {clearingStreams
                      ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      : <FiRefreshCw className="text-sm" />}
                    Clear {staleStreams.length} Stale
                  </button>
                )}
              </>
            ) : (
              <>
                <button onClick={handleFollow} disabled={followLoading}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                    isFollowing
                      ? 'bg-dark-600 text-white/60 hover:bg-red-500/20 hover:text-red-400 border border-white/10'
                      : 'btn-primary'
                  }`}>
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
                {liveStream && (
                  <Link to={`/live/${liveStream._id}`}
                    className="px-5 py-2 rounded-full text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> Watch Live
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6 mb-6 flex-wrap">
          {[
            { label: 'Followers', value: profile.totalFollowers  || 0, icon: FiUsers },
            { label: 'Following', value: profile.totalFollowing  || 0, icon: FiHeart },
            { label: 'Streams',   value: profile.streams?.length || 0, icon: FiVideo },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="text-center">
              <p className="text-white font-bold text-xl">{value.toLocaleString()}</p>
              <p className="text-white/40 text-xs flex items-center gap-1 mt-0.5">
                <Icon className="text-[10px]" />{label}
              </p>
            </div>
          ))}
        </div>

        {/* Stale streams warning (own profile) */}
        {isOwn && staleStreams.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <FiAlertTriangle className="text-yellow-400 text-xl shrink-0" />
              <div>
                <p className="text-yellow-400 font-semibold text-sm">
                  {staleStreams.length} stale session{staleStreams.length > 1 ? 's' : ''} detected
                </p>
                <p className="text-white/50 text-xs mt-0.5">
                  These streams are marked live but the host is offline. End them to clean up your profile.
                </p>
              </div>
            </div>
            <button onClick={clearAllStaleStreams} disabled={clearingStreams}
              className="shrink-0 bg-yellow-500 hover:bg-yellow-600 text-dark-900 font-bold text-xs px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5">
              {clearingStreams
                ? <div className="w-3 h-3 border-2 border-dark-900 border-t-transparent rounded-full animate-spin" />
                : <FiTrash2 size={12} />}
              End All
            </button>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-dark-800 p-1 rounded-xl w-fit">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab ? 'bg-dark-600 text-white' : 'text-white/50 hover:text-white'
              }`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Streams tab */}
        {activeTab === 'Streams' && (
          <div className="space-y-6">
            {/* Stale / live streams */}
            {isOwn && staleStreams.length > 0 && (
              <div>
                <h3 className="text-white/60 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  Stale Sessions ({staleStreams.length})
                </h3>
                <div className="space-y-2">
                  {staleStreams.map(s => (
                    <div key={s._id}
                      className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse shrink-0" />
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">{s.title}</p>
                          <p className="text-white/40 text-xs">{s.category} · {new Date(s.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <Link to={`/live/${s._id}`}
                          className="text-xs text-white/50 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-all">
                          View
                        </Link>
                        <button onClick={() => endStream(s._id)}
                          className="flex items-center gap-1 text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors">
                          <FiX size={10} /> End
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Past streams grid */}
            {endedStreams.length > 0 ? (
              <div>
                {isOwn && staleStreams.length > 0 && (
                  <h3 className="text-white/60 text-xs uppercase tracking-widest mb-3">Past Streams</h3>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {endedStreams.map((s, i) => (
                    <StreamCard key={s._id} stream={{ ...s, streamerId: profile }} index={i} />
                  ))}
                </div>
              </div>
            ) : (
              staleStreams.length === 0 && (
                <div className="text-center py-16 text-white/30">
                  <p className="text-4xl mb-3">📺</p>
                  <p>No streams yet</p>
                  {isOwn && (
                    <Link to="/go-live" className="btn-primary mt-4 inline-block text-sm">
                      Go Live
                    </Link>
                  )}
                </div>
              )
            )}
          </div>
        )}

        {/* Wall tab */}
        {activeTab === 'Wall' && (
          <div>
            {!wallEnabledPublic ? (
              <div className="text-center py-16 text-white/30">
                <FiFilm className="text-4xl mx-auto mb-3" />
                <p>{isOwn ? 'Your Wall is turned off.' : 'This user has turned off their Wall.'}</p>
                {isOwn && (
                  <Link to="/settings" className="btn-ghost mt-4 inline-block text-sm">
                    Manage Wall settings
                  </Link>
                )}
              </div>
            ) : clipsLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : clips.length === 0 ? (
              <div className="text-center py-16 text-white/30">
                <FiFilm className="text-4xl mx-auto mb-3" />
                <p>No clips yet</p>
                {isOwn && (
                  <p className="text-xs mt-2 text-white/40 max-w-sm mx-auto">
                    Short highlights from your live streams will appear here automatically while Wall is enabled.
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {clips.map(c => (
                  <button
                    key={c._id}
                    onClick={() => setActiveClip(c)}
                    className="group relative aspect-[9/16] sm:aspect-video bg-dark-800 rounded-2xl overflow-hidden border border-white/5 hover:border-brand-500/40 transition-all text-left">
                    {c.thumbnail
                      ? <img src={c.thumbnail} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-gradient-to-br from-dark-700 to-dark-900" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                      <FiPlay size={10} /> {c.duration || 0}s
                    </div>
                    {isOwn && (
                      <span
                        role="button" tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); deleteClip(c._id); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); deleteClip(c._id); } }}
                        className="absolute top-2 right-2 bg-black/60 hover:bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Delete clip">
                        <FiTrash2 size={11} />
                      </span>
                    )}
                    <div className="absolute bottom-2 left-2 right-2 text-white text-xs truncate">
                      {c.title || 'Stream highlight'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Clip viewer modal */}
        <AnimatePresence>
          {activeClip && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setActiveClip(null)}
              className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-md aspect-[9/16] sm:aspect-video bg-dark-900 rounded-2xl overflow-hidden border border-white/10">
                <video
                  src={activeClip.videoData}
                  controls autoPlay
                  className="w-full h-full object-contain bg-black" />
                <button onClick={() => setActiveClip(null)}
                  className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full">
                  <FiX />
                </button>
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black to-transparent">
                  <p className="text-white text-sm font-medium truncate">{activeClip.title || 'Stream highlight'}</p>
                  <p className="text-white/50 text-xs">
                    {new Date(activeClip.capturedAt).toLocaleString()} · {activeClip.duration || 0}s
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* About tab */}
        {activeTab === 'About' && (
          <div className="glass-card p-6 max-w-lg">
            <h3 className="text-white font-semibold mb-3">About</h3>
            <p className="text-white/70 text-sm">{profile.bio || 'No bio yet.'}</p>
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-white/40 text-xs">
                Joined {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
