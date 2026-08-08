import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Mail, User, FileText, LogOut, Activity, Sparkles, Shield, Award } from 'lucide-react';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8" data-testid="profile-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E50914]/10 border border-[#E50914]/30 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#E50914]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-200">Candidate Identity</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white" style={{ fontFamily: 'Outfit' }}>
            Account Profile
          </h1>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <div className="netflix-card rounded-3xl p-8">
            <div className="flex items-center gap-5">
              {user?.picture ? (
                <img src={user.picture} alt="" className="w-20 h-20 rounded-2xl ring-2 ring-[#E50914]/50 object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#E50914] to-[#800A0F] text-white flex items-center justify-center text-2xl font-bold shadow-[0_0_20px_rgba(229,9,20,0.4)]">
                  {user?.name?.charAt(0) || '?'}
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Outfit' }}>{user?.name || 'User'}</h2>
                <p className="text-sm text-gray-400">{user?.email || ''}</p>
                <span className="inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full bg-[#E50914]/10 text-[#E50914] border border-[#E50914]/30 uppercase tracking-wider">
                  {user?.planKey?.replace('_', ' ') || 'Free Plan'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="netflix-card rounded-2xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#E50914]" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Verified Email Address</p>
                <p className="text-sm font-semibold text-white">{user?.email}</p>
              </div>
            </div>

            <div className="netflix-card rounded-2xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#E50914]" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Active Resume Document</p>
                <p className="text-sm font-semibold text-white">{user?.resumeFilename || 'No PDF resume uploaded yet'}</p>
              </div>
            </div>

            <div className="netflix-card rounded-2xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center">
                <User className="w-5 h-5 text-[#E50914]" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Member Since</p>
                <p className="text-sm font-semibold text-white">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <button
            data-testid="profile-logout-btn"
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 font-bold text-xs transition-all"
          >
            <LogOut className="w-4 h-4" /> Sign Out of Kevin AI
          </button>
        </div>

        <div className="space-y-6">
          <div className="netflix-card rounded-3xl p-8 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center">
                <Activity className="w-6 h-6 text-[#E50914]" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Activity Overview</p>
                <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Outfit' }}>
                  Mock Practice Journey
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10">
                <p className="text-gray-400 text-xs font-medium">Interviews Attempted</p>
                <p className="text-2xl font-extrabold text-white mt-1" style={{ fontFamily: 'Outfit' }}>{user?.usageCount || 0}</p>
              </div>
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10">
                <p className="text-gray-400 text-xs font-medium">Resume Status</p>
                <p className={`text-base font-bold mt-2 ${user?.resumeFilename ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {user?.resumeFilename ? 'Parsed & Ready' : 'Upload Required'}
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#E50914]/10 border border-[#E50914]/20 text-xs text-gray-300 leading-relaxed space-y-2">
              <p className="font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#E50914]" /> Interview Readiness Tip
              </p>
              <p className="text-gray-400">
                Regular mock practice improves problem articulation, communication clarity, and confidence. Keep updating your resume as you gain new technical experience!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
