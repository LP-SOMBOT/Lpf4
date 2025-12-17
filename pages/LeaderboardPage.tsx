import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../firebase';
import { UserContext } from '../contexts';
import { UserProfile } from '../types';
import { Avatar } from '../components/UI';

const LeaderboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
     // 1. Initial Load from Cache
     const cachedData = localStorage.getItem('leaderboard_cache');
     if (cachedData) {
         try {
            setPlayers(JSON.parse(cachedData));
            setLoading(false);
         } catch(e) {}
     }

     // 2. Subscribe to Live Updates
     const usersRef = ref(db, 'users');
     const handleUpdate = (snapshot: any) => {
         if (snapshot.exists()) {
             const data = snapshot.val();
             const list: UserProfile[] = Object.keys(data).map(key => ({
                 uid: key,
                 name: data[key].name || 'Unknown',
                 email: data[key].email || '',
                 points: typeof data[key].points === 'number' ? data[key].points : 0,
                 avatar: data[key].avatar || '',
             }));
             
             // Sort descending
             list.sort((a, b) => b.points - a.points);
             
             const top20 = list.slice(0, 20);
             setPlayers(top20);
             
             // Update Cache
             localStorage.setItem('leaderboard_cache', JSON.stringify(top20));
         }
         setLoading(false);
     };

     onValue(usersRef, handleUpdate);

     return () => {
         off(usersRef, 'value', handleUpdate);
     };
  }, []);

  const getRankStyle = (index: number) => {
     // Added dark mode classes (dark:bg-...) to ensure white text is visible on dark backgrounds
     if (index === 0) return "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-600/50";
     if (index === 1) return "bg-gray-50 border-gray-200 dark:bg-gray-700/40 dark:border-gray-600/50";
     if (index === 2) return "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-600/50";
     return "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700";
  };

  const getIcon = (index: number) => {
    if (index === 0) return <i className="fas fa-crown text-yellow-500"></i>;
    if (index === 1) return <i className="fas fa-medal text-gray-400 dark:text-gray-300"></i>;
    if (index === 2) return <i className="fas fa-medal text-orange-500"></i>;
    return <span className="text-gray-400 font-bold">{index + 1}</span>;
  }

  return (
    <div className="min-h-full p-4 flex flex-col pb-8 max-w-4xl mx-auto w-full">
       <div className="sticky top-0 z-30 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-md -mx-4 px-4 py-3 mb-6 border-b border-gray-200/50 dark:border-gray-700/50 shadow-sm flex items-center gap-4 transition-colors">
        <button onClick={() => navigate('/')} className="text-gray-600 dark:text-gray-300 hover:text-somali-blue dark:hover:text-blue-400 transition-colors">
            <i className="fas fa-arrow-left fa-lg"></i>
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Top Students</h1>
      </div>

      {loading && players.length === 0 ? (
        <div className="space-y-3">
             {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse">
                    <div className="w-8 h-6 bg-gray-200 dark:bg-gray-700 rounded mr-3"></div>
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full mr-4"></div>
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                    </div>
                    <div className="w-12 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
             ))}
        </div>
      ) : (
        <div className="space-y-3">
            {players.length === 0 && <div className="text-center text-gray-500 mt-10">No players found.</div>}
            {players.map((p, idx) => {
                const isMe = p.uid === user?.uid;
                const level = Math.floor(p.points / 10) + 1;
                
                return (
                    <div key={p.uid} className={`flex items-center p-4 rounded-xl border shadow-sm ${getRankStyle(idx)} ${isMe ? 'ring-2 ring-somali-blue' : ''} animate__animated animate__fadeInUp transition-colors`} style={{animationDelay: `${idx * 0.05}s`}}>
                        <div className="w-8 text-center text-xl mr-3 font-mono">
                            {getIcon(idx)}
                        </div>
                        <Avatar src={p.avatar} seed={p.uid} size="sm" className="mr-4" />
                        <div className="flex-1">
                            <div className="font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                                {p.name}
                                {isMe && <span className="bg-somali-blue text-white text-[9px] px-2 rounded-full">YOU</span>}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Level {level}</div>
                        </div>
                        <div className="font-mono font-bold text-somali-blue dark:text-blue-400">{p.points} pts</div>
                    </div>
                );
            })}
        </div>
      )}
    </div>
  );
};

export default LeaderboardPage;