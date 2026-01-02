
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue, off, update, remove, get } from 'firebase/database';
import { db } from '../firebase';
import { UserContext } from '../contexts';
import { UserProfile, MatchState } from '../types';
import { Button, Input, Card, Modal, Avatar } from '../components/UI';
import { showToast, showConfirm } from '../services/alert';

export const SupportDashboard: React.FC = () => {
  const { profile } = useContext(UserContext);
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'users' | 'matches'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [matches, setMatches] = useState<MatchState[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editingPointsUser, setEditingPointsUser] = useState<UserProfile | null>(null);
  const [newPoints, setNewPoints] = useState<string>('');

  useEffect(() => {
      if (profile && !profile.isSupport) navigate('/');
  }, [profile, navigate]);

  useEffect(() => {
      const usersRef = ref(db, 'users');
      onValue(usersRef, (snapshot) => {
          if (snapshot.exists()) {
              const data = snapshot.val();
              setUsers(Object.keys(data).map(k => ({ uid: k, ...data[k] })).reverse());
          }
      });
      const matchesRef = ref(db, 'matches');
      onValue(matchesRef, (snapshot) => {
          if (snapshot.exists()) {
              const data = snapshot.val();
              setMatches(Object.keys(data).map(k => ({ matchId: k, ...data[k] })).filter(m => m.status === 'active').reverse());
          } else setMatches([]);
      });
      return () => { off(usersRef); off(matchesRef); };
  }, []);

  const handleVerify = async (target: UserProfile) => {
      await update(ref(db, `users/${target.uid}`), { isVerified: !target.isVerified, verificationNotificationPending: !target.isVerified });
      showToast(`User ${target.isVerified ? 'Unverified' : 'Verified'}`, 'success');
  };

  const handleBan = async (target: UserProfile) => {
      if (!(await showConfirm(target.banned ? "Unban?" : "Ban?", "User will lose access."))) return;
      await update(ref(db, `users/${target.uid}`), { banned: !target.banned, activeMatch: null });
      showToast(`User ${target.banned ? 'Unbanned' : 'Banned'}`, 'success');
  };

  const terminateMatch = async (matchId: string) => {
      if (!(await showConfirm("End Match?", "Force stop?"))) return;
      const m = matches.find(mt => mt.matchId === matchId);
      const updates: any = { [`matches/${matchId}`]: null };
      if (m?.players) Object.keys(m.players).forEach(uid => updates[`users/${uid}/activeMatch`] = null);
      await update(ref(db), updates);
      showToast("Match Terminated", "success");
  };

  const filteredUsers = users.filter(u => u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.username?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pt-20">
        <div className="fixed top-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border-b p-4 shadow-sm flex justify-between items-center">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/')} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center"><i className="fas fa-arrow-left"></i></button>
                <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase">Support</h1>
            </div>
            <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300">
                {matches.length} Live Games
            </div>
        </div>

        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex gap-4 mb-6 border-b border-slate-200 dark:border-slate-800 pb-1">
                <button onClick={() => setActiveTab('users')} className={`pb-3 px-4 font-bold text-sm uppercase ${activeTab === 'users' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-slate-400'}`}>Users</button>
                <button onClick={() => setActiveTab('matches')} className={`pb-3 px-4 font-bold text-sm uppercase ${activeTab === 'matches' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-slate-400'}`}>Live Arena</button>
            </div>

            {activeTab === 'users' ? (
                <div className="space-y-4">
                    <Input placeholder="Search students..." icon="fa-search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    {filteredUsers.slice(0, 50).map(u => (
                        <Card key={u.uid} className="!p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <Avatar src={u.avatar} size="md" isVerified={u.isVerified} isSupport={u.isSupport} />
                                <div>
                                    <div className="font-bold flex items-center gap-2">{u.name} {u.banned && <span className="bg-red-500 text-white text-[10px] px-2 rounded">Banned</span>}</div>
                                    <div className="text-xs text-slate-400">@{u.username} | {u.points} PTS</div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleVerify(u)} className="px-3 py-1.5 rounded-lg text-xs font-bold border">{u.isVerified ? 'Revoke' : 'Verify'}</button>
                                <button onClick={() => handleBan(u)} className="px-3 py-1.5 rounded-lg text-xs font-bold border text-red-500">{u.banned ? 'Unban' : 'Ban'}</button>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {matches.map(m => {
                        const pIds = Object.keys(m.players || {});
                        const p1 = m.players?.[pIds[0]];
                        const p2 = m.players?.[pIds[1]];
                        return (
                            <Card key={m.matchId} className="!p-5 border-2 hover:border-orange-500 relative">
                                <div className="absolute top-2 right-2 text-[9px] font-black uppercase text-slate-400">Q{m.currentQ+1}/10</div>
                                <div className="text-center mb-4"><span className="text-[10px] font-black uppercase tracking-widest bg-orange-100 dark:bg-orange-900/30 text-orange-600 px-3 py-1 rounded-full">{m.subjectTitle}</span></div>
                                <div className="flex justify-between items-center mb-6">
                                    <div className="text-center flex-1">
                                        <Avatar src={p1?.avatar} size="sm" />
                                        <div className="font-black text-[10px] mt-1 truncate">{p1?.name}</div>
                                        <div className="text-xl font-black text-orange-500">{m.scores?.[pIds[0]] || 0}</div>
                                    </div>
                                    <div className="px-3 flex flex-col items-center">
                                        <span className="font-black text-slate-300 italic">VS</span>
                                        <span className="text-[9px] font-bold text-green-500 mt-1"><i className="fas fa-eye"></i> {Object.keys(m.spectators || {}).length}</span>
                                    </div>
                                    <div className="text-center flex-1">
                                        <Avatar src={p2?.avatar} size="sm" />
                                        <div className="font-black text-[10px] mt-1 truncate">{p2?.name}</div>
                                        <div className="text-xl font-black text-indigo-500">{m.scores?.[pIds[1]] || 0}</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button size="sm" variant="outline" onClick={() => navigate(`/game/${m.matchId}`)}>Watch</Button>
                                    <Button size="sm" variant="danger" onClick={() => terminateMatch(m.matchId)}>Kill</Button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    </div>
  );
};
