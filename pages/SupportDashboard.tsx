
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue, off, update, remove, get } from 'firebase/database';
import { db } from '../firebase';
import { UserContext } from '../contexts';
import { UserProfile, MatchState } from '../types';
import { Button, Input, Card, Modal, Avatar } from '../components/UI';
import { showToast, showConfirm, showPrompt } from '../services/alert';

export const SupportDashboard: React.FC = () => {
  const { user, profile } = useContext(UserContext);
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'users' | 'matches'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [matches, setMatches] = useState<MatchState[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [editingPointsUser, setEditingPointsUser] = useState<UserProfile | null>(null);
  const [newPoints, setNewPoints] = useState<string>('');

  useEffect(() => {
      if (profile && !profile.isSupport) {
          navigate('/');
      }
  }, [profile, navigate]);

  // Fetch Users
  useEffect(() => {
      const usersRef = ref(db, 'users');
      const unsub = onValue(usersRef, (snapshot) => {
          if (snapshot.exists()) {
              const data = snapshot.val();
              const list: UserProfile[] = Object.keys(data).map(k => ({ uid: k, ...data[k] }));
              setUsers(list.reverse()); // Newest first
          } else {
              setUsers([]);
          }
      });
      return () => off(usersRef);
  }, []);

  // Fetch Matches
  useEffect(() => {
      const matchesRef = ref(db, 'matches');
      const unsub = onValue(matchesRef, (snapshot) => {
          if (snapshot.exists()) {
              const data = snapshot.val();
              const list: MatchState[] = Object.keys(data).map(k => ({ matchId: k, ...data[k] }));
              setMatches(list.filter(m => m.status === 'active').reverse());
          } else {
              setMatches([]);
          }
      });
      return () => off(matchesRef);
  }, []);

  // Actions
  const handleVerify = async (target: UserProfile) => {
      try {
          await update(ref(db, `users/${target.uid}`), { 
              isVerified: !target.isVerified,
              verificationNotificationPending: !target.isVerified // Notify if granting
          });
          showToast(`User ${target.isVerified ? 'Unverified' : 'Verified'}`, 'success');
      } catch(e) { showToast("Action failed", "error"); }
  };

  const handleBan = async (target: UserProfile) => {
      const confirm = await showConfirm(
          target.banned ? "Unban User?" : "Ban User?", 
          target.banned ? "Restore access?" : "User will be logged out immediately."
      );
      if (!confirm) return;
      
      try {
          await update(ref(db, `users/${target.uid}`), { banned: !target.banned });
          if (!target.banned) {
              await update(ref(db, `users/${target.uid}`), { activeMatch: null });
          }
          showToast(`User ${target.banned ? 'Unbanned' : 'Banned'}`, 'success');
      } catch(e) { showToast("Action failed", "error"); }
  };

  const handleDelete = async (targetUid: string) => {
      const confirm = await showConfirm("Delete User?", "This action is irreversible.", "Delete", "Cancel", "danger");
      if (!confirm) return;
      try {
          await remove(ref(db, `users/${targetUid}`));
          showToast("User Deleted", "success");
      } catch(e) { showToast("Delete failed", "error"); }
  };

  const openPointEditor = (u: UserProfile) => {
      setEditingPointsUser(u);
      setNewPoints(String(u.points || 0));
  };

  const savePoints = async () => {
      if (!editingPointsUser) return;
      const pts = parseInt(newPoints);
      if (isNaN(pts)) return;
      
      try {
          await update(ref(db, `users/${editingPointsUser.uid}`), { points: pts });
          setEditingPointsUser(null);
          showToast("Points Updated", "success");
      } catch(e) { showToast("Update failed", "error"); }
  };

  const terminateMatch = async (matchId: string) => {
      const confirm = await showConfirm("End Match?", "Force stop this game?");
      if (!confirm) return;
      try {
          const match = matches.find(m => m.matchId === matchId);
          const updates: any = {};
          updates[`matches/${matchId}`] = null;
          if (match && match.players) {
              Object.keys(match.players).forEach(uid => {
                  updates[`users/${uid}/activeMatch`] = null;
              });
          }
          await update(ref(db), updates);
          showToast("Match Terminated", "success");
      } catch(e) { showToast("Failed", "error"); }
  };

  const spectateMatch = (matchId: string) => {
      navigate(`/game/${matchId}`);
  };

  const filteredUsers = users.filter(u => 
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col font-sans transition-colors pt-20">
        <div className="fixed top-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-700 px-6 py-4 shadow-sm flex justify-between items-center">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/')} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-game-primary transition-colors">
                    <i className="fas fa-arrow-left"></i>
                </button>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                    <i className="fas fa-headset text-game-primary"></i> Support Console
                </h1>
            </div>
            <div className="flex gap-2">
                <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-xl flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">{matches.length} Live Games</span>
                </div>
            </div>
        </div>

        <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <Card className="!p-4 border-l-4 border-blue-500">
                    <div className="text-xs font-bold text-slate-400 uppercase">Total Users</div>
                    <div className="text-2xl font-black text-slate-800 dark:text-white">{users.length}</div>
                </Card>
                <Card className="!p-4 border-l-4 border-green-500">
                    <div className="text-xs font-bold text-slate-400 uppercase">Verified</div>
                    <div className="text-2xl font-black text-slate-800 dark:text-white">{users.filter(u => u.isVerified).length}</div>
                </Card>
                <Card className="!p-4 border-l-4 border-red-500">
                    <div className="text-xs font-bold text-slate-400 uppercase">Banned</div>
                    <div className="text-2xl font-black text-slate-800 dark:text-white">{users.filter(u => u.banned).length}</div>
                </Card>
                <Card className="!p-4 border-l-4 border-purple-500">
                    <div className="text-xs font-bold text-slate-400 uppercase">Support Staff</div>
                    <div className="text-2xl font-black text-slate-800 dark:text-white">{users.filter(u => u.isSupport).length}</div>
                </Card>
            </div>

            <div className="flex gap-4 mb-6 border-b border-slate-200 dark:border-slate-700 pb-1">
                <button onClick={() => setActiveTab('users')} className={`pb-3 px-4 font-bold text-sm uppercase tracking-wide transition-all ${activeTab === 'users' ? 'text-game-primary border-b-2 border-game-primary' : 'text-slate-400 hover:text-slate-600'}`}>User Management</button>
                <button onClick={() => setActiveTab('matches')} className={`pb-3 px-4 font-bold text-sm uppercase tracking-wide transition-all ${activeTab === 'matches' ? 'text-game-primary border-b-2 border-game-primary' : 'text-slate-400 hover:text-slate-600'}`}>Live Arena</button>
            </div>

            {activeTab === 'users' && (
                <div className="animate__animated animate__fadeIn">
                    <div className="mb-6 max-w-md">
                        <Input placeholder="Search students..." icon="fa-search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {filteredUsers.slice(0, 50).map(u => (
                            <div key={u.uid} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <Avatar src={u.avatar} seed={u.uid} size="md" isVerified={u.isVerified} isSupport={u.isSupport} />
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            {u.name}
                                            {u.banned && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded uppercase">Banned</span>}
                                        </div>
                                        <div className="text-xs text-slate-500 font-mono">@{u.username || 'guest'}</div>
                                        <div className="text-xs text-game-primary font-black mt-1">{u.points} PTS <span className="text-slate-300">|</span> LVL {Math.floor(u.points/10)+1}</div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => handleVerify(u)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${u.isVerified ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>{u.isVerified ? 'Revoke Badge' : 'Verify'}</button>
                                    <button onClick={() => openPointEditor(u)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100">Adjust Points</button>
                                    <button onClick={() => handleBan(u)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${u.banned ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>{u.banned ? 'Unban' : 'Ban'}</button>
                                    <button onClick={() => handleDelete(u.uid)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200 hover:bg-red-50 hover:text-red-500"><i className="fas fa-trash"></i></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'matches' && (
                <div className="animate__animated animate__fadeIn grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {matches.length === 0 && <div className="col-span-full text-center py-20 text-slate-400"><i className="fas fa-gamepad text-4xl mb-4"></i><p>No active matches.</p></div>}
                    {matches.map(m => {
                        const pIds = Object.keys(m.players || {});
                        const p1 = m.players?.[pIds[0]];
                        const p2 = m.players?.[pIds[1]];
                        const scores = m.scores || {};
                        const specs = m.spectators || {};
                        
                        return (
                            <div key={m.matchId} className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-lg border-2 border-slate-100 dark:border-slate-700 relative overflow-hidden group hover:border-game-primary transition-all">
                                <div className="absolute top-0 left-0 bg-green-500 text-white text-[9px] font-black px-3 py-1 rounded-br-xl uppercase flex items-center gap-1">
                                    <i className="fas fa-satellite-dish animate-pulse"></i> Live Arena
                                </div>
                                <div className="absolute top-0 right-0 bg-slate-100 dark:bg-slate-700 text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase text-slate-500 dark:text-slate-300">
                                    Q{m.currentQ+1} / 10
                                </div>

                                <div className="text-center mt-6 mb-6">
                                    <div className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/30 inline-block px-3 py-1 rounded-full">{m.subjectTitle}</div>
                                </div>
                                
                                <div className="flex justify-between items-center mb-8 relative">
                                    <div className="text-center flex-1">
                                        <div className="relative inline-block">
                                            <Avatar src={p1?.avatar} size="md" className="border-2 border-orange-400" />
                                            <div className="absolute -bottom-1 -right-1 bg-orange-400 text-white text-[8px] font-bold px-1.5 rounded-full">L{p1?.level || 1}</div>
                                        </div>
                                        <div className="font-black text-[11px] mt-2 text-slate-700 dark:text-slate-200 truncate px-2">{p1?.name}</div>
                                        <div className="text-2xl font-black text-orange-500 mt-1">{scores[pIds[0]] ?? 0}</div>
                                    </div>

                                    <div className="flex flex-col items-center gap-1 px-4">
                                        <div className="text-xl font-black text-slate-300 dark:text-slate-600 italic">VS</div>
                                        <div className="flex items-center gap-1 text-[9px] font-bold text-green-500 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                                            <i className="fas fa-eye"></i> {Object.keys(specs).length}
                                        </div>
                                    </div>

                                    <div className="text-center flex-1">
                                        <div className="relative inline-block">
                                            <Avatar src={p2?.avatar} size="md" className="border-2 border-indigo-400" />
                                            <div className="absolute -bottom-1 -right-1 bg-indigo-400 text-white text-[8px] font-bold px-1.5 rounded-full">L{p2?.level || 1}</div>
                                        </div>
                                        <div className="font-black text-[11px] mt-2 text-slate-700 dark:text-slate-200 truncate px-2">{p2?.name}</div>
                                        <div className="text-2xl font-black text-indigo-500 mt-1">{scores[pIds[1]] ?? 0}</div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <Button size="sm" variant="outline" onClick={() => spectateMatch(m.matchId)} className="!rounded-xl !text-[10px]">
                                        <i className="fas fa-glasses mr-1"></i> Watch
                                    </Button>
                                    <Button size="sm" variant="danger" onClick={() => terminateMatch(m.matchId)} className="!rounded-xl !text-[10px]">
                                        <i className="fas fa-times-circle mr-1"></i> Kill
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        <Modal isOpen={!!editingPointsUser} title="Edit Points" onClose={() => setEditingPointsUser(null)}>
            <div className="space-y-4">
                <p className="text-sm text-slate-500">Adjusting points for <b>{editingPointsUser?.name}</b></p>
                <Input type="number" value={newPoints} onChange={e => setNewPoints(e.target.value)} placeholder="Enter points value" />
                <Button fullWidth onClick={savePoints}>Save Changes</Button>
            </div>
        </Modal>
    </div>
  );
};