import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { FiDollarSign, FiAlertCircle, FiCheckCircle, FiClock, FiCreditCard, FiArrowLeft } from 'react-icons/fi';

const COINS_PER = 210;
const NAIRA_PER = 1300;
const coinsToNaira = (c) => Math.floor((c / COINS_PER) * NAIRA_PER);

const NIGERIAN_BANKS = [
  { name: 'Access Bank', code: '044' },
  { name: 'Citibank Nigeria', code: '023' },
  { name: 'EcoBank Nigeria', code: '050' },
  { name: 'Fidelity Bank', code: '070' },
  { name: 'First Bank of Nigeria', code: '011' },
  { name: 'First City Monument Bank (FCMB)', code: '214' },
  { name: 'Guaranty Trust Bank (GTBank)', code: '058' },
  { name: 'Heritage Bank', code: '030' },
  { name: 'Keystone Bank', code: '082' },
  { name: 'Kuda Microfinance Bank', code: '090267' },
  { name: 'Opay', code: '100004' },
  { name: 'Palmpay', code: '999991' },
  { name: 'Polaris Bank', code: '076' },
  { name: 'Stanbic IBTC Bank', code: '039' },
  { name: 'Standard Chartered Bank', code: '068' },
  { name: 'Sterling Bank', code: '232' },
  { name: 'Union Bank of Nigeria', code: '032' },
  { name: 'United Bank for Africa (UBA)', code: '033' },
  { name: 'Unity Bank', code: '215' },
  { name: 'Wema Bank', code: '035' },
  { name: 'Zenith Bank', code: '057' },
];

const STATUS_COLORS = {
  pending: 'text-yellow-400 bg-yellow-500/10',
  processing: 'text-blue-400 bg-blue-500/10',
  completed: 'text-green-400 bg-green-500/10',
  rejected: 'text-red-400 bg-red-500/10',
};

export default function WithdrawPage() {
  const { user } = useAuth();
  const [eligibility, setEligibility] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState('overview'); // overview | bank | confirm | done
  const [bank, setBank] = useState({ accountName: '', accountNumber: '', bankName: '', bankCode: '' });
  const [coinsToWithdraw, setCoinsToWithdraw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/withdrawals/eligibility'),
      api.get('/withdrawals/history'),
    ]).then(([eRes, hRes]) => {
      setEligibility(eRes.data);
      setHistory(hRes.data);
      if (eRes.data.bankDetails?.accountNumber) {
        setBank(eRes.data.bankDetails);
      }
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const saveBank = async (e) => {
    e.preventDefault();
    if (!bank.accountName || !bank.accountNumber || !bank.bankName) {
      toast.error('All bank fields are required'); return;
    }
    try {
      await api.put('/withdrawals/bank-details', bank);
      toast.success('Bank details saved!');
      setStep('confirm');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save bank details');
    }
  };

  const submitWithdrawal = async () => {
    const coins = parseInt(coinsToWithdraw);
    if (!coins || coins < eligibility.minCoins) {
      toast.error(`Minimum ${eligibility.minCoins.toLocaleString()} coins`); return;
    }
    if (coins > eligibility.coinsEarned) {
      toast.error('Insufficient coins'); return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/withdrawals/request', { coinsToWithdraw: coins });
      setResult(res.data);
      setStep('done');
      const updatedE = await api.get('/withdrawals/eligibility');
      setEligibility(updatedE.data);
      const updatedH = await api.get('/withdrawals/history');
      setHistory(updatedH.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Withdrawal failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const nairaPreview = coinsToWithdraw ? coinsToNaira(parseInt(coinsToWithdraw) || 0) : 0;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/host-dashboard" className="p-2 text-white/50 hover:text-white transition-colors">
          <FiArrowLeft />
        </Link>
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Withdraw Earnings</h1>
          <p className="text-white/40 text-sm">210 coins = ₦1,300</p>
        </div>
      </div>

      {/* Balance card */}
      <div className="rounded-2xl bg-gradient-to-br from-green-900/40 to-dark-800 border border-green-500/20 p-6 mb-6">
        <p className="text-white/50 text-sm mb-1">Available Earning Balance</p>
        <div className="flex items-end gap-3">
          <span className="text-4xl font-display font-bold text-white">{(eligibility?.coinsEarned || 0).toLocaleString()}</span>
          <span className="text-yellow-400 text-xl mb-1">🪙 coins</span>
        </div>
        <p className="text-green-400 font-semibold text-lg mt-1">≈ ₦{(eligibility?.nairaValue || 0).toLocaleString()}</p>
        <div className="flex flex-wrap gap-4 mt-4 text-xs text-white/40">
          <span>Total earned: {(eligibility?.totalWithdrawnCoins || 0).toLocaleString()} coins withdrawn</span>
          <span>Withdrawals: {eligibility?.withdrawalCount || 0}</span>
        </div>
      </div>

      {/* Eligibility status */}
      {!eligibility?.canWithdraw && (
        <div className="glass-card p-5 mb-6 border-yellow-500/20">
          <div className="flex items-center gap-2 text-yellow-400 font-semibold mb-3">
            <FiAlertCircle /> Not yet eligible
          </div>
          {eligibility?.reasons?.map((r, i) => (
            <p key={i} className="text-white/60 text-sm py-1.5 border-b border-white/5 last:border-0">{r}</p>
          ))}
        </div>
      )}

      {/* Steps */}
      <AnimatePresence mode="wait">
        {step === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="glass-card p-6 mb-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><FiCreditCard /> Bank Details</h3>
              {eligibility?.bankDetails?.accountNumber ? (
                <div className="space-y-2 mb-4">
                  {[
                    ['Account Name', eligibility.bankDetails.accountName],
                    ['Account Number', eligibility.bankDetails.accountNumber],
                    ['Bank', eligibility.bankDetails.bankName],
                  ].map(([l, v]) => (
                    <div key={l} className="flex justify-between text-sm">
                      <span className="text-white/40">{l}</span>
                      <span className="text-white font-medium">{v}</span>
                    </div>
                  ))}
                  <button onClick={() => setStep('bank')} className="text-brand-400 text-sm hover:text-brand-300 mt-2">
                    Edit bank details →
                  </button>
                </div>
              ) : (
                <p className="text-white/40 text-sm mb-3">No bank details saved yet.</p>
              )}
              {eligibility?.canWithdraw && (
                <button onClick={() => eligibility.bankDetails?.accountNumber ? setStep('confirm') : setStep('bank')}
                  className="btn-primary w-full py-3 mt-2 flex items-center justify-center gap-2">
                  <FiDollarSign /> Proceed to Withdraw
                </button>
              )}
              {!eligibility?.bankDetails?.accountNumber && (
                <button onClick={() => setStep('bank')} className="btn-ghost w-full py-3 mt-2">
                  Add Bank Details
                </button>
              )}
            </div>
          </motion.div>
        )}

        {step === 'bank' && (
          <motion.div key="bank" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="glass-card p-6 mb-6">
              <h3 className="text-white font-semibold mb-5">Bank Account Details</h3>
              <form onSubmit={saveBank} className="space-y-4">
                <div>
                  <label className="text-white/60 text-sm mb-1.5 block">Bank Name</label>
                  <select value={bank.bankName}
                    onChange={e => {
                      const b = NIGERIAN_BANKS.find(b => b.name === e.target.value);
                      setBank(p => ({ ...p, bankName: e.target.value, bankCode: b?.code || '' }));
                    }}
                    className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-colors appearance-none" required>
                    <option value="">Select your bank</option>
                    {NIGERIAN_BANKS.map(b => <option key={b.code} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/60 text-sm mb-1.5 block">Account Number (10 digits)</label>
                  <input type="text" value={bank.accountNumber} maxLength={10}
                    onChange={e => setBank(p => ({ ...p, accountNumber: e.target.value.replace(/\D/g, '') }))}
                    placeholder="0123456789" required
                    className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-brand-500 transition-colors" />
                </div>
                <div>
                  <label className="text-white/60 text-sm mb-1.5 block">Account Name</label>
                  <input type="text" value={bank.accountName}
                    onChange={e => setBank(p => ({ ...p, accountName: e.target.value }))}
                    placeholder="As it appears on your account" required
                    className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-brand-500 transition-colors" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setStep('overview')} className="btn-ghost flex-1 py-3">Back</button>
                  <button type="submit" className="btn-primary flex-1 py-3">Save & Continue</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}

        {step === 'confirm' && (
          <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="glass-card p-6 mb-6">
              <h3 className="text-white font-semibold mb-5">Confirm Withdrawal</h3>
              <div className="mb-5">
                <label className="text-white/60 text-sm mb-1.5 block">
                  Coins to Withdraw (min: {(eligibility?.minCoins || 0).toLocaleString()})
                </label>
                <input type="number" value={coinsToWithdraw}
                  onChange={e => setCoinsToWithdraw(e.target.value)}
                  placeholder={`${eligibility?.minCoins || 2500}`}
                  min={eligibility?.minCoins} max={eligibility?.coinsEarned}
                  className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-brand-500 transition-colors text-xl font-bold" />
                {coinsToWithdraw && (
                  <p className="text-green-400 font-semibold text-lg mt-2">
                    ≈ ₦{nairaPreview.toLocaleString()}
                  </p>
                )}
              </div>

              <div className="bg-dark-700/50 rounded-xl p-4 space-y-2 mb-5 text-sm">
                <div className="flex justify-between"><span className="text-white/40">To Account</span><span className="text-white font-medium">{bank.accountName}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Account Number</span><span className="text-white">{bank.accountNumber}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Bank</span><span className="text-white">{bank.bankName}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Processing</span><span className="text-white">1–3 business days</span></div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-yellow-400 text-xs mb-5">
                ⚠️ Once submitted, withdrawal requests cannot be reversed. Ensure your bank details are correct.
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep('overview')} className="btn-ghost flex-1 py-3">Back</button>
                <button onClick={submitWithdrawal} disabled={submitting || !coinsToWithdraw}
                  className="btn-primary flex-1 py-3 flex items-center justify-center gap-2">
                  {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><FiDollarSign /> Submit Request</>}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'done' && (
          <motion.div key="done" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <div className="glass-card p-8 text-center mb-6">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiCheckCircle className="text-green-400 text-3xl" />
              </div>
              <h2 className="text-white font-display font-bold text-2xl mb-2">Request Submitted!</h2>
              <p className="text-white/60 text-sm mb-4">Your withdrawal is being processed</p>
              <div className="bg-dark-700/50 rounded-xl p-4 text-left space-y-2 text-sm mb-6">
                <div className="flex justify-between"><span className="text-white/40">Coins</span><span className="text-white">{result?.withdrawal?.coinsRequested?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Amount</span><span className="text-green-400 font-bold">₦{result?.withdrawal?.nairaAmount?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Status</span><span className="text-yellow-400">Pending</span></div>
              </div>
              <button onClick={() => setStep('overview')} className="btn-primary px-8 py-3">Done</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History */}
      {history.length > 0 && step === 'overview' && (
        <div className="glass-card p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><FiClock /> Withdrawal History</h3>
          <div className="space-y-3">
            {history.map(w => (
              <div key={w._id} className="flex items-center justify-between bg-dark-700/40 rounded-xl px-4 py-3">
                <div>
                  <p className="text-white text-sm font-medium">{w.coinsRequested.toLocaleString()} coins</p>
                  <p className="text-white/40 text-xs">{new Date(w.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-semibold text-sm">₦{w.nairaAmount.toLocaleString()}</p>
                  <span className={`text-xs capitalize px-2 py-0.5 rounded-full ${STATUS_COLORS[w.status] || 'text-white/40'}`}>
                    {w.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
