import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Mail, User, FileText, LogOut, Activity } from 'lucide-react';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="p-8 max-w-5xl mx-auto" data-testid="profile-page">
      <h1 className="text-3xl font-light tracking-tighter mb-8" style={{ fontFamily: 'Outfit' }}>Profile</h1>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-8 mb-6">
            <div className="flex items-center gap-5">
              {user?.picture ? (
                <img src={user.picture} alt="" className="w-16 h-16 rounded-full" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-xl font-medium">
                  {user?.name?.charAt(0) || '?'}
                </div>
              )}
              <div>
                <h2 className="text-xl font-medium" style={{ fontFamily: 'Outfit' }}>{user?.name || 'User'}</h2>
                <p className="text-sm text-gray-500">{user?.email || ''}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-8">
            <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center"><Mail className="w-4 h-4 text-gray-400" /></div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Email</p>
                <p className="text-sm">{user?.email}</p>
              </div>
            </div>
            <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center"><FileText className="w-4 h-4 text-gray-400" /></div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Resume</p>
                <p className="text-sm">{user?.resumeFilename || 'No resume uploaded'}</p>
              </div>
            </div>
            <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center"><User className="w-4 h-4 text-gray-400" /></div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Member Since</p>
                <p className="text-sm">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A'}</p>
              </div>
            </div>
          </div>

          <button
            data-testid="profile-logout-btn"
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-[#0A0A0A] border border-white/5 rounded-[28px] p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Interview Activity</p>
                <h2 className="text-xl font-medium" style={{ fontFamily: 'Outfit' }}>
                  Keep practicing
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Interviews Taken</p>
                <p>{user?.usageCount || 0}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Resume Status</p>
                <p>{user?.resumeFilename ? 'Ready' : 'Upload needed'}</p>
              </div>
            </div>

            <p className="mt-6 text-sm text-gray-400 leading-6">
              Kevin is now running without subscriptions or credit limits. Upload a strong resume, practice often,
              and use the reports to improve your project storytelling, technical depth, and communication.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
