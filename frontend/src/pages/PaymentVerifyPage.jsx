import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { FiCheck, FiX } from 'react-icons/fi';

export default function PaymentVerifyPage() {
  const [searchParams] = useSearchParams();
  const { updateUser } = useAuth();
  const [status, setStatus] = useState('verifying');
  const [result, setResult] = useState(null);

  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    if (!reference) { setStatus('error'); return; }

    api.post('/payments/verify', { reference })
      .then(res => {
        updateUser({ coins: res.data.totalCoins });
        setResult(res.data);
        setStatus('success');
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="glass-card p-8 text-center max-w-sm w-full">
        {status === 'verifying' && (
          <>
            <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-white font-display font-bold text-xl">Verifying Payment...</h2>
            <p className="text-white/50 text-sm mt-2">Please wait</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiCheck className="text-green-400 text-2xl" />
            </div>
            <h2 className="text-white font-display font-bold text-xl">Payment Successful!</h2>
            <p className="text-yellow-400 text-3xl font-bold mt-2">+{result?.coinsAdded?.toLocaleString()} 🪙</p>
            <p className="text-white/50 text-sm mt-1">Coins added to your account</p>
            <p className="text-white/40 text-sm mt-1">Balance: {result?.totalCoins?.toLocaleString()} coins</p>
            <Link to="/coins" className="btn-primary mt-6 inline-block">Back to Coins</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiX className="text-red-400 text-2xl" />
            </div>
            <h2 className="text-white font-display font-bold text-xl">Verification Failed</h2>
            <p className="text-white/50 text-sm mt-2">Payment could not be verified. If you were charged, please contact support.</p>
            <Link to="/coins" className="btn-primary mt-6 inline-block">Try Again</Link>
          </>
        )}
      </div>
    </div>
  );
}
