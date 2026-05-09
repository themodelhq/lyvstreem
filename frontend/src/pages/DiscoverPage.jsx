import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import StreamCard from '../components/StreamCard';
import api from '../utils/api';
import { FiSearch, FiRefreshCw } from 'react-icons/fi';

const CATEGORIES = [
  { id: 'All',           emoji: '🌟' },
  { id: 'Entertainment', emoji: '🎭' },
  { id: 'Gaming',        emoji: '🎮' },
  { id: 'Music',         emoji: '🎵' },
  { id: 'Talk Show',     emoji: '🎤' },
  { id: 'Beauty',        emoji: '💄' },
  { id: 'Fitness',       emoji: '💪' },
  { id: 'Cooking',       emoji: '👨‍🍳' },
  { id: 'Travel',        emoji: '✈️' },
  { id: 'Education',     emoji: '📚' },
  { id: 'Sports',        emoji: '⚽' },
  { id: 'Comedy',        emoji: '😂' },
  { id: 'Fashion',       emoji: '👗' },
];

export default function DiscoverPage() {
  const [searchParams]                      = useSearchParams();
  const [streams, setStreams]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [query, setQuery]                   = useState(searchParams.get('q') || '');
  const [activeCategory, setActiveCategory] = useState('All');
  const [refreshing, setRefreshing]         = useState(false);

  const fetchStreams = async (quiet = false) => {
    if (!quiet) setLoading(true); else setRefreshing(true);
    try {
      const res = await api.get('/streams/live', {
        params: { category: activeCategory === 'All' ? undefined : activeCategory, limit: 48 },
      });
      setStreams(res.data.streams || []);
    } catch {
      setStreams([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchStreams(); }, [activeCategory]);

  useEffect(() => {
    const id = setInterval(() => fetchStreams(true), 60000);
    return () => clearInterval(id);
  }, [activeCategory]);

  const filtered = streams.filter(s =>
    !query ||
    s.title?.toLowerCase().includes(query.toLowerCase()) ||
    s.streamerId?.displayName?.toLowerCase().includes(query.toLowerCase()) ||
    s.streamerId?.username?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-white">Discover Streams</h1>
        <button onClick={() => fetchStreams(true)} disabled={refreshing}
          className="text-white/40 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-all">
          <FiRefreshCw className={`text-sm ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search streams and creators..."
          className="w-full bg-dark-700 border border-white/10 rounded-full pl-11 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-brand-500 transition-colors" />
      </div>

      {/* Category grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-13 gap-2 mb-8">
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl text-xs font-medium transition-all ${
              activeCategory === cat.id
                ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                : 'bg-dark-800 text-white/60 hover:text-white hover:bg-dark-700'
            }`}>
            <span className="text-xl">{cat.emoji}</span>
            <span className="truncate w-full text-center">{cat.id}</span>
          </button>
        ))}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-white/40 text-sm">
          {loading ? 'Loading...' : `${filtered.length} live stream${filtered.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-video bg-dark-700 rounded-xl" />
              <div className="flex gap-2 mt-2 px-1">
                <div className="w-8 h-8 rounded-full bg-dark-700 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-dark-700 rounded w-4/5" />
                  <div className="h-3 bg-dark-700 rounded w-3/5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">🔍</p>
          <p className="text-white/60 font-medium">
            {query ? `No streams found for "${query}"` : 'No live streams right now'}
          </p>
          <p className="text-white/30 text-sm mt-2">Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((stream, i) => (
            <StreamCard key={stream._id} stream={stream} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
