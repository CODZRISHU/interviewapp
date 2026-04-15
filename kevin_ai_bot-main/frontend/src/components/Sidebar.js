import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, BarChart3, User, LogOut } from 'lucide-react';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const links = [
    { to: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" />, label: 'Dashboard' },
    { to: '/reports', icon: <BarChart3 className="w-4 h-4" />, label: 'Reports' },
    { to: '/profile', icon: <User className="w-4 h-4" />, label: 'Profile' },
  ];

  return (
    <aside className="h-full w-64 bg-[#050505] border-r border-white/5 flex flex-col shrink-0" data-testid="sidebar">
      {/* Logo */}
      <div className="h-16 flex items-center gap-2.5 px-6 border-b border-white/5">
        <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center">
          <span className="text-black font-bold text-xs" style={{ fontFamily: 'Outfit' }}>K</span>
        </div>
        <span className="text-sm font-semibold tracking-tight" style={{ fontFamily: 'Outfit' }}>Kevin</span>
      </div>

      {/* User */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-3 px-2">
          {user?.picture ? (
            <img src={user.picture} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium">
              {user?.name?.charAt(0) || '?'}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email || ''}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            data-testid={`nav-${link.label.toLowerCase()}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`
            }
          >
            {link.icon}
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/5">
        <button
          data-testid="logout-button"
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-white hover:bg-white/5 transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
