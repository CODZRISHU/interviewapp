import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#050505] overflow-hidden" data-testid="dashboard-layout">
      {/* Top Mobile Header */}
      <div className="h-16 px-4 bg-[#08080A] border-b border-white/10 flex items-center justify-between shrink-0 md:hidden z-30">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <div className="w-8 h-8 bg-gradient-to-tr from-[#B20710] via-[#E50914] to-[#FF1E27] rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(229,9,20,0.5)]">
            <span className="text-white font-extrabold text-sm" style={{ fontFamily: 'Outfit' }}>K</span>
          </div>
          <span className="text-base font-bold tracking-tight text-white" style={{ fontFamily: 'Outfit' }}>
            Kevin <span className="text-[#E50914]">AI</span>
          </span>
        </div>

        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar (Drawer on mobile, Static on desktop) */}
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
