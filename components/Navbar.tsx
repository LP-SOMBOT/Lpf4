import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavbarProps {
    orientation?: 'horizontal' | 'vertical';
}

export const Navbar: React.FC<NavbarProps> = ({ orientation = 'horizontal' }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: 'fa-home', label: 'Home' },
    { path: '/lobby', icon: 'fa-bolt', label: 'Battle' },
    { path: '/leaderboard', icon: 'fa-trophy', label: 'Rank' },
    { path: '/about', icon: 'fa-info-circle', label: 'About' },
    { path: '/profile', icon: 'fa-user', label: 'Me' },
  ];

  if (orientation === 'vertical') {
      return (
        <div className="h-full flex flex-col justify-between py-8">
            <div className="flex flex-col gap-2">
                <div className="px-6 mb-8 flex items-center gap-2">
                    <img src="https://img.icons8.com/fluency/96/mortarboard.png" alt="Logo" className="w-8 h-8" />
                    <span className="font-extrabold text-xl tracking-tight hidden lg:block text-somali-blue dark:text-blue-400">LP-F4</span>
                </div>
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <button 
                            key={item.path} 
                            onClick={() => navigate(item.path)}
                            className={`flex items-center gap-4 px-6 py-4 transition-all hover:bg-gray-100 dark:hover:bg-gray-700 relative
                                ${isActive ? 'text-somali-blue dark:text-blue-400 font-bold bg-blue-50 dark:bg-gray-700/50' : 'text-gray-500 dark:text-gray-400'}
                            `}
                        >
                            {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-somali-blue"></div>}
                            <div className="w-6 text-center"><i className={`fas ${item.icon} text-lg`}></i></div>
                            <span className="text-sm hidden lg:block">{item.label}</span>
                        </button>
                    );
                })}
            </div>
            <div className="px-6 text-xs text-gray-400 text-center lg:text-left">
                <span className="hidden lg:inline">v2.0 &copy; 2024</span>
            </div>
        </div>
      );
  }

  // Mobile Horizontal
  return (
    <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 shrink-0 pb-safe transition-colors">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button 
            key={item.path} 
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center gap-1 transition-colors w-14 py-1 rounded-lg ${isActive ? 'text-somali-blue dark:text-blue-400 bg-blue-50 dark:bg-gray-700' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            <i className={`fas ${item.icon} text-lg ${isActive ? 'scale-110' : ''} transition-transform`}></i>
            <span className="text-[10px] font-bold">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};