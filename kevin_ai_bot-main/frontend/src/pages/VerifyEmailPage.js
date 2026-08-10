import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { CheckCircle2, ShieldAlert, Sparkles, Loader2, ArrowRight } from 'lucide-react';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { login } = useAuth();

  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const verifyToken = React.useCallback(async (tok) => {
    try {
      setLoading(true);
      const res = await api.get(`/auth/verify-email?token=${encodeURIComponent(tok)}`);
      setIsSuccess(true);
      setStatusMsg(res.data?.message || 'Gmail address verified! Logging you in automatically...');
      
      if (res.data?.tokens && res.data?.user) {
        login(res.data);
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 1500);
      }
    } catch (err) {
      setIsSuccess(false);
      setStatusMsg(err.response?.data?.detail || 'Invalid or expired verification link.');
    } finally {
      setLoading(false);
    }
  }, [login, navigate]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setIsSuccess(false);
      setStatusMsg('No verification token provided in the URL link.');
      return;
    }

    verifyToken(token);
  }, [token, verifyToken]);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6 selection:bg-[#E50914] selection:text-white" data-testid="verify-email-page">
      <div className="netflix-card max-w-md w-full rounded-3xl p-8 text-center border border-white/10 shadow-[0_0_50px_rgba(229,9,20,0.2)] space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#E50914]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-[#B20710] via-[#E50914] to-[#FF1E27] rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(229,9,20,0.5)]">
            <span className="text-white font-extrabold text-base" style={{ fontFamily: 'Outfit' }}>K</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-white" style={{ fontFamily: 'Outfit' }}>
            Kevin <span className="text-[#E50914]">AI</span>
          </span>
        </div>

        {loading ? (
          <div className="py-10 space-y-4">
            <Loader2 className="w-10 h-10 text-[#E50914] animate-spin mx-auto" />
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Outfit' }}>Verifying Gmail Activation...</h2>
            <p className="text-xs text-gray-400">Validating your email token with Kevin AI authentication servers.</p>
          </div>
        ) : isSuccess ? (
          <div className="py-6 space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-extrabold text-white" style={{ fontFamily: 'Outfit' }}>Gmail Verified!</h2>
            <p className="text-xs text-gray-300 leading-relaxed px-4">{statusMsg}</p>
            <button
              data-testid="go-to-dashboard-btn"
              onClick={() => navigate('/dashboard')}
              className="netflix-btn-red w-full py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg"
            >
              Redirecting to Candidate Portal... <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="py-6 space-y-5">
            <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(239,68,68,0.3)]">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-extrabold text-white" style={{ fontFamily: 'Outfit' }}>Verification Failed</h2>
            <p className="text-xs text-gray-300 leading-relaxed px-4">{statusMsg}</p>
            <button
              onClick={() => navigate('/auth')}
              className="w-full py-3.5 rounded-2xl font-bold text-xs bg-white/10 hover:bg-white/15 text-white transition border border-white/10"
            >
              Return to Sign In Page
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
