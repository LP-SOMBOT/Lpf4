
import React, { useState, useEffect, useMemo } from 'react';
import { ref, update, onValue, off, set, remove, get, push } from 'firebase/database';
import { db } from '../firebase';
import { UserProfile, Subject, Chapter, Question, MatchState, QuestionReport } from '../types';
import { Button, Card, Input, Modal, Avatar } from '../components/UI';
import { showAlert, showToast, showConfirm, showPrompt } from '../services/alert';
import { useNavigate } from 'react-router-dom';

const SuperAdminPage: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [activeTab, setActiveTab] = useState<'home' | 'users' | 'quizzes' | 'arena' | 'social' | 'reports'>('home');
  const navigate = useNavigate();
  
  // --- DATA STATES ---
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [matches, setMatches] = useState<MatchState[]>([]);
  const [reports, setReports] = useState<QuestionReport[]>([]);
  const [emojis, setEmojis] = useState<{id: string, value: string}[]>([]);
  const [pttMessages, setPttMessages] = useState<{id: string, value: string}[]>([]);
  
  // Selection States
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [reportFilter, setReportFilter] = useState<'all' | 'wrong_answer' | 'typo' | 'other'>('all');

  // --- AUTHENTICATION ---
  const checkPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '1234') { 
        setIsAuthenticated(true); 
    } else {
        showAlert('Access Denied', 'Incorrect PIN', 'error');
    }
  };

  // --- DATA SYNC ---
  useEffect(() => {
    if (!isAuthenticated) return;

    const syncRefs = [
      { path: 'users', setter: (data: any) => setUsers(Object.keys(data || {}).map(k => ({ uid: k, ...data[k] }))) },
      { path: 'matches', setter: (data: any) => setMatches(Object.keys(data || {}).map(k => ({ ...data[k], matchId: k })).reverse()) },
      { path: 'reports', setter: (data: any) => setReports(Object.keys(data || {}).map(k => ({ ...data[k], id: k })).reverse()) },
      { path: 'subjects', setter: (data: any) => setSubjects(Object.values(data || {}).filter((s: any) => s && s.id && s.name) as Subject[]) },
      { 
        path: 'settings/reactions', 
        setter: (val: any) => {
          if (val?.emojis) setEmojis(Object.entries(val.emojis).map(([k, v]) => ({id: k, value: v as string})));
          if (val?.messages) setPttMessages(Object.entries(val.messages).map(([k, v]) => ({id: k, value: v as string})));
        } 
      }
    ];

    const unsubs = syncRefs.map(r => {
      const dbRef = ref(db, r.path);
      const listener = onValue(dbRef, (snap) => r.setter(snap.val()));
      return () => off(dbRef, 'value', listener);
    });

    return () => unsubs.forEach(fn => fn());
  }, [isAuthenticated]);

  useEffect(() => {
    if (selectedSubject) {
      const chapRef = ref(db, `chapters/${selectedSubject}`);
      onValue(chapRef, (snap) => setChapters(Object.values(snap.val() || {})));
    }
  }, [selectedSubject]);

  useEffect(() => {
    if (selectedChapter) {
      const qRef = ref(db, `questions/${selectedChapter}`);
      onValue(qRef, (snap) => {
        const data = snap.val();
        setQuestions(Object.keys(data || {}).map(key => ({ id: key, ...data[key] })));
      });
    }
  }, [selectedChapter]);

  // --- ACTIONS (Retained Logic) ---
  const toggleUserProp = async (uid: string, prop: string, current: any) => {
    try {
      await update(ref(db, `users/${uid}`), { [prop]: !current });
      showToast("User updated");
    } catch(e) { showAlert("Error", "Action failed", "error"); }
  };

  const adjustPoints = async (uid: string, current: number, delta: number) => {
    await update(ref(db, `users/${uid}`), { points: Math.max(0, current + delta) });
  };

  const terminateMatch = async (matchId: string) => {
    if (await showConfirm("Terminate Match?", "Game will end for all players.")) {
      const match = matches.find(m => m.matchId === matchId);
      const updates: any = {};
      updates[`matches/${matchId}`] = null;
      if (match?.players) Object.keys(match.players).forEach(uid => updates[`users/${uid}/activeMatch`] = null);
      await update(ref(db), updates);
      showToast("Terminated");
    }
  };

  const handleUpdateQuestion = async () => {
    if (!editingQuestion) return;
    const path = `questions/${editingQuestion.subject}/${editingQuestion.id}`;
    await update(ref(db, path), {
        question: editingQuestion.question,
        options: editingQuestion.options,
        answer: editingQuestion.answer
    });
    setEditingQuestion(null);
    showToast("Updated");
  };

  const handleDeleteQuestion = async (id: string | number) => {
    if (!selectedChapter) return;
    if (await showConfirm("Delete?", "Permanently remove question?")) {
      await remove(ref(db, `questions/${selectedChapter}/${id}`));
      showToast("Deleted");
    }
  };

  // --- FILTERS ---
  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return users.filter(u => u.name?.toLowerCase().includes(term) || u.username?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term));
  }, [users, searchTerm]);

  const filteredReports = useMemo(() => {
    if (reportFilter === 'all') return reports;
    return reports.filter(r => r.reason === reportFilter);
  }, [reports, reportFilter]);

  // --- UI COMPONENTS ---

  const SidebarItem = ({ id, icon, active }: { id: string, icon: string, active: boolean }) => (
      <button 
        onClick={() => setActiveTab(id as any)}
        className={`w-12 h-12 mb-6 rounded-2xl flex items-center justify-center transition-all duration-300 relative group ${active ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'text-slate-500 hover:text-slate-200'}`}
      >
          <i className={`fas ${icon} text-xl`}></i>
          {active && <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-6 bg-cyan-400 rounded-r-full shadow-[0_0_10px_rgba(34,211,238,0.8)]"></div>}
      </button>
  );

  const StatCard = ({ title, value, sub, chartColor }: { title: string, value: string, sub: string, chartColor: string }) => (
      <div className="bg-[#1e293b] rounded-[2rem] p-5 relative overflow-hidden border border-slate-700/50 shadow-lg">
          <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">{title}</h3>
          <div className="text-2xl font-black text-white mb-4">{value}</div>
          
          {/* SVG Chart Simulation */}
          <div className="absolute bottom-4 left-0 right-0 h-10 px-4 opacity-80">
             <svg viewBox="0 0 100 25" className="w-full h-full overflow-visible">
                 <path 
                    d="M0,25 C20,25 20,10 40,10 C60,10 60,20 80,20 C90,20 95,5 100,0" 
                    fill="none" 
                    stroke={chartColor} 
                    strokeWidth="3" 
                    strokeLinecap="round"
                 />
             </svg>
          </div>
          <div className="absolute top-5 right-5 text-[10px] font-black" style={{ color: chartColor }}>{sub}</div>
      </div>
  );

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1120] p-6 font-sans">
        <div className="w-full max-w-sm bg-[#1e293b] border border-cyan-500/20 p-10 rounded-[2.5rem] shadow-[0_0_50px_rgba(34,211,238,0.1)] relative overflow-hidden text-center">
          <div className="w-20 h-20 bg-cyan-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-cyan-500/30 animate-pulse">
             <i className="fas fa-fingerprint text-4xl text-cyan-400"></i>
          </div>
          <h1 className="text-2xl font-black text-white mb-2 uppercase tracking-widest">System Locked</h1>
          <p className="text-slate-500 text-xs font-bold mb-8">Enter Administrator PIN</p>
          <form onSubmit={checkPin}>
            <input 
                type="password" 
                value={pin} 
                onChange={e => setPin(e.target.value)}
                className="w-full bg-[#0b1120] border-2 border-slate-700 rounded-xl py-4 text-center text-2xl tracking-[0.5em] font-black text-cyan-400 focus:border-cyan-500 outline-none transition-all mb-6"
                placeholder="••••"
                autoFocus
            />
            <Button fullWidth className="bg-cyan-500 hover:bg-cyan-400 text-[#0b1120] font-black border-none py-4 rounded-xl">UNLOCK</Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0b1120] text-white font-sans overflow-hidden select-none">
        
        {/* SIDEBAR */}
        <div className="w-24 border-r border-slate-800 flex flex-col items-center py-8 z-20 bg-[#0b1120]">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center mb-10 shadow-lg shadow-cyan-500/20">
                <i className="fas fa-bolt text-xl text-white"></i>
            </div>
            
            <div className="flex-1 w-full flex flex-col items-center custom-scrollbar overflow-y-auto">
                <SidebarItem id="home" icon="fa-th-large" active={activeTab === 'home'} />
                <SidebarItem id="quizzes" icon="fa-layer-group" active={activeTab === 'quizzes'} />
                <SidebarItem id="users" icon="fa-users" active={activeTab === 'users'} />
                <SidebarItem id="arena" icon="fa-gamepad" active={activeTab === 'arena'} />
                <SidebarItem id="social" icon="fa-comments" active={activeTab === 'social'} />
                <SidebarItem id="reports" icon="fa-flag" active={activeTab === 'reports'} />
            </div>

            <button onClick={() => navigate('/')} className="w-10 h-10 rounded-full bg-slate-800 text-slate-500 hover:text-white flex items-center justify-center transition-colors mt-4">
                <i className="fas fa-sign-out-alt"></i>
            </button>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
            
            {/* HEADER */}
            <header className="px-8 py-6 flex justify-between items-center border-b border-slate-800/50 bg-[#0b1120]/95 backdrop-blur-sm z-10">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">ADMIN CONSOLE</h1>
                    <p className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.3em]">LP-F4 Systems</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="relative">
                        <i className="fas fa-bell text-slate-400 text-xl"></i>
                        {reports.length > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-cyan-500/20 border-2 border-cyan-500 flex items-center justify-center">
                        <span className="font-black text-cyan-400 text-xs">LP</span>
                    </div>
                </div>
            </header>

            {/* SCROLLABLE AREA */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                
                {/* --- DASHBOARD HOME --- */}
                {activeTab === 'home' && (
                    <div className="max-w-6xl mx-auto space-y-8 animate__animated animate__fadeIn">
                        
                        {/* 4 Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard title="Total Users" value={users.length.toLocaleString()} sub="+12.5%" chartColor="#22d3ee" />
                            <StatCard title="Live Matches" value={matches.length.toString()} sub="Active" chartColor="#4ade80" />
                            <StatCard title="New Signups" value="24" sub="+5 Today" chartColor="#fb923c" />
                            <StatCard title="Reports" value={reports.length.toString()} sub={reports.length > 0 ? "Action Req" : "All Good"} chartColor="#f472b6" />
                        </div>

                        {/* Middle Section: Chart & Activity */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            
                            {/* Large Chart */}
                            <div className="lg:col-span-2 bg-[#1e293b] rounded-[2.5rem] p-8 border border-slate-700/50 shadow-xl relative overflow-hidden">
                                <div className="flex justify-between items-center mb-8 relative z-10">
                                    <div>
                                        <h3 className="text-white font-black uppercase text-lg tracking-tight">Activity Growth</h3>
                                        <p className="text-slate-500 text-xs font-bold">Real-time performance metrics</p>
                                    </div>
                                    <div className="flex bg-[#0b1120] rounded-lg p-1">
                                        <button className="px-3 py-1 bg-cyan-500 text-[#0b1120] text-[10px] font-black rounded uppercase">Week</button>
                                        <button className="px-3 py-1 text-slate-500 text-[10px] font-black rounded uppercase hover:text-white">Month</button>
                                    </div>
                                </div>
                                
                                {/* Big Gradient Chart */}
                                <div className="h-48 w-full relative z-10">
                                    <svg viewBox="0 0 400 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                                        <defs>
                                            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
                                                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                                            </linearGradient>
                                        </defs>
                                        <path d="M0,80 C50,80 50,40 100,40 C150,40 150,70 200,60 C250,50 250,20 300,30 C350,40 350,10 400,20 V100 H0 Z" fill="url(#chartGrad)" />
                                        <path d="M0,80 C50,80 50,40 100,40 C150,40 150,70 200,60 C250,50 250,20 300,30 C350,40 350,10 400,20" fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
                                        {/* Points */}
                                        <circle cx="400" cy="20" r="4" fill="#22d3ee" stroke="#fff" strokeWidth="2" />
                                    </svg>
                                </div>
                                
                                <div className="flex justify-between text-slate-500 text-[10px] font-black uppercase mt-4 px-2">
                                    <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                                </div>
                            </div>

                            {/* Recent Activity List */}
                            <div className="bg-[#1e293b] rounded-[2.5rem] p-6 border border-slate-700/50 shadow-xl">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-white font-black uppercase text-sm tracking-widest">Recent Battles</h3>
                                    <button className="text-[10px] font-black text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded-full hover:bg-cyan-500/10">VIEW ALL</button>
                                </div>
                                <div className="space-y-4">
                                    {matches.slice(0, 4).map(m => (
                                        <div key={m.matchId} className="bg-[#0b1120] p-3 rounded-2xl flex items-center gap-3 border border-slate-800">
                                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-cyan-400">
                                                <i className="fas fa-gamepad"></i>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white font-bold text-xs truncate">#{String(m.matchId).substring(6)}</div>
                                                <div className="text-[10px] text-slate-500 truncate">{m.subjectTitle}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-white font-black text-sm">{Object.keys(m.players || {}).length}P</div>
                                                <div className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${m.status === 'active' ? 'bg-green-500 text-[#0b1120]' : 'bg-slate-700 text-slate-400'}`}>
                                                    {m.status === 'active' ? 'LIVE' : 'DONE'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {matches.length === 0 && <div className="text-center text-slate-600 text-xs py-10">No recent activity</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- OTHER TABS (Simplified Views) --- */}
                {activeTab !== 'home' && (
                    <div className="bg-[#1e293b] rounded-[2.5rem] p-8 border border-slate-700/50 min-h-[500px] animate__animated animate__fadeIn">
                        {activeTab === 'users' && (
                            <div>
                                <div className="flex gap-4 mb-6">
                                    <div className="relative flex-1">
                                        <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                                        <input 
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="w-full bg-[#0b1120] border-none rounded-xl py-3 pl-12 pr-4 text-white text-sm font-bold focus:ring-1 focus:ring-cyan-500"
                                            placeholder="Search users..."
                                        />
                                    </div>
                                    <div className="bg-[#0b1120] px-4 py-3 rounded-xl text-white font-black text-sm flex items-center gap-2">
                                        {users.length} <span className="text-slate-500">USERS</span>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {filteredUsers.slice(0, 20).map(u => (
                                        <div key={u.uid} className="bg-[#0b1120] p-4 rounded-2xl flex items-center justify-between group hover:border-cyan-500/30 border border-transparent transition-all">
                                            <div className="flex items-center gap-3">
                                                <Avatar src={u.avatar} size="sm" />
                                                <div>
                                                    <div className="text-white font-bold text-sm flex items-center gap-2">
                                                        {u.name}
                                                        {u.banned && <span className="text-[8px] bg-red-500 px-1.5 rounded text-white uppercase">Banned</span>}
                                                    </div>
                                                    <div className="text-slate-500 text-xs">@{u.username || 'guest'} • {u.points} PTS</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => toggleUserProp(u.uid, 'isVerified', u.isVerified)} className="w-8 h-8 rounded-lg bg-slate-800 text-blue-400 hover:bg-blue-500 hover:text-white flex items-center justify-center"><i className="fas fa-check"></i></button>
                                                <button onClick={() => toggleUserProp(u.uid, 'banned', u.banned)} className="w-8 h-8 rounded-lg bg-slate-800 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center"><i className="fas fa-ban"></i></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'quizzes' && (
                            <div>
                                <h2 className="text-xl font-black text-white mb-6 uppercase tracking-widest">Content Manager</h2>
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <select 
                                        value={selectedSubject} 
                                        onChange={e => setSelectedSubject(e.target.value)}
                                        className="bg-[#0b1120] text-white p-4 rounded-xl font-bold border-none outline-none focus:ring-1 focus:ring-cyan-500"
                                    >
                                        <option value="">Select Subject</option>
                                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                    <select 
                                        value={selectedChapter} 
                                        onChange={e => setSelectedChapter(e.target.value)}
                                        className="bg-[#0b1120] text-white p-4 rounded-xl font-bold border-none outline-none focus:ring-1 focus:ring-cyan-500"
                                        disabled={!selectedSubject}
                                    >
                                        <option value="">Select Chapter</option>
                                        {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    {questions.map((q, idx) => (
                                        <div key={q.id} className="bg-[#0b1120] p-4 rounded-2xl border border-slate-800 flex justify-between items-start">
                                            <div className="flex gap-3">
                                                <div className="text-cyan-500 font-black text-lg w-8 pt-1">Q{idx+1}</div>
                                                <div>
                                                    <div className="text-white font-bold text-sm mb-2">{q.question}</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {q.options.map((o, i) => (
                                                            <span key={i} className={`text-[10px] px-2 py-1 rounded ${i === q.answer ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-500'}`}>{o}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <button onClick={() => setEditingQuestion(q)} className="text-cyan-400 hover:text-white"><i className="fas fa-edit"></i></button>
                                                <button onClick={() => handleDeleteQuestion(q.id)} className="text-red-400 hover:text-white"><i className="fas fa-trash"></i></button>
                                            </div>
                                        </div>
                                    ))}
                                    {questions.length === 0 && <div className="text-center text-slate-600 py-10 font-bold">Select a chapter to view questions</div>}
                                </div>
                            </div>
                        )}

                        {activeTab === 'arena' && (
                            <div>
                                <h2 className="text-xl font-black text-white mb-6 uppercase tracking-widest">Active Arena</h2>
                                <div className="space-y-4">
                                    {matches.map(m => (
                                        <div key={m.matchId} className="bg-[#0b1120] p-5 rounded-2xl border border-slate-800 flex justify-between items-center">
                                            <div>
                                                <div className="text-cyan-400 text-[10px] font-black uppercase tracking-widest mb-1">{m.subjectTitle}</div>
                                                <div className="text-white font-bold text-sm flex items-center gap-2">
                                                    {Object.keys(m.players || {}).length} Players
                                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                                </div>
                                            </div>
                                            <Button size="sm" variant="danger" onClick={() => terminateMatch(m.matchId)} className="!py-2 !px-4 !text-[10px]">TERMINATE</Button>
                                        </div>
                                    ))}
                                    {matches.length === 0 && <div className="text-center text-slate-600 py-20 font-bold">No live matches</div>}
                                </div>
                            </div>
                        )}
                        
                        {/* Add other tabs content here using similar styling */}
                        {activeTab === 'reports' && (
                            <div>
                                <h2 className="text-xl font-black text-white mb-6 uppercase tracking-widest">Incident Reports</h2>
                                <div className="space-y-3">
                                    {reports.map(r => (
                                        <div key={r.id} className="bg-[#0b1120] p-4 rounded-2xl border border-red-500/20">
                                            <div className="flex justify-between mb-2">
                                                <span className="text-red-400 text-[10px] font-black uppercase tracking-widest">{r.reason}</span>
                                                <button onClick={() => remove(ref(db, `reports/${r.id}`))} className="text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
                                            </div>
                                            <p className="text-white text-sm font-medium">"{r.questionText}"</p>
                                        </div>
                                    ))}
                                    {reports.length === 0 && <div className="text-center text-slate-600 py-20 font-bold">Clean record! No reports.</div>}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* FLOATING ACTION BUTTON */}
            <button className="fixed bottom-8 right-8 w-16 h-16 bg-cyan-500 rounded-full flex items-center justify-center text-[#0b1120] text-3xl shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:scale-110 active:scale-95 transition-all z-30">
                <i className="fas fa-plus"></i>
            </button>
        </div>

        {/* MODALS */}
        {editingQuestion && (
            <Modal isOpen={true} title="Edit Question" onClose={() => setEditingQuestion(null)}>
                <div className="space-y-4 pt-4">
                    <Input 
                        value={editingQuestion.question} 
                        onChange={(e) => setEditingQuestion({...editingQuestion, question: e.target.value})}
                        className="!bg-[#0b1120] !border-slate-700 !text-white"
                    />
                    {editingQuestion.options.map((opt, i) => (
                        <div key={i} className="flex gap-2">
                            <button 
                                onClick={() => setEditingQuestion({...editingQuestion, answer: i})}
                                className={`w-10 h-10 rounded bg-[#0b1120] border ${editingQuestion.answer === i ? 'border-green-500 text-green-500' : 'border-slate-700 text-slate-500'}`}
                            >{String.fromCharCode(65+i)}</button>
                            <Input 
                                value={opt} 
                                onChange={(e) => {
                                    const newOpts = [...editingQuestion.options];
                                    newOpts[i] = e.target.value;
                                    setEditingQuestion({...editingQuestion, options: newOpts});
                                }}
                                className="!bg-[#0b1120] !border-slate-700 !text-white !mb-0"
                            />
                        </div>
                    ))}
                    <Button fullWidth onClick={handleUpdateQuestion}>Save Changes</Button>
                </div>
            </Modal>
        )}
    </div>
  );
};

export default SuperAdminPage;
