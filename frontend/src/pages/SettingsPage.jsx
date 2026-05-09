import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUser, FiCamera, FiLock, FiBell, FiLogOut, FiDownload,
  FiSmartphone, FiWifi, FiTrash2, FiAlertTriangle, FiCheck, FiFilm
} from 'react-icons/fi';
import { PWAInstallButton } from '../components/PWAInstallBanner';
import usePWA from '../hooks/usePWA';

const TABS = [
  { id: 'profile',       label: 'Profile',       icon: FiUser      },
  { id: 'wall',          label: 'Wall',          icon: FiFilm      },
  { id: 'notifications', label: 'Notifications', icon: FiBell      },
  { id: 'security',      label: 'Security',      icon: FiLock      },
  { id: 'app',           label: 'App',           icon: FiSmartphone },
  { id: 'danger',        label: 'Danger Zone',   icon: FiTrash2    },
];

const AVATAR_OPTIONS = Array.from({ length: 6 }, (_, i) =>
  `https://api.dicebear.com/7.x/adventurer/svg?seed=lyvstreem${i + 1}`
);

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [form, setForm]           = useState({ displayName: user?.displayName || '', bio: user?.bio || '', avatar: user?.avatar || '' });
  const [saving, setSaving]       = useState(false);

  // Wall settings
  const [wallEnabled, setWallEnabled] = useState(user?.wallEnabled !== false);
  const [wallSaving, setWallSaving]   = useState(false);
  const [clearingClips, setClearingClips] = useState(false);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword]       = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting]                   = useState(false);

  const { isInstalled, isOnline, notifPermission, requestNotifications } = usePWA();

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/users/profile/update', form);
      updateUser(res.data);
      toast.success('Profile updated!');
    } catch { toast.error('Update failed'); }
    finally { setSaving(false); }
  };

  const toggleWall = async (next) => {
    setWallSaving(true);
    setWallEnabled(next);
    try {
      const res = await api.put('/users/profile/update', { wallEnabled: next });
      updateUser(res.data);
      toast.success(next ? 'Wall enabled' : 'Wall disabled');
    } catch {
      setWallEnabled(!next);
      toast.error('Failed to update wall');
    } finally {
      setWallSaving(false);
    }
  };

  const clearAllClips = async () => {
    if (!window.confirm('Delete ALL clips from your wall? This cannot be undone.')) return;
    setClearingClips(true);
    try {
      const res = await api.delete('/clips/me/all');
      toast.success(`Cleared ${res.data?.deleted || 0} clip${(res.data?.deleted || 0) !== 1 ? 's' : ''}`);
    } catch {
      toast.error('Failed to clear clips');
    } finally {
      setClearingClips(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }
    if (!deletePassword) {
      toast.error('Please enter your password');
      return;
    }
    setDeleting(true);
    try {
      await api.delete('/users/account/delete', { data: { password: deletePassword } });
      toast.success('Account deleted. Goodbye!');
      logout();
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-display font-bold text-white mb-6">Settings</h1>

      <div className="grid md:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <nav className="space-y-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left
                  ${activeTab === id
                    ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                    : id === 'danger'
                      ? 'text-red-400/60 hover:text-red-400 hover:bg-red-500/10'
                      : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
                <Icon className="shrink-0" /> {label}
              </button>
            ))}
            <button onClick={() => { logout(); navigate('/'); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-all">
              <FiLogOut className="shrink-0" /> Sign Out
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="md:col-span-3">

          {/* ── Profile ── */}
          {activeTab === 'profile' && (
            <div className="glass-card p-6">
              <h2 className="text-white font-semibold text-lg mb-6">Edit Profile</h2>

              <div className="mb-6">
                <p className="text-white/60 text-sm mb-3">Choose Avatar</p>
                <div className="flex gap-3 flex-wrap">
                  {AVATAR_OPTIONS.map((url, i) => (
                    <button key={i} onClick={() => setForm(p => ({ ...p, avatar: url }))}
                      className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-all
                        ${form.avatar === url ? 'border-brand-500 scale-110' : 'border-transparent hover:border-white/30'}`}>
                      <img src={url} alt="" className="w-full h-full object-cover bg-dark-700" />
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={saveProfile} className="space-y-4">
                <div>
                  <label className="text-white/60 text-sm mb-1.5 block">Display Name</label>
                  <input type="text" value={form.displayName}
                    onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
                    className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-colors" />
                </div>
                <div>
                  <label className="text-white/60 text-sm mb-1.5 block">Bio</label>
                  <textarea value={form.bio}
                    onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                    rows={4} maxLength={300} placeholder="Tell the world about yourself..."
                    className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-brand-500 transition-colors resize-none" />
                  <p className="text-white/30 text-xs mt-1 text-right">{form.bio.length}/300</p>
                </div>
                <div>
                  <label className="text-white/60 text-sm mb-1.5 block">Username</label>
                  <div className="bg-dark-700/50 border border-white/5 rounded-xl px-4 py-3 text-white/40 text-sm">
                    @{user?.username} <span className="text-xs ml-2 text-white/20">(cannot be changed)</span>
                  </div>
                </div>
                <button type="submit" disabled={saving}
                  className="btn-primary py-2.5 flex items-center gap-2">
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><FiCheck /> Save Changes</>}
                </button>
              </form>
            </div>
          )}

          {/* ── Wall ── */}
          {activeTab === 'wall' && (
            <div className="glass-card p-6 space-y-6">
              <div>
                <h2 className="text-white font-semibold text-lg flex items-center gap-2">
                  <FiFilm className="text-brand-400" /> User Wall
                </h2>
                <p className="text-white/50 text-sm mt-1">
                  Auto-capture short clips of your live stream sessions and showcase them on your profile.
                </p>
              </div>

              <div className="flex items-center justify-between py-4 border-y border-white/5">
                <div className="pr-4">
                  <p className="text-white text-sm font-medium">Capture Wall Clips</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {wallEnabled
                      ? 'A short highlight will be saved automatically every few minutes while you stream.'
                      : 'No clips will be captured or shown on your profile.'}
                  </p>
                </div>
                <button
                  type="button" disabled={wallSaving}
                  onClick={() => toggleWall(!wallEnabled)}
                  className={`relative w-12 h-7 rounded-full transition-colors shrink-0
                    ${wallEnabled ? 'bg-brand-500' : 'bg-dark-600'}
                    ${wallSaving ? 'opacity-60' : ''}`}>
                  <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform
                    ${wallEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="bg-dark-700/40 rounded-xl p-4 text-xs text-white/50 leading-relaxed">
                <p className="text-white/70 font-medium mb-1">How it works</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Clips are ~15 seconds, captured a couple of times per stream session.</li>
                  <li>Clips appear on your profile under the <span className="text-white/80">Wall</span> tab.</li>
                  <li>You can delete individual clips or clear the wall any time.</li>
                  <li>Disabling the wall stops new clips and hides existing ones from your profile.</li>
                </ul>
              </div>

              <button onClick={clearAllClips} disabled={clearingClips}
                className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all">
                {clearingClips
                  ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  : <FiTrash2 />}
                Clear all clips
              </button>
            </div>
          )}

          {/* ── Notifications ── */}
          {activeTab === 'notifications' && (
            <div className="glass-card p-6">
              <h2 className="text-white font-semibold text-lg mb-6">Notification Settings</h2>
              {[
                { id: 'newFollower', label: 'New Follower',   desc: 'When someone follows you'        },
                { id: 'giftReceived',label: 'Gift Received',  desc: 'When someone sends you a gift'   },
                { id: 'streamStart', label: 'Stream Alerts',  desc: 'When creators you follow go live' },
              ].map(({ id, label, desc }) => (
                <div key={id} className="flex items-center justify-between py-4 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-white text-sm font-medium">{label}</p>
                    <p className="text-white/40 text-xs mt-0.5">{desc}</p>
                  </div>
                  <div className="w-11 h-6 bg-brand-500 rounded-full cursor-pointer relative">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Security ── */}
          {activeTab === 'security' && (
            <div className="glass-card p-6">
              <h2 className="text-white font-semibold text-lg mb-6">Security</h2>
              <div className="space-y-4">
                <div className="bg-dark-700/50 border border-white/5 rounded-xl p-4">
                  <p className="text-white text-sm font-medium">Email</p>
                  <p className="text-white/50 text-sm mt-0.5">{user?.email}</p>
                </div>
                <div className="bg-dark-700/50 border border-white/5 rounded-xl p-4">
                  <p className="text-white text-sm font-medium">Password</p>
                  <p className="text-white/40 text-xs mt-1">Password change coming soon</p>
                </div>
                <div className="bg-dark-700/50 border border-white/5 rounded-xl p-4">
                  <p className="text-white text-sm font-medium">Account Created</p>
                  <p className="text-white/50 text-sm mt-0.5">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── App ── */}
          {activeTab === 'app' && (
            <div className="glass-card p-6 space-y-6">
              <h2 className="text-white font-semibold text-lg">App Settings</h2>

              <div>
                <p className="text-white/60 text-xs uppercase tracking-widest mb-3">Installation</p>
                <div className="bg-dark-700/50 rounded-xl p-4 mb-3">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shrink-0">
                      <FiDownload className="text-white" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">LyvStreem App</p>
                      <p className="text-white/40 text-xs">{isInstalled ? '✅ Installed' : 'Add to home screen'}</p>
                    </div>
                  </div>
                  <PWAInstallButton />
                </div>
              </div>

              <div>
                <p className="text-white/60 text-xs uppercase tracking-widest mb-3">Connection</p>
                <div className={`flex items-center gap-3 rounded-xl p-4 ${isOnline ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                  <FiWifi className={isOnline ? 'text-green-400' : 'text-red-400'} />
                  <div>
                    <p className={`text-sm font-medium ${isOnline ? 'text-green-400' : 'text-red-400'}`}>{isOnline ? 'Online' : 'Offline'}</p>
                    <p className="text-white/40 text-xs">{isOnline ? 'Connected to LyvStreem servers' : 'Some features unavailable'}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-white/60 text-xs uppercase tracking-widest mb-3">Notifications</p>
                <div className="bg-dark-700/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-white text-sm font-medium">Push Notifications</p>
                      <p className="text-white/40 text-xs">
                        {notifPermission === 'granted' ? '✅ Enabled' : notifPermission === 'denied' ? '❌ Blocked' : 'Not enabled'}
                      </p>
                    </div>
                    {notifPermission !== 'granted' && notifPermission !== 'denied' && (
                      <button onClick={requestNotifications} className="btn-primary text-xs py-1.5 px-3">Enable</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Danger Zone ── */}
          {activeTab === 'danger' && (
            <div className="glass-card p-6 border border-red-500/20">
              <h2 className="text-white font-semibold text-lg mb-2 flex items-center gap-2 text-red-400">
                <FiAlertTriangle /> Danger Zone
              </h2>
              <p className="text-white/50 text-sm mb-6">These actions are permanent and cannot be undone.</p>

              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
                <h3 className="text-red-400 font-semibold mb-1">Delete Account</h3>
                <p className="text-white/50 text-xs mb-4">
                  Permanently deletes your account, all streams, messages and earnings data. This cannot be reversed.
                </p>

                {!showDeleteConfirm ? (
                  <button onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all">
                    <FiTrash2 /> Delete My Account
                  </button>
                ) : (
                  <AnimatePresence>
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                      <div>
                        <label className="text-white/60 text-xs mb-1.5 block">Enter your password</label>
                        <input type="password" value={deletePassword}
                          onChange={e => setDeletePassword(e.target.value)}
                          placeholder="Your current password"
                          className="w-full bg-dark-700 border border-red-500/30 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-red-500" />
                      </div>
                      <div>
                        <label className="text-white/60 text-xs mb-1.5 block">Type <span className="text-red-400 font-bold">DELETE</span> to confirm</label>
                        <input type="text" value={deleteConfirmText}
                          onChange={e => setDeleteConfirmText(e.target.value)}
                          placeholder="DELETE"
                          className="w-full bg-dark-700 border border-red-500/30 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-red-500" />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteConfirmText(''); }}
                          className="flex-1 btn-ghost text-sm py-2.5">Cancel</button>
                        <button onClick={handleDeleteAccount}
                          disabled={deleting || deleteConfirmText !== 'DELETE' || !deletePassword}
                          className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold text-sm py-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                          {deleting
                            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : <><FiTrash2 /> Delete Forever</>}
                        </button>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
