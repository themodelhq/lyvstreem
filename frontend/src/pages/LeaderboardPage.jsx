import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { FiTrendingUp, FiAward } from 'react-icons/fi';

const MOCK_LEADERS = [
  { _id: 'l1', username: 'nightowl_ng', displayName: 'Night Owl NG', totalLikes: 125400, totalFollowers: 84200, isVerified: true, avatar: '' },
  { _id: 'l2', username: 'djmix_abuja', displayName: 'DJ Mix Abuja', totalLikes: 98700, totalFollowers: 62100, isVerified: true, avatar: '' },
  { _id: 'l3', username: 'beautyqueen', displayName: 'Beauty Queen', totalLikes: 87300, totalFollowers: 54800, isVerified: false, avatar: '' },
  { _id: 'l4', username: 'funyemi', displayName: 'Funyemi', totalLikes: 73200, totalFollowers: 48900, isVerified: true, avatar: '' },
  { _id: 'l5', username: 'vibemaster', displayName: 'Vibe Master', totalLikes: 65100, totalFollowers: 41200, isVerified: false, avatar: '' },
  { _id: 'l6', username: 'fitchef', displayName: 'Fit Chef', totalLikes: 54800, totalFollowers: 37500, isVerified: false, avatar: '' },
  { _id: 'l7', username: 'travel_naija', displayName: 'Travel Naija', totalLikes: 49200, totalFollowers: 33100, isVerified: true, avatar: '' },
  { _id: 'l8', username: 'openmichost', displayName: 'Open Mic Host', totalLikes: 43700, totalFollowers: 28600, isVerified: false, avatar: '' },
  { _id: 'l9', username: 'chefsola', displayName: 'Chef Sola', totalLikes: 38200, totalFollowers: 24900, isVerified: false, avatar: '' },
  { _id: 'l10', username: 'yogabyamara', displayName: 'Yoga by Amara', totalLikes: 32100, totalFollowers: 20400, isVerified: false, avatar: '' },
];

const AVATAR_COLORS = ['from-pink-500 to-rose-600','from-purple-500 to-indigo-600','from-cyan-500 to-blue-600','from-green-500 to-emerald-600','from-orange-500 to-red-600','from-yellow-500 to-orange-600'];
const RANK_COLORS = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];
const RANK_EMOJIS = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');

  useEffect(() => {
    api.get('/users/leaderboard/top')
      .then(res => setLeaders(res.data.length ? res.data : MOCK_LEADERS))
      .catch(() => setLeaders(MOCK_LEADERS))
      .finally(() => setLoading(false));
  }, [period]);

  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <FiAward className="text-yellow-400 text-2xl" />
          <h1 className="text-2xl font-display font-bold text-white">Leaderboard</h1>
        </div>
        <p className="text-white/50 text-sm">Top streamers by total likes received</p>
      </div>

      {/* Period filter */}
      <div className="flex gap-2 justify-center mb-8">
        {['all', 'weekly', 'monthly'].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-full text-sm capitalize transition-all ${period === p ? 'bg-brand-500 text-white' : 'bg-dark-700 text-white/50 hover:text-white'}`}>
            {p === 'all' ? 'All Time' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Top 3 podium */}
          {top3.length >= 3 && (
            <div className="flex items-end justify-center gap-3 mb-8">
              {[top3[1], top3[0], top3[2]].map((leader, podiumIdx) => {
                const rank = podiumIdx === 1 ? 0 : podiumIdx === 0 ? 1 : 2;
                const heights = ['h-28', 'h-36', 'h-24'];
                const sizes = ['w-14 h-14', 'w-18 h-18', 'w-14 h-14'];
                const gradient = AVATAR_COLORS[rank % AVATAR_COLORS.length];
                return (
                  <Link key={leader._id} to={`/profile/${leader.username}`}
                    className={`flex flex-col items-center gap-2 ${podiumIdx === 1 ? 'scale-110' : ''}`}>
                    <div className={`relative w-14 h-14 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-xl font-bold overflow-hidden border-2 ${rank === 0 ? 'border-yellow-400' : rank === 1 ? 'border-gray-300' : 'border-amber-600'}`}>
                      {leader.avatar ? <img src={leader.avatar} alt="" className="w-full h-full object-cover" /> : (leader.displayName?.[0] || 'L').toUpperCase()}
                    </div>
                    <span className="text-2xl">{RANK_EMOJIS[rank]}</span>
                    <p className="text-white text-xs font-semibold text-center truncate w-20">{leader.displayName || leader.username}</p>
                    <p className="text-white/50 text-xs">{(leader.totalLikes || 0).toLocaleString()} ❤️</p>
                    <div className={`w-full rounded-t-lg flex items-center justify-center text-white/30 text-xs font-bold ${heights[rank === 0 ? 1 : rank === 1 ? 0 : 2]} bg-dark-700 min-w-[70px] border-t border-white/10`}>
                      #{rank + 1}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Remaining list */}
          <div className="space-y-2">
            {leaders.map((leader, i) => (
              <Link key={leader._id} to={`/profile/${leader.username}`}
                className="flex items-center gap-4 glass-card px-4 py-3 hover:border-brand-500/30 transition-all">
                <div className={`w-8 text-center font-bold text-sm ${i < 3 ? RANK_COLORS[i] : 'text-white/40'}`}>
                  {i < 3 ? RANK_EMOJIS[i] : `#${i + 1}`}
                </div>
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-sm font-bold overflow-hidden`}>
                  {leader.avatar ? <img src={leader.avatar} alt="" className="w-full h-full object-cover" /> : (leader.displayName?.[0] || 'L').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">
                    {leader.displayName || leader.username}
                    {leader.isVerified && <span className="text-brand-400 ml-1 text-xs">✓</span>}
                  </p>
                  <p className="text-white/40 text-xs">@{leader.username} · {(leader.totalFollowers || 0).toLocaleString()} followers</p>
                </div>
                <div className="text-right">
                  <p className="text-white/80 text-sm font-semibold">{(leader.totalLikes || 0).toLocaleString()}</p>
                  <p className="text-white/30 text-xs">❤️ likes</p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
