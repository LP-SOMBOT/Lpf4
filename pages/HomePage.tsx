import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { UserContext } from '../contexts';
import { Avatar, Card, Modal, Button } from '../components/UI';
import { playSound } from '../services/audioService';
import { generateAvatarUrl } from '../constants';

const HomePage: React.FC = () => {
  const { profile, user } = useContext(UserContext);
  const navigate = useNavigate();

  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarSeeds, setAvatarSeeds] = useState<string[]>([]);

  useEffect(() => {
    const isNew = sessionStorage.getItem('showAvatarSelection');
    if (isNew) {
      setShowAvatarModal(true);
      setAvatarSeeds(Array.from({length: 9}, () => Math.random().toString(36).substring(7)));
      sessionStorage.removeItem('showAvatarSelection');
    }
  }, []);

  const handleAvatarSelect = async (seed: string) => {
      if (!user) return;
      const url = generateAvatarUrl(seed);
      try {
        await update(ref(db, `users/${user.uid}`), { avatar: url });
        playSound('correct');
        setShowAvatarModal(false);
      } catch (e) {
        console.error("Error saving avatar", e);
      }
  };

  const refreshAvatars = () => {
      setAvatarSeeds(Array.from({length: 9}, () => Math.random().toString(36).substring(7)));
      playSound('click');
  };

  const handleNav = (path: string) => {
    playSound('click');
    navigate(path);
  };

  const level = Math.floor((profile?.points || 0) / 10) + 1;
  const nextLevel = (level * 10);
  const progress = ((profile?.points || 0) % 10) / 10 * 100;

  return (
    <div className="min-h-full flex flex-col pb-28 md:pb-6 max-w-5xl mx-auto w-full px-4 pt-6">
      {/* Header Stat Bar */}
      <div className="flex justify-between items-center mb-8">
         <div className="flex items-center gap-4">
             <div onClick={() => handleNav('/profile')} className="relative cursor-pointer group">
                 <div className="absolute inset-0 bg-white rounded-full blur opacity-50 group-hover:opacity-100 transition-opacity"></div>
                 <Avatar src={profile?.avatar} seed={profile?.uid} size="md" className="border-4 border-white shadow-lg" />
                 <div className="absolute -bottom-1 -right-1 bg-game-primary text-white text-[10px] font-black px-2 py-0.5 rounded-full border-2 border-white">
                    LVL {level}
                 </div>
             </div>
             <div>
                 <h1 className="text-2xl font-black text-slate-800 dark:text-white leading-none mb-1">
                     Hi, {profile?.name}
                 </h1>
                 <div className="w-32 h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden border border-slate-300 dark:border-slate-600 relative">
                     <div className="h-full bg-game-success rounded-full" style={{ width: `${progress}%` }}></div>
                     <span className="absolute inset-0 text-[8px] font-bold flex items-center justify-center text-slate-600 dark:text-slate-300">
                        {profile?.points} / {nextLevel} PTS
                     </span>
                 </div>
             </div>
         </div>
         
         {/* Currency / Admin Icon */}
         <div className="flex gap-2">
            {profile?.role === 'admin' && (
                <button onClick={() => handleNav('/admin')} className="w-12 h-12 rounded-2xl bg-slate-800 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                    <i className="fas fa-cogs"></i>
                </button>
            )}
            <div className="px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border-2 border-slate-100 dark:border-slate-700 flex items-center gap-2">
                <i className="fas fa-star text-game-accent text-xl animate-pulse-fast"></i>
                <span className="font-black text-lg text-slate-800 dark:text-white">{profile?.points}</span>
            </div>
         </div>
      </div>

      {/* Hero / Featured Mode */}
      <div className="mb-6 cursor-pointer group" onClick={() => handleNav('/lobby')}>
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-game-primary to-purple-600 p-8 shadow-2xl shadow-indigo-500/40 transition-transform group-hover:scale-[1.02]">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="text-center md:text-left">
                      <span className="bg-white/20 text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block backdrop-blur-sm border border-white/20">
                          Recommended
                      </span>
                      <h2 className="text-4xl md:text-5xl font-black text-white mb-2 italic tracking-tight drop-shadow-md">
                          BATTLE ARENA
                      </h2>
                      <p className="text-indigo-100 font-bold max-w-md">
                          Challenge real opponents in real-time. Climb the ranks and prove your knowledge!
                      </p>
                  </div>
                  <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-full flex items-center justify-center shadow-2xl animate-bounce-slow text-game-primary text-5xl md:text-6xl border-4 border-indigo-200">
                      <i className="fas fa-swords"></i>
                  </div>
              </div>
          </div>
      </div>

      {/* Secondary Modes Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-4 md:gap-6">
          <div onClick={() => handleNav('/solo')} className="cursor-pointer group">
              <div className="h-48 rounded-[2rem] bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-6 flex flex-col justify-between shadow-xl transition-all group-hover:-translate-y-1 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-10">
                       <i className="fas fa-brain text-8xl transform rotate-12"></i>
                   </div>
                   <div className="w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-900/30 text-green-500 flex items-center justify-center text-2xl mb-2">
                       <i className="fas fa-dumbbell"></i>
                   </div>
                   <div>
                       <h3 className="text-xl font-black text-slate-800 dark:text-white">Training</h3>
                       <p className="text-xs font-bold text-slate-400">Solo Practice</p>
                   </div>
              </div>
          </div>

          <div onClick={() => handleNav('/leaderboard')} className="cursor-pointer group">
              <div className="h-48 rounded-[2rem] bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-6 flex flex-col justify-between shadow-xl transition-all group-hover:-translate-y-1 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-10">
                       <i className="fas fa-trophy text-8xl transform -rotate-12"></i>
                   </div>
                   <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-500 flex items-center justify-center text-2xl mb-2">
                       <i className="fas fa-crown"></i>
                   </div>
                   <div>
                       <h3 className="text-xl font-black text-slate-800 dark:text-white">Rankings</h3>
                       <p className="text-xs font-bold text-slate-400">Global Leaderboard</p>
                   </div>
              </div>
          </div>
      </div>

      {/* Avatar Modal */}
      <Modal isOpen={showAvatarModal} title="Choose Avatar" onClose={() => setShowAvatarModal(false)}>
          <div className="grid grid-cols-3 gap-4">
              {avatarSeeds.map((seed, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleAvatarSelect(seed)}
                    className="aspect-square rounded-full overflow-hidden border-4 border-transparent hover:border-game-primary cursor-pointer transition-all hover:scale-105 bg-slate-100"
                  >
                      <img src={generateAvatarUrl(seed)} alt="avatar" className="w-full h-full object-cover" />
                  </div>
              ))}
          </div>
          <Button fullWidth variant="secondary" className="mt-8" onClick={refreshAvatars}>
             <i className="fas fa-sync mr-2"></i> Randomize
          </Button>
      </Modal>
    </div>
  );
};

export default HomePage;