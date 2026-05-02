import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StreamCard from '../components/StreamCard';
import api from '../utils/api';
import { FiTrendingUp, FiZap } from 'react-icons/fi';
import { BsCameraVideoFill } from 'react-icons/bs';

const CATEGORIES = [
  { id: 'All', emoji: '🌟' },
  { id: 'Entertainment', emoji: '🎭' },
  { id: 'Gaming', emoji: '🎮' },
  { id: 'Music', emoji: '🎵' },
  { id: 'Beauty', emoji: '💄' },
  { id: 'Talk Show', emoji: '🎤' },
  { id: 'Fitness', emoji: '💪' },
  { id: 'Cooking', emoji: '👨‍🍳' },
  { id: 'Comedy', emoji: '😂' },
];

const MOCK_STREAMS = [
  { _id: 'mock1', title: 'Late Night Vibes 🌙', category: 'Entertainment', isLive: true, viewerCount: 1243, streamerId: { username: 'nightowl_ng', displayName: 'Night Owl NG', isVerified: true } },
  { _id: 'mock2', title: 'Afrobeats Mix Session 🎵', category: 'Music', isLive: true, viewerCount: 876, streamerId: { username: 'djkinglagos', displayName: 'DJ King Lagos' } },
  { _id: 'mock3', title: 'Warzone Squad Games 🎮', category: 'Gaming', isLive: true, viewerCount: 542, streamerId: { username: 'gamer_tunde', displayName: 'Gamer Tunde' } },
  { _id: 'mock4', title: 'Natural Hair Tutorial 💄', category: 'Beauty', isLive: true, viewerCount: 388, streamerId: { username: 'beautyqueen', displayName: 'Beauty Queen', isVerified: true } },
  { _id: 'mock5', title: 'Comedy Skit Live! 😂', category: 'Comedy', isLive: true, viewerCount: 2100, streamerId: { username: 'funyemi', displayName: 'Funyemi' } },
  { _id: 'mock6', title: 'Morning Workout 🏋️', category: 'Fitness', isLive: true, viewerCount: 198, streamerId: { username: 'fitchef', displayName: 'Fit Chef' } },
];

export default function HomePage() {
  const { user } = useAuth();
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    api.get('/streams/live', { params: { category: activeCategory === 'All' ? undefined : activeCategory, limit: 24 } })
      .then(res => setStreams(res.data.streams?.length ? res.data.streams : MOCK_STREAMS))
      .catch(() => setStreams(MOCK_STREAMS))
      .finally(() => setLoading(false));
  }, [activeCategory]);

  const filtered = activeCategory === 'All' ? streams : streams.filter(s =>
    s.category?.toLowerCase() === activeCategory.toLowerCase()
  );

  return (
    <div className="p-4 md:p-6 max-w-screen-2xl mx-auto">
      {/* Hero Banner */}
      {!user && (
        <div className="relative rounded-2xl overflow-hidden mb-8 bg-gradient-to-br from-brand-900 via-dark-700 to-dark-900 border border-brand-500/20 p-8">
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-brand-400 text-sm font-semibold mb-3">
              <FiZap /> LIVE NOW
            </div>
            <h1 className="font-display text-3xl md:text-5xl font-bold text-white leading-tight">
              Stream Your World<br />
              <span className="shimmer-text">With LyvStreem</span>
            </h1>
            <p className="text-white/60 mt-3 text-lg max-w-lg">
              Watch live streams, send gifts, chat in real-time. Join thousands of creators and viewers now.
            </p>
            <div className="flex gap-3 mt-6">
              <Link to="/register" className="btn-primary">Get Started Free</Link>
              <Link to="/discover" className="btn-ghost">Explore Streams</Link>
            </div>
          </div>
          {/* BG decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-brand-700/10 rounded-full blur-2xl" />
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeCategory === cat.id
                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30'
                : 'bg-dark-700 text-white/60 hover:text-white hover:bg-dark-600'
            }`}
          >
            <span>{cat.emoji}</span> {cat.id}
          </button>
        ))}
      </div>

      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-display font-bold text-xl flex items-center gap-2">
          <FiTrendingUp className="text-brand-400" />
          Live Now
          {streams.length > 0 && <span className="text-brand-500 text-sm font-normal">{streams.length} streams</span>}
        </h2>
        <Link to="/discover" className="text-brand-400 hover:text-brand-300 text-sm transition-colors">See all →</Link>
      </div>

      {/* Streams grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-video bg-dark-700 rounded-xl" />
              <div className="flex gap-2 mt-2 px-1">
                <div className="w-8 h-8 rounded-full bg-dark-700" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-dark-700 rounded w-4/5" />
                  <div className="h-3 bg-dark-700 rounded w-3/5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-6xl mb-4">📺</p>
          <p className="text-white/60 text-lg">No live streams right now</p>
          <p className="text-white/30 text-sm mt-1">Be the first to go live!</p>
          {user && <Link to="/go-live" className="btn-primary mt-4 inline-block">Go Live Now</Link>}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((stream, i) => (
            <StreamCard key={stream._id} stream={stream} index={i} />
          ))}
        </div>
      )}

      {/* Go Live CTA for logged-in users */}
      {user && (
        <div className="mt-12 text-center py-8 border border-dashed border-white/10 rounded-2xl">
          <BsCameraVideoFill className="text-4xl text-brand-400 mx-auto mb-3" />
          <h3 className="text-white font-display font-bold text-xl">Ready to Go Live?</h3>
          <p className="text-white/50 text-sm mt-1">Share your world with thousands of viewers</p>
          <Link to="/go-live" className="btn-primary mt-4 inline-block">Start Streaming</Link>
        </div>
      )}
    </div>
  );
}
