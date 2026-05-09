import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLiveStream } from '../context/LiveStreamContext';
import {
  FiHome, FiCompass, FiAward, FiSettings, FiLogOut,
  FiLogIn, FiMenu, FiX, FiSearch, FiDollarSign,
  FiBarChart2, FiRadio
} from 'react-icons/fi';
import { BsCameraVideoFill } from 'react-icons/bs';

const NAV_ITEMS = [
  { path: '/', icon: FiHome, label: 'Home' },
  { path: '/discover', icon: FiCompass, label: 'Discover' },
  { path: '/leaderboard', icon: FiAward, label: 'Leaderboard' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { activeStream, isMinimized, restore } = useLiveStream() || {};
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) { navigate(`/discover?q=${encodeURIComponent(searchQuery)}`); setMobileOpen(false); }
  };

  const isActive = (path) => location.pathname === path;

  const handleReturnToStream = () => {
    restore?.();
    navigate(`/go-live?restore=${activeStream._id}`);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-dark-800/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-screen-2xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-md shadow-brand-500/30">
              <BsCameraVideoFill className="text-white text-sm" />
            </div>
            <span className="font-display font-bold text-xl text-white">Lyv<span className="shimmer-text">Streem</span></span>
          </Link>

          {/* Search */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md">
            <div className="relative w-full">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search streams, creators..."
                className="w-full bg-dark-700 border border-white/10 rounded-full pl-9 pr-4 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-brand-500 transition-colors" />
            </div>
          </form>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* Return to live stream button */}
            {activeStream && isMinimized && (
              <button onClick={handleReturnToStream}
                className="hidden sm:flex items-center gap-1.5 bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white rounded-full px-3 py-1.5 text-xs font-semibold transition-all animate-pulse">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                Live
              </button>
            )}

            {user ? (
              <>
                {!activeStream && (
                  <Link to="/go-live" className="hidden sm:flex items-center gap-1.5 btn-primary text-sm py-2">
                    <BsCameraVideoFill /> Go Live
                  </Link>
                )}
                <Link to="/coins" className="coin-display text-yellow-400 hidden sm:flex">
                  <span>🪙</span> {(user.coins || 0).toLocaleString()}
                </Link>
                <Link to={`/profile/${user.username}`}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-sm font-bold overflow-hidden">
                  {user.avatar
                    ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                    : (user.displayName?.[0] || user.username?.[0] || 'U').toUpperCase()}
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost text-sm py-2 hidden sm:block">Sign In</Link>
                <Link to="/register" className="btn-primary text-sm py-2">Join Free</Link>
              </>
            )}
            <button onClick={() => setMobileOpen(v => !v)} className="md:hidden p-2 text-white/60">
              {mobileOpen ? <FiX /> : <FiMenu />}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className={`fixed md:sticky top-16 h-[calc(100vh-4rem)] w-56 bg-dark-800/50 border-r border-white/5 flex-col py-4 z-40 transition-transform duration-300
          ${mobileOpen ? 'flex translate-x-0' : '-translate-x-full md:flex md:translate-x-0'}`}>

          <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
            {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
              <Link key={path} to={path} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                  ${isActive(path) ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
                <Icon className="text-lg shrink-0" /> {label}
              </Link>
            ))}

            {user && (
              <>
                <div className="pt-4 pb-1 px-3 text-[10px] text-white/30 uppercase tracking-widest font-semibold">Creator</div>

                {/* Return to live stream */}
                {activeStream && isMinimized ? (
                  <button onClick={handleReturnToStream}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                    <FiRadio className="text-lg shrink-0" /> Return to Stream
                  </button>
                ) : (
                  <Link to="/go-live" onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                      ${isActive('/go-live') ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
                    <BsCameraVideoFill className="text-lg shrink-0" /> Go Live
                  </Link>
                )}

                <Link to="/host-dashboard" onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                    ${isActive('/host-dashboard') ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
                  <FiBarChart2 className="text-lg shrink-0" /> Host Dashboard
                </Link>

                <Link to="/withdraw" onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                    ${isActive('/withdraw') ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
                  <FiDollarSign className="text-lg shrink-0" /> Withdraw
                </Link>

                <div className="pt-4 pb-1 px-3 text-[10px] text-white/30 uppercase tracking-widest font-semibold">Viewer</div>

                <Link to="/coins" onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                    ${isActive('/coins') ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
                  <span className="text-lg shrink-0">🪙</span> Buy Coins
                </Link>
              </>
            )}
          </nav>

          <div className="px-3 space-y-1 border-t border-white/5 pt-3 shrink-0">
            {user ? (
              <>
                <Link to="/settings" onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all">
                  <FiSettings className="shrink-0" /> Settings
                </Link>
                <button onClick={() => { logout(); setMobileOpen(false); navigate('/'); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-all">
                  <FiLogOut className="shrink-0" /> Sign Out
                </button>
              </>
            ) : (
              <Link to="/login" onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all">
                <FiLogIn className="shrink-0" /> Sign In
              </Link>
            )}
          </div>
        </aside>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 bg-black/50 z-30 top-16" onClick={() => setMobileOpen(false)} />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
