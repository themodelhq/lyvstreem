import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { motion } from 'framer-motion';
import {
  FiTrendingUp, FiClock, FiGift, FiDollarSign, FiUsers,
  FiBarChart2, FiAlertCircle, FiCheckCircle, FiRefreshCw
} from 'react-icons/fi';
import { BsCameraVideoFill } from 'react-icons/bs';

const COINS_PER = 210;
const NAIRA_PER = 1300;
const coinsToNaira = (c) => Math.floor((c / COINS_PER) * NAIRA_PER);

function StatCard({ icon: Icon, label, value, sub, color = 'brand', glow }) {
  const colors = {
    brand: 'from-brand-500/20 to-brand-700/10 border-brand-500/20',
    green: 'from-green-500/20 to-green-700/10 border-green-500/20',
    yellow: 'from-yellow-500/20 to-yellow-700/10 border-yellow-500/20',
    blue: 'from-blue-500/20 to-blue-700/10 border-blue-500/20',
    red: 'from-red-500/20 to-red-700/10 border-red-500/20',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-2xl border bg-gradient-to-br p-5 overflow-hidden ${colors[color]} ${glow ? 'shadow-lg shadow-green-500/20' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl bg-${color === 'brand' ? 'brand' : color}-500/20`}>
          <Icon className={`text-${color === 'brand' ? 'brand' : color}-400 text-xl`} />
        </div>
      </div>
      <p className="text-white/50 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className="text-white font-display font-bold text-2xl">{value}</p>
      {sub && <p className="text-white/40 text-xs mt-1">{sub}</p>}
    </motion.div>
  );
}

function ProgressBar({ value, max, label, color = '#d946ef' }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs text-white/60 mb-1.5">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2.5 bg-dark-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, ${color}99)` }}
        />
      </div>
    </div>
  );
}

export default function HostDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef(null);

  const fetchData = async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const [eligRes, streamRes] = await Promise.all([
        api.get('/withdrawals/eligibility'),
        api.get('/streams/my/streams'),
      ]);
      setData(eligRes.data);
      setStreams(streamRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Live poll every 30s
    pollRef.current = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(pollRef.current);
  }, []);

  if (loading) return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const monthlyHours = data?.monthlyHoursDone || 0;
  const monthlyHoursReq = data?.monthlyHoursRequired || 30;
  const coins = data?.coinsEarned || 0;
  const minCoins = data?.minCoins || 2500;
  const naira = data?.nairaValue || 0;
  const totalHours = +((data?.totalStreamMinutes || 0) / 60).toFixed(1);
  const liveStream = streams.find(s => s.isLive);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Host Dashboard</h1>
          <p className="text-white/40 text-sm mt-0.5">Live earnings & stream analytics</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => fetchData(true)} disabled={refreshing}
            className="btn-ghost text-sm py-2 flex items-center gap-2">
            <FiRefreshCw className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
          <Link to="/go-live" className="btn-primary text-sm py-2 flex items-center gap-2">
            <BsCameraVideoFill /> Go Live
          </Link>
        </div>
      </div>

      {/* Live indicator */}
      {liveStream && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <div>
              <p className="text-white font-semibold">You are LIVE right now</p>
              <p className="text-white/50 text-sm">{liveStream.title}</p>
            </div>
          </div>
          <Link to={`/live/${liveStream._id}`}
            className="bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-1.5 rounded-full font-semibold transition-colors">
            View Stream
          </Link>
        </motion.div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={FiGift} label="Earned Coins" value={coins.toLocaleString()}
          sub={`≈ ₦${naira.toLocaleString()}`} color="yellow" />
        <StatCard icon={FiDollarSign} label="Withdrawable" value={`₦${naira.toLocaleString()}`}
          sub={`${coins.toLocaleString()} coins`} color="green" glow={data?.canWithdraw} />
        <StatCard icon={FiClock} label="This Month" value={`${monthlyHours}h`}
          sub={`${monthlyHoursReq}h required`} color="blue" />
        <StatCard icon={FiBarChart2} label="Total Hours" value={`${totalHours}h`}
          sub={`${(data?.totalStreamMinutes || 0).toLocaleString()} mins`} color="brand" />
      </div>

      {/* Eligibility Panel */}
      <div className="glass-card p-6 mb-6">
        <h2 className="text-white font-semibold font-display text-lg mb-5 flex items-center gap-2">
          {data?.canWithdraw
            ? <><FiCheckCircle className="text-green-400" /> Eligible to Withdraw</>
            : <><FiAlertCircle className="text-yellow-400" /> Withdrawal Requirements</>}
        </h2>

        <div className="space-y-4 mb-6">
          <ProgressBar
            value={coins} max={minCoins}
            label={`Coins: ${coins.toLocaleString()} / ${minCoins.toLocaleString()} (${data?.isFirstWithdrawal ? '1st withdrawal' : 'subsequent'})`}
            color="#d946ef"
          />
          <ProgressBar
            value={monthlyHours} max={monthlyHoursReq}
            label={`Monthly Hours: ${monthlyHours}h / ${monthlyHoursReq}h`}
            color="#22d3ee"
          />
        </div>

        {/* Rules */}
        <div className="grid sm:grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Conversion Rate', value: '210 coins = ₦1,300', icon: '💱' },
            { label: 'First Withdrawal Min', value: '2,500 coins', icon: '🥇' },
            { label: 'Subsequent Min', value: '5,000 coins', icon: '🔄' },
          ].map(r => (
            <div key={r.label} className="bg-dark-700/50 rounded-xl p-3 flex items-center gap-3">
              <span className="text-xl">{r.icon}</span>
              <div>
                <p className="text-white/40 text-xs">{r.label}</p>
                <p className="text-white text-sm font-semibold">{r.value}</p>
              </div>
            </div>
          ))}
        </div>

        {data?.canWithdraw ? (
          <Link to="/withdraw" className="btn-primary py-3 flex items-center justify-center gap-2 w-full sm:w-auto px-8">
            <FiDollarSign /> Withdraw Earnings
          </Link>
        ) : (
          <div className="space-y-2">
            {data?.reasons?.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-yellow-400 text-sm bg-yellow-500/10 rounded-xl px-4 py-2.5">
                <FiAlertCircle className="mt-0.5 shrink-0" /> {r}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Streams */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold font-display text-lg">Recent Streams</h2>
          <Link to="/go-live" className="text-brand-400 text-sm hover:text-brand-300">+ New Stream</Link>
        </div>
        {streams.length === 0 ? (
          <div className="text-center py-10 text-white/30">
            <BsCameraVideoFill className="text-4xl mx-auto mb-2" />
            <p>No streams yet — go live to start earning!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {streams.slice(0, 8).map(s => (
              <div key={s._id} className="flex items-center gap-4 bg-dark-700/40 rounded-xl px-4 py-3">
                <div className={`w-2.5 h-2.5 rounded-full ${s.isLive ? 'bg-red-500 animate-pulse' : 'bg-white/20'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{s.title}</p>
                  <p className="text-white/40 text-xs">{s.category} · {new Date(s.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white/70 text-sm flex items-center gap-1">
                    <FiUsers className="text-xs" /> {s.viewerCount || 0}
                  </p>
                  {s.duration > 0 && (
                    <p className="text-white/40 text-xs">{Math.floor(s.duration / 60)}m</p>
                  )}
                </div>
                {s.isLive
                  ? <Link to={`/live/${s._id}`} className="live-badge shrink-0">LIVE</Link>
                  : <span className="text-white/20 text-xs shrink-0">Ended</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
