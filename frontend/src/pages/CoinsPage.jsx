import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { FiCheck, FiZap } from 'react-icons/fi';

const COIN_PACKAGES = [
  { id: 'starter', coins: 100, amount: 500, label: 'Starter', bonus: 0, popular: false, emoji: '🪙' },
  { id: 'basic', coins: 250, amount: 1000, label: 'Basic', bonus: 20, popular: false, emoji: '💰' },
  { id: 'popular', coins: 500, amount: 2000, label: 'Popular', bonus: 80, popular: true, emoji: '🔥' },
  { id: 'value', coins: 1000, amount: 4000, label: 'Value', bonus: 200, popular: false, emoji: '💎' },
  { id: 'premium', coins: 2500, amount: 10000, label: 'Premium', bonus: 700, popular: false, emoji: '👑' },
  { id: 'elite', coins: 5000, amount: 20000, label: 'Elite', bonus: 2000, popular: false, emoji: '🌟' },
];

const RARITY_GIFTS = [
  { name: 'Rose', emoji: '🌹', coins: 5 },
  { name: 'Crown', emoji: '👑', coins: 199 },
  { name: 'Diamond', emoji: '💎', coins: 1000 },
  { name: 'Dragon', emoji: '🐉', coins: 2999 },
  { name: 'Universe', emoji: '🌍', coins: 50000 },
];

export default function CoinsPage() {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api.get('/payments/history').then(res => setHistory(res.data)).catch(() => {});
  }, []);

  const handlePurchase = async (pkg) => {
    setLoading(pkg.id);
    try {
      const res = await api.post('/payments/initialize', { packageId: pkg.id });
      const { authorization_url } = res.data;
      // Open Paystack popup
      if (window.PaystackPop) {
        const handler = window.PaystackPop.setup({
          key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
          email: user.email,
          amount: pkg.amount * 100, // convert to kobo
          currency: 'NGN',
          ref: res.data.reference,
          onSuccess: async (transaction) => {
            try {
              const verifyRes = await api.post('/payments/verify', { reference: transaction.reference });
              updateUser({ coins: verifyRes.data.totalCoins });
              toast.success(`🎉 ${verifyRes.data.coinsAdded} coins added to your account!`);
            } catch {
              toast.error('Verification failed, please contact support');
            }
          },
          onCancel: () => toast('Payment cancelled'),
        });
        handler.openIframe();
      } else {
        // Fallback: redirect to Paystack
        window.open(authorization_url, '_blank');
        toast('Complete payment in the new tab, then refresh your coins balance.');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to initialize payment');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Balance card */}
      <div className="relative rounded-2xl overflow-hidden mb-8 bg-gradient-to-br from-yellow-900/40 via-dark-800 to-dark-700 border border-yellow-500/20 p-6 md:p-8">
        <div className="relative z-10">
          <p className="text-white/60 text-sm mb-1">Your Balance</p>
          <div className="flex items-end gap-3">
            <span className="text-5xl md:text-6xl font-display font-bold text-white">{(user?.coins || 0).toLocaleString()}</span>
            <span className="text-yellow-400 text-2xl mb-1">🪙</span>
          </div>
          <p className="text-white/40 text-sm mt-2">Use coins to send gifts to your favourite streamers</p>
        </div>
        <div className="absolute top-4 right-4 text-6xl opacity-20">🪙</div>
        <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl" />
      </div>

      {/* What you can buy section */}
      <div className="mb-8">
        <h3 className="text-white/60 text-xs uppercase tracking-widest mb-3">Popular Gifts</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {RARITY_GIFTS.map(g => (
            <div key={g.name} className="shrink-0 flex flex-col items-center gap-1 bg-dark-800 rounded-xl px-4 py-3 border border-white/5">
              <span className="text-3xl">{g.emoji}</span>
              <span className="text-white text-xs font-medium">{g.name}</span>
              <span className="text-yellow-400 text-xs">🪙 {g.coins.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Coin packages */}
      <h2 className="text-xl font-display font-bold text-white mb-4">Buy Coins</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {COIN_PACKAGES.map(pkg => (
          <div key={pkg.id} className={`relative rounded-2xl border p-5 flex flex-col gap-3 transition-all hover:scale-[1.02] ${
            pkg.popular
              ? 'border-brand-500/50 bg-brand-900/20 shadow-lg shadow-brand-500/20'
              : 'border-white/10 bg-dark-800/50'
          }`}>
            {pkg.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-xs font-bold px-3 py-0.5 rounded-full flex items-center gap-1">
                <FiZap className="text-[10px]" /> Most Popular
              </div>
            )}
            <div className="text-center">
              <span className="text-3xl">{pkg.emoji}</span>
              <p className="text-white font-bold font-display text-lg mt-1">{pkg.label}</p>
              <div className="mt-2">
                <span className="text-white/80 text-2xl font-bold">{pkg.coins.toLocaleString()}</span>
                <span className="text-yellow-400 ml-1">🪙</span>
              </div>
              {pkg.bonus > 0 && (
                <p className="text-green-400 text-xs mt-1 font-medium">+{pkg.bonus} bonus coins!</p>
              )}
            </div>
            <div className="text-center">
              <p className="text-white/40 text-xs mb-2">₦{pkg.amount.toLocaleString()}</p>
              <button
                onClick={() => handlePurchase(pkg)}
                disabled={loading === pkg.id}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  pkg.popular
                    ? 'btn-primary'
                    : 'bg-dark-700 text-white hover:bg-dark-600 border border-white/10'
                }`}>
                {loading === pkg.id
                  ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : 'Buy Now'
                }
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Transaction history */}
      <div>
        <h3 className="text-white font-semibold mb-4">Transaction History</h3>
        {history.length === 0 ? (
          <div className="text-center py-10 text-white/30">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm">No transactions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map(tx => (
              <div key={tx._id} className="flex items-center justify-between glass-card px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.status === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {tx.status === 'success' ? <FiCheck /> : '✕'}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">+{tx.coins.toLocaleString()} coins</p>
                    <p className="text-white/40 text-xs">{new Date(tx.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white/80 text-sm">₦{(tx.amount / 100).toLocaleString()}</p>
                  <p className={`text-xs capitalize ${tx.status === 'success' ? 'text-green-400' : 'text-yellow-400'}`}>{tx.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
