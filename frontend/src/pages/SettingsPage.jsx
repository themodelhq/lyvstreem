import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { FiUser, FiCamera, FiLock, FiBell, FiLogOut, FiDownload, FiSmartphone, FiWifi } from 'react-icons/fi';
import { PWAInstallButton } from '../components/PWAInstallBanner';
import usePWA from '../hooks/usePWA';

const TABS = [
  { id: 'profile', label: 'Profile', icon: FiUser },
  { id: 'notifications', label: 'Notifications', icon: FiBell },
  { id: 'security', label: 'Security', icon: FiLock },
  { id: 'app', label: 'App', icon: FiSmartphone },
];

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuth();
  const { isInstalled, isOnline, notifPermission, requestNotifications } = usePWA();
  const [activeTab, setActiveTab] = useState('profile');
  const [form, setForm] = useState({ displayName: user?.displayName || '', bio: user?.bio || '', avatar: user?.avatar || '' });
  const [saving, setSaving] = useState(false);

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

  const AVATAR_OPTIONS = [
    'https://api.dicebear.com/7.x/adventurer/svg?seed=lyvstreem1',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=lyvstreem2',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=lyvstreem3',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=lyvstreem4',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=lyvstreem5',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=lyvstreem6',
  ];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-display font-bold text-white mb-6">Settings</h1>

      <div className="grid md:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <nav className="space-y-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                  activeTab === id ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}>
                <Icon /> {label}
              </button>
            ))}
            <button onClick={() => { logout(); }} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-all">
              <FiLogOut /> Sign Out
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="md:col-span-3">
          {activeTab === 'profile' && (
            <div className="glass-card p-6">
              <h2 className="text-white font-semibold text-lg mb-6">Edit Profile</h2>

              {/* Avatar picker */}
              <div className="mb-6">
                <p className="text-white/60 text-sm mb-3">Choose Avatar</p>
                <div className="flex gap-3 flex-wrap">
                  {AVATAR_OPTIONS.map((url, i) => (
                    <button key={i} onClick={() => setForm(p => ({ ...p, avatar: url }))}
                      className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-all ${form.avatar === url ? 'border-brand-500 scale-110' : 'border-transparent hover:border-white/30'}`}>
                      <img src={url} alt="" className="w-full h-full object-cover bg-dark-700" />
                    </button>
                  ))}
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-dark-700 border border-white/10 text-white/40 text-xs text-center cursor-not-allowed" title="Custom upload coming soon">
                    <FiCamera />
                  </div>
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
                <button type="submit" disabled={saving} className="btn-primary py-2.5 flex items-center gap-2">
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Save Changes'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="glass-card p-6">
              <h2 className="text-white font-semibold text-lg mb-6">Notification Settings</h2>
              {[
                { id: 'newFollower', label: 'New Follower', desc: 'When someone follows you' },
                { id: 'giftReceived', label: 'Gift Received', desc: 'When someone sends you a gift' },
                { id: 'streamStart', label: 'Stream Alerts', desc: 'When creators you follow go live' },
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
                  <p className="text-white/40 text-xs mt-1">Password change via email is coming soon</p>
                </div>
                <div className="bg-dark-700/50 border border-white/5 rounded-xl p-4">
                  <p className="text-white text-sm font-medium">Account Created</p>
                  <p className="text-white/50 text-sm mt-0.5">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'app' && (
            <div className="glass-card p-6 space-y-6">
              <h2 className="text-white font-semibold text-lg">App Settings</h2>

              {/* Install section */}
              <div>
                <p className="text-white/60 text-xs uppercase tracking-widest mb-3">Installation</p>
                <div className="bg-dark-700/50 rounded-xl p-4 mb-3">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shrink-0">
                      <FiDownload className="text-white" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">LyvStreem App</p>
                      <p className="text-white/40 text-xs">{isInstalled ? '✅ Installed on your device' : 'Install for the best experience'}</p>
                    </div>
                  </div>
                  <PWAInstallButton />
                </div>
              </div>

              {/* Connection */}
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

              {/* Notifications */}
              <div>
                <p className="text-white/60 text-xs uppercase tracking-widest mb-3">Notifications</p>
                <div className="bg-dark-700/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-white text-sm font-medium">Push Notifications</p>
                      <p className="text-white/40 text-xs">
                        {notifPermission === 'granted' ? '✅ Enabled' : notifPermission === 'denied' ? '❌ Blocked in browser settings' : 'Not enabled yet'}
                      </p>
                    </div>
                    {notifPermission !== 'granted' && notifPermission !== 'denied' && (
                      <button onClick={requestNotifications} className="btn-primary text-xs py-1.5 px-3">Enable</button>
                    )}
                  </div>
                  {notifPermission === 'denied' && (
                    <p className="text-yellow-400/80 text-xs bg-yellow-500/10 rounded-lg p-2">
                      To enable: open your browser settings → Site permissions → Notifications → Allow LyvStreem
                    </p>
                  )}
                </div>
              </div>

              {/* PWA info */}
              <div className="bg-brand-500/5 border border-brand-500/10 rounded-xl p-4">
                <p className="text-brand-400 text-xs font-semibold mb-2">📱 Why install the app?</p>
                <ul className="text-white/50 text-xs space-y-1">
                  <li>• Opens full-screen like a native app</li>
                  <li>• Faster loading with offline caching</li>
                  <li>• Receive push notifications for gifts & streams</li>
                  <li>• Works on Android, iOS, Windows & Mac</li>
                  <li>• Home screen shortcut for instant access</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
