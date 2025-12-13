import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import { auth, db } from './firebase';
import { UserProfile } from './types';
import { Navbar } from './components/Navbar';

// Pages
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import SoloPage from './pages/SoloPage';
import LeaderboardPage from './pages/LeaderboardPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import AboutPage from './pages/AboutPage';

// Context for User Data
export const UserContext = React.createContext<{
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}>({ user: null, profile: null, loading: true });

// Context for Theme
export const ThemeContext = React.createContext<{
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}>({ theme: 'light', toggleTheme: () => {} });

// Protected Route Component
const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
  const { user, loading } = React.useContext(UserContext);
  if (loading) return null; 
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
};

// Admin Route Component
const AdminRoute = ({ children }: { children?: React.ReactNode }) => {
  const { user, profile, loading } = React.useContext(UserContext);
  if (loading) return null;
  if (!user || profile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    const cachedProfile = localStorage.getItem('userProfile');
    if (cachedProfile) {
        setProfile(JSON.parse(cachedProfile));
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = ref(db, `users/${currentUser.uid}`);
        onValue(userRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const updatedProfile = { uid: currentUser.uid, ...data };
            setProfile(updatedProfile);
            localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
            
            if (data.activeMatch && !location.pathname.includes('/game')) {
              navigate(`/game/${data.activeMatch}`);
            }
          }
          setLoading(false);
        });
      } else {
        setProfile(null);
        localStorage.removeItem('userProfile');
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [navigate, location.pathname]);

  if (loading) {
    return (
      <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-colors ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="relative w-24 h-24 mb-4">
             <div className="absolute inset-0 bg-somali-blue opacity-20 rounded-full animate-ping"></div>
             <div className="relative w-full h-full bg-somali-blue rounded-full flex items-center justify-center shadow-xl z-10">
                 <img src="https://files.catbox.moe/qn40s6.png" alt="Logo" className="w-12 h-12" />
             </div>
        </div>
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600 mb-2 animate-pulse">
            LP-F4
        </h1>
      </div>
    );
  }

  const showNavbar = ['/', '/lobby', '/leaderboard', '/profile', '/about'].includes(location.pathname);

  return (
    <UserContext.Provider value={{ user, profile, loading }}>
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        {/* Full Screen Layout */}
        <div className={`w-full h-[100dvh] font-sans flex flex-col md:flex-row overflow-hidden bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 transition-colors`}>
            
            {/* Desktop Navigation (Sidebar) */}
            {user && showNavbar && (
                <div className="hidden md:block w-24 lg:w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0 z-20">
                    <Navbar orientation="vertical" />
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 flex flex-col h-full relative overflow-hidden">
                <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth relative">
                  <Routes>
                      <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to="/" />} />
                      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                      <Route path="/lobby" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
                      <Route path="/game/:matchId" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
                      <Route path="/solo" element={<ProtectedRoute><SoloPage /></ProtectedRoute>} />
                      <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
                      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                      <Route path="/about" element={<ProtectedRoute><AboutPage /></ProtectedRoute>} />
                      <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
                  </Routes>
                </div>
                
                {/* Mobile Bottom Navigation */}
                {user && showNavbar && (
                    <div className="md:hidden z-20">
                        <Navbar orientation="horizontal" />
                    </div>
                )}
            </div>

        </div>
      </ThemeContext.Provider>
    </UserContext.Provider>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};

export default App;