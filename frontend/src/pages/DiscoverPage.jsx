import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import StreamCard from '../components/StreamCard';
import api from '../utils/api';
import { FiSearch, FiFilter } from 'react-icons/fi';

const CATEGORIES = [
  { id: 'All', emoji: '🌟' }, { id: 'Entertainment', emoji: '🎭' },
  { id: 'Gaming', emoji: '🎮' }, { id: 'Music', emoji: '🎵' },
  { id: 'Talk Show', emoji: '🎤' }, { id: 'Beauty', emoji: '💄' },
  { id: 'Fitness', emoji: '💪' }, { id: 'Cooking', emoji: '👨‍🍳' },
  { id: 'Travel', emoji: '✈️' }, { id: 'Education', emoji: '📚' },
  { id: 'Sports', emoji: '⚽' }, { id: 'Comedy', emoji: '😂' },
  { id: 'Fashion', emoji: '👗' },
];

const MOCK = [
  { _id: 'd1', title: 'Sunday Vibes 🌞', category: 'Entertainment', isLive: true, viewerCount: 892, streamerId: { username: 'vibemaster', displayName: 'Vibe Master', isVerified: true } },
  { _id: 'd2', title: 'Beat Drop Session', category: 'Music', isLive: true, viewerCount: 1450, streamerId: { username: 'djmix_abuja', displayName: 'DJ Mix Abuja' } },
  { _id: 'd3', title: 'FIFA Tournament 🎮', category: 'Gaming', isLive: true, viewerCount: 334, streamerId: { username: 'fifaking_ng', displayName: 'FIFA King NG' } },
  { _id: 'd4', title: 'Glow Up Routine ✨', category: 'Beauty', isLive: true, viewerCount: 671, streamerId: { username: 'glowup_ify', displayName: 'Glow Up Ify', isVerified: true } },
  { _id: 'd5', title: 'Open Mic Night 🎙️', category: 'Talk Show', isLive: true, viewerCount: 2340, streamerId: { username: 'openmichost', displayName: 'Open Mic Host' } },
  { _id: 'd6', title: 'Jollof Cook Off 🍚', category: 'Cooking', isLive: true, viewerCount: 445, streamerId: { username: 'chefsola', displayName: 'Chef Sola' } },
  { _id: 'd7', title: 'Morning Yoga Flow 🧘', category: 'Fitness', isLive: true, viewerCount: 220, streamerId: { username: 'yogabyamara', displayName: 'Yoga by Amara' } },
  { _id: 'd8', title: 'Lagos Night Life 🌃', category: 'Travel', isLive: true, viewerCount: 987, streamerId: { username: 'travel_naija', displayName: 'Travel Naija' } },
];

export default function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    setLoading(true);
    api.get('/streams/live', { params: { category: activeCategory === 'All' ? undefined : activeCategory, limit: 48 } })
      .then(res => setStreams(res.data.streams?.length ? res.data.streams : MOCK))
      .catch(() => setStreams(MOCK))
      .finally(() => setLoading(false));
  }, [activeCategory]);

  const filtered = streams.filter(s =>
    !query || s.title?.toLowerCase().includes(query.toLowerCase()) ||
    s.streamerId?.displayName?.toLowerCase().includes(query.toLowerCase()) ||
    s.streamerId?.username?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 max-w-screen-2xl mx-auto">
      <h1 className="text-2xl font-display font-bold text-white mb-6">Discover Streams</h1>

      {/* Search */}
      <div className="relative mb-6">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search streams and creators..."
          className="w-full bg-dark-700 border border-white/10 rounded-full pl-11 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-brand-500 transition-colors"
        />
      </div>

      {/* Category grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-13 gap-2 mb-8">
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl text-xs font-medium transition-all ${
              activeCategory === cat.id ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'bg-dark-800 text-white/60 hover:text-white hover:bg-dark-700'
            }`}>
            <span className="text-xl">{cat.emoji}</span>
            <span className="truncate w-full text-center">{cat.id}</span>
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-white/60 text-sm">{filtered.length} streams found</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-video bg-dark-700 rounded-xl" />
              <div className="flex gap-2 mt-2 px-1"><div className="w-8 h-8 rounded-full bg-dark-700" /><div className="flex-1 space-y-1"><div className="h-3 bg-dark-700 rounded w-4/5" /><div className="h-3 bg-dark-700 rounded w-3/5" /></div></div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">🔍</p>
          <p className="text-white/60">No streams found for "{query}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((stream, i) => <StreamCard key={stream._id} stream={stream} index={i} />)}
        </div>
      )}
    </div>
  );
}
