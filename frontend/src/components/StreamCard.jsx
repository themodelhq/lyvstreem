import React from 'react';
import { Link } from 'react-router-dom';
import { FiEye } from 'react-icons/fi';

const PLACEHOLDER_THUMBNAILS = [
  'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=400&q=80',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80',
  'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400&q=80',
  'https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=400&q=80',
  'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80',
  'https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=400&q=80',
];

const AVATAR_COLORS = [
  'from-pink-500 to-rose-600',
  'from-purple-500 to-indigo-600',
  'from-cyan-500 to-blue-600',
  'from-green-500 to-emerald-600',
  'from-orange-500 to-red-600',
  'from-yellow-500 to-orange-600',
];

export default function StreamCard({ stream, index = 0 }) {
  const streamer = stream.streamerId || {};
  const thumbnail = stream.thumbnail || PLACEHOLDER_THUMBNAILS[index % PLACEHOLDER_THUMBNAILS.length];
  const avatarGradient = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const initial = (streamer.displayName?.[0] || streamer.username?.[0] || 'L').toUpperCase();

  return (
    <Link to={`/live/${stream._id}`} className="stream-card block group">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-dark-700 overflow-hidden rounded-xl">
        <img
          src={thumbnail}
          alt={stream.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={e => { e.target.src = PLACEHOLDER_THUMBNAILS[0]; }}
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {/* Live badge */}
        {stream.isLive && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md uppercase">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            LIVE
          </div>
        )}

        {/* Viewer count */}
        <div className="absolute bottom-2 left-2 viewer-badge">
          <FiEye className="text-xs" />
          <span>{(stream.viewerCount || 0).toLocaleString()}</span>
        </div>

        {/* Category */}
        {stream.category && (
          <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white/80 text-xs px-2 py-1 rounded-md">
            {stream.category}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex gap-2.5 mt-2 px-1">
        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden`}>
          {streamer.avatar ? <img src={streamer.avatar} alt="" className="w-full h-full object-cover" /> : initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-medium truncate leading-tight">{stream.title}</p>
          <p className="text-white/50 text-xs mt-0.5 truncate">
            {streamer.displayName || streamer.username}
            {streamer.isVerified && <span className="text-brand-400 ml-1">✓</span>}
          </p>
        </div>
      </div>
    </Link>
  );
}
