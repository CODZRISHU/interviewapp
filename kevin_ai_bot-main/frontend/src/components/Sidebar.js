import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, BarChart3, User, LogOut, CreditCard, Receipt, Sparkles, X, MessageSquare, ShieldCheck } from 'lucide-react';

export default function Sidebar({ mobileOpen = false, onClose = () => {} }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    onClose();
    await logout();
    navigate('/', { replace: true });
  };

  const links = [
    { to: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" />, label: 'Dashboard' },
    { to: '/subscription', icon: <CreditCard className="w-4 h-4" />, label: 'Subscription' },
    { to: '/payments', icon: <Receipt className="w-4 h-4" />, label: 'Payments' },
    { to: '/reports', icon: <BarChart3 className="w-4 h-4" />, label: 'Reports' },
    { to: '/profile', icon: <User className="w-4 h-4" />, label: 'Profile' },
    { to: '/contact', icon: <MessageSquare className="w-4 h-4 text-[#E50914]" />, label: 'Raise a Request' },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 h-full w-64 bg-[#08080A] border-r border-white/10 flex flex-col shrink-0 select-none shadow-[10px_0_30px_rgba(0,0,0,0.5)] z-50 transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        data-testid="sidebar"
      >
        {/* Brand Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-white/10">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { onClose(); navigate('/dashboard'); }}>
            <div className="w-9 h-9 bg-gradient-to-tr from-[#B20710] via-[#E50914] to-[#FF1E27] rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(229,9,20,0.5)]">
              <span className="text-white font-extrabold text-base" style={{ fontFamily: 'Outfit' }}>K</span>
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-white leading-none" style={{ fontFamily: 'Outfit' }}>
                Kevin <span className="text-[#E50914]">AI</span>
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-semibold mt-1">Interviewer</span>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={onClose}
            className="md:hidden p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="px-4 py-5 border-b border-white/5">
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.03] border border-white/5">
            {user?.picture ? (
              <img src={user.picture} alt="" className="w-9 h-9 rounded-full ring-2 ring-[#E50914]/50 object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#E50914] to-[#800A0F] text-white flex items-center justify-center font-bold text-sm shadow-[0_0_10px_rgba(229,9,20,0.3)]">
                {user?.name?.charAt(0) || '?'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate" style={{ fontFamily: 'Outfit' }}>{user?.name || 'User'}</p>
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 capitalize">
                <Sparkles className="w-2.5 h-2.5 text-[#E50914]" />
                {user?.planKey?.replace('_', ' ') || 'Free Plan'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onClose}
              data-testid={`nav-${link.label.toLowerCase()}`}
              className={({ isActive }) =>
                `group relative flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#E50914]/20 to-transparent text-white border-l-4 border-[#E50914] shadow-[0_0_20px_rgba(229,9,20,0.15)]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`transition-colors ${isActive ? 'text-[#E50914]' : 'text-gray-400 group-hover:text-white'}`}>
                    {link.icon}
                  </span>
                  <span style={{ fontFamily: 'Outfit' }}>{link.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Logout Footer */}
        <div className="p-4 border-t border-white/10">
          <button
            data-testid="logout-button"
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all w-full"
          >
            <LogOut className="w-4 h-4" />
            <span style={{ fontFamily: 'Outfit' }}>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
