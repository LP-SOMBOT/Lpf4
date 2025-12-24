import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card } from './UI';

interface NavbarProps {
    orientation?: 'horizontal' | 'vertical';
}

export const Navbar: React.FC<NavbarProps> = ({ orientation = 'horizontal' }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: 'fa-home', label: 'Home' },
    { path: '/lobby', icon: 'fa-gamepad', label: 'Battle' },
    { path: '/leaderboard', icon: 'fa-trophy', label: 'Rank' },
    { path: '/profile', icon: 'fa-user', label: 'Me' },
  ];

  if (orientation === 'vertical') {
      return (
        <div className="h-full flex flex-col justify-between py-6 p-4">
            <div className="flex flex-col gap-2">
                <div className="px-4 mb-8 flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-game-primary to-purple-600 shadow-lg flex items-center justify-center transform group-hover:rotate-12 transition-transform">
                         <img src="https://files.catbox.moe/qn40s6.png" alt="Logo" className="w-6 h-6 filter brightness-200" />
                    </div>
                    <span className="font-black text-2xl tracking-tighter hidden lg:block text-slate-800 dark:text-white">LP-F4</span>
                </div>
                
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-2 shadow-xl border-2 border-slate-100 dark:border-slate-700">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <button 
                                key={item.path} 
                                onClick={() => navigate(item.path)}
                                className={`flex items-center gap-4 px-4 py-3 mb-1 w-full rounded-2xl transition-all relative group
                                    ${isActive 
                                        ? 'bg-game-primary text-white shadow-lg shadow-game-primary/30' 
                                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}
                                `}
                            >
                                <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${isActive ? 'bg-white/20' : ''}`}>
                                    <i className={`fas ${item.icon} text-lg`}></i>
                                </div>
                                <span className="text-sm font-bold hidden lg:block">{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
            
            <div className="px-2">
                <button 
                    onClick={() => navigate('/download')}
                    className="w-full flex items-center gap-3 px-4 py-4 bg-slate-900 dark:bg-black text-white rounded-3xl shadow-xl transition-transform hover:-translate-y-1"
                >
                    <i className="fab fa-android text-2xl text-green-400"></i>
                    <div className="text-left hidden lg:block">
                        <div className="text-[10px] uppercase font-bold opacity-60">Download</div>
                        <div className="text-sm font-bold">App v2.5</div>
                    </div>
                </button>
            </div>
        </div>
      );
  }

  // Mobile Horizontal - Floating Dock
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-white dark:bg-slate-800 rounded-full px-2 py-2 flex items-center shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] border-2 border-slate-100 dark:border-slate-700 gap-1">
            {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                <button 
                    key={item.path} 
                    onClick={() => navigate(item.path)}
                    className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300
                        ${isActive ? '-mt-6 bg-game-primary text-white shadow-lg ring-4 ring-slate-100 dark:ring-slate-900 transform scale-110' : 'text-slate-400 hover:text-game-primary'}
                    `}
                >
                    <i className={`fas ${item.icon} text-xl ${isActive ? 'animate-bounce-slow' : ''}`}></i>
                    {isActive && <span className="absolute -bottom-6 text-[10px] font-bold text-game-primary bg-white dark:bg-slate-800 px-2 rounded-full shadow-sm">
                        {item.label}
                    </span>}
                </button>
                );
            })}
        </div>
    </div>
  );
};