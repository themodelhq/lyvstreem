import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { BsCameraVideoFill } from 'react-icons/bs';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '', displayName: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await register(form);
      toast.success('🎉 Welcome to LyvStreem! You got 5 free coins!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-500/30">
            <BsCameraVideoFill className="text-white text-2xl" />
          </div>
          <h1 className="font-display font-bold text-3xl text-white">Join LyvStreem</h1>
          <p className="text-white/50 text-sm mt-1">Create your free account and get 100 coins!</p>
        </div>

        <div className="glass-card p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-white/70 text-sm mb-1.5 block">Display Name</label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input type="text" value={form.displayName}
                  onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
                  placeholder="Your display name"
                  className="w-full bg-dark-700 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-brand-500 transition-colors" />
              </div>
            </div>
            <div>
              <label className="text-white/70 text-sm mb-1.5 block">Username <span className="text-red-400">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">@</span>
                <input type="text" value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                  placeholder="username" required
                  className="w-full bg-dark-700 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-brand-500 transition-colors" />
              </div>
            </div>
            <div>
              <label className="text-white/70 text-sm mb-1.5 block">Email <span className="text-red-400">*</span></label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input type="email" value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="your@email.com" required
                  className="w-full bg-dark-700 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-brand-500 transition-colors" />
              </div>
            </div>
            <div>
              <label className="text-white/70 text-sm mb-1.5 block">Password <span className="text-red-400">*</span></label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Min 6 characters" required
                  className="w-full bg-dark-700 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-white placeholder-white/30 focus:outline-none focus:border-brand-500 transition-colors" />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">
                  {showPass ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-3 flex items-center gap-3">
              <span className="text-2xl">🎁</span>
              <p className="text-white/70 text-sm">Sign up and receive <span className="text-yellow-400 font-semibold">5 free coins</span> to send gifts!</p>
            </div>

            <button type="submit" disabled={loading}
              className="w-full btn-primary py-3 flex items-center justify-center gap-2">
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-white/50 text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">Sign in</Link>
          </p>
        </div>

        <Link to="/" className="block text-center text-white/30 hover:text-white/60 text-sm mt-4 transition-colors">← Back to home</Link>
      </div>
    </div>
  );
}
