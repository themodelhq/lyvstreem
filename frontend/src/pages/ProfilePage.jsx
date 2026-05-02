import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StreamCard from '../components/StreamCard';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { FiEdit2, FiUsers, FiHeart, FiVideo } from 'react-icons/fi';

const TABS = ['Streams', 'About'];

export default function ProfilePage() {
  const { username } = useParams();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Streams');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const isOwn = currentUser?.username === username;

  useEffect(() => {
    setLoading(true);
    api.get(`/users/${username}`)
      .then(res => {
        setProfile(res.data);
        setIsFollowing(res.data.isFollowing);
      })
      .catch(() => toast.error('Profile not found'))
      .finally(() => setLoading(false));
  }, [username]);

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

  const initials = (profile.displayName?.[0] || profile.username?.[0] || '?').toUpperCase();
  const liveStream = profile.streams?.find(s => s.isLive);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Cover */}
      <div className="relative h-40 md:h-56 bg-gradient-to-br from-brand-900 to-dark-700 overflow-hidden">
        {profile.coverImage && <img src={profile.coverImage} alt="" className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-900/80 to-transparent" />
      </div>

      {/* Profile section */}
      <div className="px-4 md:px-6 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12 mb-6 relative z-10">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-2xl border-4 border-dark-900 bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-3xl font-bold overflow-hidden shadow-xl">
            {profile.avatar ? <img src={profile.avatar} alt="" className="w-full h-full object-cover" /> : initials}
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

          <div className="flex gap-2">
            {isOwn ? (
              <Link to="/settings" className="btn-ghost text-sm py-2 flex items-center gap-2">
                <FiEdit2 /> Edit Profile
              </Link>
            ) : (
              <>
                <button onClick={handleFollow} disabled={followLoading}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                    isFollowing ? 'bg-dark-600 text-white/60 hover:bg-red-500/20 hover:text-red-400 border border-white/10' : 'btn-primary'
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
        <div className="flex gap-6 mb-6">
          {[
            { label: 'Followers', value: profile.totalFollowers || 0, icon: FiUsers },
            { label: 'Following', value: profile.totalFollowing || 0, icon: FiHeart },
            { label: 'Streams', value: profile.streams?.length || 0, icon: FiVideo },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="text-center">
              <p className="text-white font-bold text-xl">{value.toLocaleString()}</p>
              <p className="text-white/40 text-xs flex items-center gap-1 mt-0.5"><Icon className="text-[10px]" />{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-dark-800 p-1 rounded-xl w-fit">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-dark-600 text-white' : 'text-white/50 hover:text-white'}`}>
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Streams' && (
          profile.streams?.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {profile.streams.map((s, i) => <StreamCard key={s._id} stream={{ ...s, streamerId: profile }} index={i} />)}
            </div>
          ) : (
            <div className="text-center py-16 text-white/30">
              <p className="text-4xl mb-3">📺</p>
              <p>No streams yet</p>
              {isOwn && <Link to="/go-live" className="btn-primary mt-4 inline-block text-sm">Go Live</Link>}
            </div>
          )
        )}

        {activeTab === 'About' && (
          <div className="glass-card p-6 max-w-lg">
            <h3 className="text-white font-semibold mb-3">About</h3>
            <p className="text-white/70 text-sm">{profile.bio || 'No bio yet.'}</p>
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-white/40 text-xs">Joined {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
