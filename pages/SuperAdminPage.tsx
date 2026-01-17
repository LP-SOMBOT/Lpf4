
import React, { useState, useEffect, useMemo } from 'react';
import { ref, update, onValue, off, set, remove, get, push } from 'firebase/database';
import { db } from '../firebase';
import { UserProfile, Subject, Chapter, Question, MatchState, QuestionReport } from '../types';
import { Button, Card, Input, Modal, Avatar } from '../components/UI';
import { showAlert, showToast, showConfirm } from '../services/alert';
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
      // FIX: Add explicit type casting for Subject array to resolve 'unknown[]' assignment error
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

  // --- ACTIONS ---
  const toggleUserProp = async (uid: string, prop: string, current: any) => {
    try {
      await update(ref(db, `users/${uid}`), { [prop]: !current });
      showToast("User updated", "success");
    } catch(e) { showAlert("Error", "Action failed", "error"); }
  };

  const adjustPoints = async (uid: string, current: number, delta: number) => {
    await update(ref(db, `users/${uid}`), { points: Math.max(0, current + delta) });
  };

  const terminateMatch = async (matchId: string) => {
    if (await showConfirm("Terminate Match?", "Game will end for all players.", "Terminate", "Cancel", "danger")) {
      const match = matches.find(m => m.matchId === matchId);
      const updates: any = {};
      updates[`matches/${matchId}`] = null;
      if (match?.players) Object.keys(match.players).forEach(uid => updates[`users/${uid}/activeMatch`] = null);
      await update(ref(db), updates);
      showToast("Terminated", "success");
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
    showToast("Updated", "success");
  };

  const handleDeleteQuestion = async (id: string | number) => {
    if (!selectedChapter) return;
    if (await showConfirm("Delete?", "Permanently remove question?")) {
      await remove(ref(db, `questions/${selectedChapter}/${id}`));
      showToast("Deleted", "success");
    }
  };

  const handleSeedDefaults = async () => {
    const DEFAULT_EMOJIS = ['😂', '😡', '👏', '😱', '🥲', '🔥', '🏆', '🤯'];
    const DEFAULT_MESSAGES = ['Guul ayaan rabaa!', 'Nabad iyo caano!', 'Waan ku caawinayaa', 'Mahadsanid saaxiib'];
    const updates: any = {};
    DEFAULT_EMOJIS.forEach(e => updates[`settings/reactions/emojis/${push(ref(db, 'settings/reactions/emojis')).key}`] = e);
    DEFAULT_MESSAGES.forEach(m => updates[`settings/reactions/messages/${push(ref(db, 'settings/reactions/messages')).key}`] = m);
    await update(ref(db), updates);
    showToast('Defaults Loaded', 'success');
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

  // --- SUB-VIEWS ---

  const HomeView = () => (
    <div className="space-y-6 animate__animated animate__fadeIn">
      {/* Stat Tiles */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700/50 shadow-inner relative overflow-hidden group">
          <div className="absolute top-4 right-4 text-game-success font-black text-xs">+5.2%</div>
          <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Total Users</div>
          <div className="text-3xl font-black text-white">{users.length.toLocaleString()}</div>
          <i className="fas fa-users absolute -bottom-6 -right-6 text-7xl opacity-5 group-hover:scale-110 transition-transform"></i>
        </div>
        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700/50 shadow-inner relative overflow-hidden group">
          <div className="absolute top-4 right-4 flex items-center gap-1.5">
             <span className="w-2 h-2 bg-game-primary rounded-full animate-pulse"></span>
             <span className="text-game-primary text-[10px] font-black uppercase">Live</span>
          </div>
          <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">In Arena</div>
          <div className="text-3xl font-black text-game-primary">{matches.length * 2}</div>
          <i className="fas fa-bolt absolute -bottom-6 -right-6 text-7xl opacity-5 group-hover:scale-110 transition-transform"></i>
        </div>
      </div>

      {/* Flag Alert */}
      <div className="bg-game-primary/10 border border-game-primary/20 p-6 rounded-[2.5rem] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-game-primary rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg shadow-game-primary/30">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <div>
            <div className="text-white font-black text-2xl">{reports.length} <span className="text-sm text-slate-400 font-bold uppercase tracking-tight">Reports</span></div>
            <div className="text-game-primary text-[10px] font-black uppercase tracking-widest">{reports.length > 3 ? `${reports.length} needing immediate review` : 'Minimal flags active'}</div>
          </div>
        </div>
        <button onClick={() => setActiveTab('reports')} className="bg-game-primary text-white px-6 py-2.5 rounded-xl font-black text-sm shadow-xl active:scale-95 transition-all">Review</button>
      </div>

      {/* Performance Chart */}
      <Card className="!bg-slate-800/40 border-slate-700/50 !p-6 rounded-[2.5rem]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-white font-black uppercase tracking-tighter text-lg">Arena Performance</h3>
          <span className="text-game-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-game-primary/10 rounded-full border border-game-primary/20">Daily Peak</span>
        </div>
        <div className="flex items-end gap-2 mb-4">
          <span className="text-5xl font-black text-white leading-none">92%</span>
          <span className="text-slate-500 font-bold text-sm mb-1 uppercase">Completion Rate</span>
        </div>
        <div className="h-28 w-full relative mt-4">
          <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
            <path d="M0,80 Q40,20 80,60 T160,40 T240,75 T320,30 T400,50" fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" />
            <path d="M0,80 Q40,20 80,60 T160,40 T240,75 T320,30 T400,50 V100 H0 Z" fill="url(#grad)" opacity="0.15" />
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{stopColor:'#f97316', stopOpacity:1}} />
                <stop offset="100%" style={{stopColor:'#f97316', stopOpacity:0}} />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </Card>

      {/* Activity Feed */}
      <div>
        <h3 className="text-white font-black uppercase tracking-tighter text-lg mb-4 px-1">Recent Activity</h3>
        <div className="space-y-3 pb-4">
          {[
            { icon: 'fa-check-circle', color: 'text-blue-500', bg: 'bg-blue-500/10', title: 'Alex Rivier verified their account', time: '2 minutes ago • Level 12' },
            { icon: 'fa-plus-circle', color: 'text-game-primary', bg: 'bg-game-primary/10', title: 'New Quiz: "Advanced Som..."', time: '14 minutes ago • Created by Sarah' }
          ].map((act, i) => (
            <div key={i} className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/30 flex items-center justify-between group cursor-pointer hover:bg-slate-800/80 transition-all">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 ${act.bg} ${act.color} rounded-xl flex items-center justify-center border border-white/5`}><i className={`fas ${act.icon}`}></i></div>
                <div>
                  <div className="text-white font-bold text-sm">{act.title}</div>
                  <div className="text-slate-500 text-[10px] font-bold uppercase tracking-tight">{act.time}</div>
                </div>
              </div>
              <i className="fas fa-chevron-right text-slate-700 group-hover:translate-x-1 transition-transform"></i>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const UsersView = () => (
    <div className="space-y-6 animate__animated animate__fadeIn">
      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
           <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-500"></i>
           <input 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-[#1e293b] border-none rounded-2xl py-4.5 pl-14 pr-4 text-white text-sm font-bold focus:ring-2 focus:ring-game-primary transition-all shadow-inner"
              placeholder="Search ID, email, or name..."
           />
        </div>
        <button className="bg-[#1e293b] w-14 h-14 rounded-2xl flex items-center justify-center text-white border border-slate-700 shadow-lg"><i className="fas fa-sliders-h"></i></button>
      </div>

      <div className="grid grid-cols-3 gap-3">
         <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50">
            <div className="text-slate-500 text-[10px] font-black uppercase mb-1">Total</div>
            <div className="text-xl font-black text-white">{users.length}</div>
            <div className="text-game-success text-[8px] font-black mt-1 uppercase"><i className="fas fa-arrow-up mr-1"></i>12%</div>
         </div>
         <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50">
            <div className="text-slate-500 text-[10px] font-black uppercase mb-1">Admins</div>
            <div className="text-xl font-black text-white">{users.filter(u => u.role === 'admin').length}</div>
            <div className="text-slate-500 text-[8px] font-black mt-1">0%</div>
         </div>
         <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50">
            <div className="text-slate-500 text-[10px] font-black uppercase mb-1">Flags</div>
            <div className="text-xl font-black text-game-danger">{reports.length}</div>
            <div className="text-game-danger text-[8px] font-black mt-1 uppercase"><i className="fas fa-exclamation mr-1"></i>+1</div>
         </div>
      </div>

      <div className="flex justify-between items-center px-1">
        <h3 className="text-game-primary text-[10px] font-black uppercase tracking-[0.2em]">User Records</h3>
        <span className="text-[10px] font-black text-slate-500 uppercase bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700/30">Live Updates</span>
      </div>

      <div className="space-y-4 pb-4">
        {filteredUsers.slice(0, 25).map(u => (
          <Card key={u.uid} className={`!bg-slate-800/50 border-slate-700/30 !p-5 rounded-[2.5rem] relative group ${u.banned ? 'opacity-70' : ''}`}>
            {u.banned && <div className="absolute top-4 right-14 bg-game-danger text-white text-[8px] px-2 py-0.5 rounded uppercase font-black">Banned</div>}
            
            <div className="flex items-center gap-4 mb-6">
               <div className="relative shrink-0">
                  <Avatar src={u.avatar} size="lg" className="border-slate-700" />
                  <span className={`absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-800 ${u.isOnline ? 'bg-game-success' : 'bg-slate-500'}`}></span>
               </div>
               <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-black text-white flex items-center gap-2 truncate">
                    {u.name}
                    {u.isVerified && <i className="fas fa-check-circle text-blue-500 text-sm"></i>}
                  </h4>
                  <div className="text-game-primary text-xs font-mono truncate">@{u.username || 'unknown'}</div>
               </div>
               <button 
                  onClick={() => toggleUserProp(u.uid, 'banned', u.banned)}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${u.banned ? 'bg-game-danger text-white' : 'bg-slate-700/50 text-game-danger hover:bg-game-danger hover:text-white shadow-inner'}`}
               >
                  <i className="fas fa-ban"></i>
               </button>
            </div>

            {/* Controls Toggles */}
            <div className="grid grid-cols-3 gap-3 mb-6 text-center">
               <div className="bg-slate-900/40 p-4 rounded-2xl border border-white/5">
                  <div className="text-[9px] font-black text-slate-500 uppercase mb-3">Role</div>
                  <button onClick={() => toggleUserProp(u.uid, 'role', u.role === 'admin' ? 'admin' : 'user')} className={`w-10 h-5 rounded-full relative transition-colors ${u.role === 'admin' ? 'bg-game-primary' : 'bg-slate-700'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${u.role === 'admin' ? 'left-5.5' : 'left-0.5'}`}></div>
                  </button>
                  <div className={`text-[8px] font-black mt-2 uppercase ${u.role === 'admin' ? 'text-game-primary' : 'text-slate-500'}`}>{u.role || 'User'}</div>
               </div>
               <div className="bg-slate-900/40 p-4 rounded-2xl border border-white/5">
                  <div className="text-[9px] font-black text-slate-500 uppercase mb-3">Verify</div>
                  <button onClick={() => toggleUserProp(u.uid, 'isVerified', u.isVerified)} className={`w-10 h-5 rounded-full relative transition-colors ${u.isVerified ? 'bg-blue-500' : 'bg-slate-700'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${u.isVerified ? 'left-5.5' : 'left-0.5'}`}></div>
                  </button>
                  <div className={`text-[8px] font-black mt-2 uppercase ${u.isVerified ? 'text-blue-400' : 'text-slate-500'}`}>{u.isVerified ? 'Active' : 'Standard'}</div>
               </div>
               <div className="bg-slate-900/40 p-4 rounded-2xl border border-white/5">
                  <div className="text-[9px] font-black text-slate-500 uppercase mb-3">Support</div>
                  <button onClick={() => toggleUserProp(u.uid, 'isSupport', u.isSupport)} className={`w-10 h-5 rounded-full relative transition-colors ${u.isSupport ? 'bg-orange-500' : 'bg-slate-700'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${u.isSupport ? 'left-5.5' : 'left-0.5'}`}></div>
                  </button>
                  <div className={`text-[8px] font-black mt-2 uppercase ${u.isSupport ? 'text-orange-400' : 'text-slate-500'}`}>{u.isSupport ? 'Agent' : 'Restricted'}</div>
               </div>
            </div>

            {/* XP Points Panel */}
            <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-2xl border border-slate-700/50">
               <div>
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Current Points</div>
                  <div className="text-game-primary font-black text-lg">{(u.points || 0).toLocaleString()} <span className="text-[10px] text-slate-600">XP</span></div>
               </div>
               <div className="flex items-center gap-4 bg-[#0f172a] rounded-xl p-1 shadow-inner border border-white/5">
                  <button onClick={() => adjustPoints(u.uid, u.points || 0, -10)} className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-white transition-colors"><i className="fas fa-minus"></i></button>
                  <span className="text-white font-black text-sm w-12 text-center">+{u.points || 0}</span>
                  <button onClick={() => adjustPoints(u.uid, u.points || 0, 10)} className="w-10 h-10 flex items-center justify-center text-game-primary hover:text-white transition-colors"><i className="fas fa-plus"></i></button>
               </div>
               <button className="bg-game-primary/20 text-game-primary w-12 h-12 rounded-2xl flex items-center justify-center border border-game-primary/30 shadow-lg shadow-game-primary/5 active:scale-95 transition-all"><i className="fas fa-save"></i></button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  const QuizzesView = () => (
    <div className="space-y-6 animate__animated animate__fadeIn">
      <div className="flex items-center justify-between px-1">
         <div className="flex items-center gap-4">
           <div className="w-14 h-14 bg-game-primary rounded-2xl flex items-center justify-center text-slate-900 text-2xl shadow-xl shadow-game-primary/20"><i className="fas fa-chart-bar"></i></div>
           <h2 className="text-white font-black text-2xl uppercase tracking-tighter italic">Quiz Manager</h2>
         </div>
         <div className="flex gap-2">
           <button onClick={() => { setSelectedChapter(''); setQuestions([]); }} className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-500 border border-slate-700 active:scale-90 transition-transform"><i className="fas fa-sync-alt"></i></button>
         </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
         <div className="relative group">
            <div className="absolute top-2.5 left-4 text-[8px] font-black text-slate-500 uppercase tracking-widest z-10">Subject</div>
            <select 
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
              className="w-full bg-[#1e293b] border border-slate-700 rounded-2xl p-4 pt-6 text-white font-black text-sm appearance-none shadow-xl focus:ring-2 focus:ring-game-primary group-hover:border-slate-500 transition-all"
            >
              <option value="">Choose Subject</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <i className="fas fa-layer-group absolute right-4 bottom-4 text-slate-600"></i>
         </div>
         <div className="relative group">
            <div className="absolute top-2.5 left-4 text-[8px] font-black text-slate-500 uppercase tracking-widest z-10">Chapter</div>
            <select 
              value={selectedChapter}
              onChange={e => setSelectedChapter(e.target.value)}
              className="w-full bg-[#1e293b] border border-slate-700 rounded-2xl p-4 pt-6 text-white font-black text-sm appearance-none shadow-xl focus:ring-2 focus:ring-game-primary disabled:opacity-40 group-hover:border-slate-500 transition-all"
              disabled={!selectedSubject}
            >
              <option value="">Select Chapter</option>
              {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <i className="fas fa-square-full absolute right-4 bottom-4 text-game-primary/40 scale-75"></i>
         </div>
      </div>

      <div className="flex justify-between items-center text-slate-500 text-[10px] font-black uppercase tracking-widest px-1">
        <div className="flex gap-2 items-center">
           Admin <i className="fas fa-chevron-right text-[8px]"></i> 
           {subjects.find(s => s.id === selectedSubject)?.name || 'Subject'} <i className="fas fa-chevron-right text-[8px]"></i> 
           <span className="text-game-primary">Ch. 04</span>
        </div>
        <span className="bg-game-primary/10 text-game-primary px-3 py-1 rounded-full border border-game-primary/20">{questions.length} Questions</span>
      </div>

      <div className="space-y-4 pb-32">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-slate-800/40 p-6 rounded-[2.5rem] border border-slate-700/50 relative overflow-hidden group hover:border-slate-600 transition-colors">
            <div className="flex items-start gap-4">
               <div className="w-14 h-14 bg-game-primary/10 text-game-primary border border-game-primary/20 rounded-2xl flex items-center justify-center font-black text-2xl shrink-0">Q{idx+1}</div>
               <div className="flex-1">
                  <div className="text-game-primary text-[9px] font-black uppercase tracking-widest mb-1">Status: Live</div>
                  <h4 className="text-white font-bold leading-tight mb-4 text-base">{q.question}</h4>
                  <div className="flex gap-4 flex-wrap">
                     <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><i className="fas fa-list-ul text-game-primary"></i> {q.options.length} Options</span>
                     <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><i className="fas fa-star text-yellow-500"></i> Easy</span>
                     <span className="text-game-primary text-[9px] font-black uppercase ml-auto tracking-widest flex items-center gap-1 opacity-50"><i className="fas fa-database"></i> Sync ID: {String(q.id).substring(0,4)}</span>
                  </div>
               </div>
               <div className="flex flex-col gap-3">
                  <button onClick={() => setEditingQuestion(q)} className="w-11 h-11 rounded-2xl bg-slate-700/50 text-game-primary flex items-center justify-center hover:bg-game-primary hover:text-slate-900 transition-all border border-white/5"><i className="fas fa-edit"></i></button>
                  <button onClick={() => handleDeleteQuestion(q.id)} className="w-11 h-11 rounded-2xl bg-slate-700/50 text-game-danger flex items-center justify-center hover:bg-game-danger hover:text-white transition-all border border-white/5"><i className="fas fa-trash"></i></button>
               </div>
            </div>
          </div>
        ))}
        {questions.length === 0 && <div className="text-center py-24 text-slate-600 font-black uppercase tracking-widest border-2 border-dashed border-slate-800 rounded-[2.5rem]">Select a Chapter to view content</div>}
      </div>

      <button className="fixed bottom-28 right-6 w-16 h-16 bg-game-primary rounded-full flex items-center justify-center text-slate-900 text-3xl shadow-[0_10px_40px_rgba(249,115,22,0.4)] z-[40] active:scale-90 transition-transform border-4 border-white/10"><i className="fas fa-plus"></i></button>
    </div>
  );

  const ArenaView = () => (
    <div className="space-y-6 animate__animated animate__fadeIn">
      <div className="bg-game-primary p-7 rounded-[2.5rem] shadow-2xl shadow-game-primary/20 relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-4 opacity-10"><i className="fas fa-chart-line text-9xl"></i></div>
         <div className="relative z-10 flex justify-between items-center">
            <div>
               <div className="text-slate-900/60 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Live Server State</div>
               <div className="text-4xl font-black text-white italic tracking-tighter">OPTIMAL</div>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-[1.5rem] flex items-center justify-center text-white backdrop-blur-md border border-white/30"><i className="fas fa-signal text-2xl animate-pulse"></i></div>
         </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
         <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700/50">
            <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Active</div>
            <div className="text-3xl font-black text-white">{matches.length} <span className="text-sm text-slate-600 font-bold uppercase ml-1">rooms</span></div>
         </div>
         <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700/50">
            <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Latency</div>
            <div className="text-3xl font-black text-game-primary">24<span className="text-sm font-bold uppercase ml-1">ms</span></div>
         </div>
      </div>

      <div className="flex justify-between items-center px-1">
         <h3 className="text-white font-black uppercase tracking-tighter text-lg">Real-time Arena Feed</h3>
         <span className="text-[9px] font-black text-game-success uppercase bg-game-success/10 px-3 py-1.5 rounded-full border border-game-success/20 flex items-center gap-2 shadow-sm"><i className="fas fa-circle text-[6px] animate-pulse"></i> LIVE SYNC</span>
      </div>

      <div className="space-y-4 pb-4">
        {matches.map(m => {
           const pIds = Object.keys(m.players || {});
           return (
            <div key={m.matchId} className="bg-slate-800/40 p-6 rounded-[2.5rem] border border-slate-700/50 relative overflow-hidden group hover:border-slate-600 transition-colors">
               <div className="absolute top-0 left-0 w-24 h-1.5 bg-game-primary rounded-full"></div>
               <div className="flex justify-between items-start mb-5">
                  <div>
                    <h4 className="text-lg font-black text-white italic uppercase tracking-tight">{m.subjectTitle || 'Battle Arena'} <span className="text-game-primary ml-1">#{String(m.matchId).substring(6,9)}</span></h4>
                    <div className="text-slate-500 text-[9px] font-bold uppercase mt-1 tracking-widest">Duration: 12:45 • Region: Somali-1</div>
                  </div>
                  <span className="bg-game-primary/10 text-game-primary text-[9px] font-black px-3 py-1.5 rounded-xl border border-game-primary/20 uppercase tracking-[0.2em]">Ranked</span>
               </div>
               
               <div className="flex items-center gap-4 mb-8">
                  <div className="flex -space-x-3.5">
                    {pIds.map(uid => (
                      <Avatar key={uid} src={m.players[uid].avatar} size="sm" className="border-2 border-slate-900 shadow-xl" />
                    ))}
                  </div>
                  <div className="text-[11px] text-slate-400 font-bold ml-2 italic">{m.players[pIds[0]]?.name}, {m.players[pIds[1]]?.name || 'Waiting...'}</div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => navigate(`/game/${m.matchId}`)} className="bg-slate-700/40 text-game-primary py-3.5 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-game-primary hover:text-slate-950 transition-all border border-white/5 active:scale-95 shadow-lg shadow-black/20"><i className="fas fa-eye"></i> Spectate</button>
                  <button onClick={() => terminateMatch(m.matchId)} className="bg-game-danger/10 text-game-danger py-3.5 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-game-danger hover:text-white transition-all border border-white/5 active:scale-95 shadow-lg shadow-black/20"><i className="fas fa-ban"></i> Terminate</button>
               </div>
            </div>
           )
        })}
        {matches.length === 0 && <div className="text-center py-20 text-slate-600 font-black uppercase tracking-widest">No active matches found</div>}
      </div>
    </div>
  );

  const ReportsView = () => (
    <div className="space-y-6 animate__animated animate__fadeIn">
      <div className="grid grid-cols-2 gap-4">
         <div className="bg-[#1e293b] p-7 rounded-[2.5rem] border border-slate-700/50 shadow-inner">
            <div className="text-slate-500 text-[10px] font-black uppercase mb-1.5 tracking-widest">Pending Flags</div>
            <div className="text-4xl font-black text-white">{reports.length} <span className="text-sm text-game-primary ml-1.5 font-black">+3%</span></div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full mt-5 overflow-hidden border border-white/5"><div className="w-1/3 h-full bg-game-primary rounded-full"></div></div>
         </div>
         <div className="bg-[#1e293b] p-7 rounded-[2.5rem] border border-slate-700/50 shadow-inner">
            <div className="text-slate-500 text-[10px] font-black uppercase mb-1.5 tracking-widest">Top Issue</div>
            <div className="text-2xl font-black text-white italic uppercase tracking-tighter">Inaccurate</div>
            <div className="text-game-primary text-[10px] font-black uppercase mt-2.5 tracking-widest opacity-80">65% of reports</div>
         </div>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 px-1">
         {[
           { id: 'all', label: 'All Flags' },
           { id: 'wrong_answer', label: 'Inaccurate' },
           { id: 'typo', label: 'Typo' },
           { id: 'other', label: 'Inappropriate' }
         ].map(f => (
           <button 
             key={f.id}
             onClick={() => setReportFilter(f.id as any)} 
             className={`px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-xl border-2 shrink-0 ${reportFilter === f.id ? 'bg-game-primary text-slate-950 border-white/20' : 'bg-[#1e293b] text-slate-500 border-transparent hover:border-slate-700'}`}
           >
             {f.label}
           </button>
         ))}
      </div>

      <div className="space-y-4 pb-4">
         {filteredReports.map(r => (
           <div key={r.id} className="bg-slate-800/40 p-6 rounded-[2.5rem] border border-slate-700/50 relative overflow-hidden group">
              <div className="flex justify-between items-start mb-5">
                 <div>
                    <span className="text-game-primary text-[10px] font-black uppercase tracking-[0.2em] bg-game-primary/10 px-2 py-0.5 rounded border border-game-primary/20">#Q-{String(r.questionId).substring(0,4)}</span>
                    <div className="text-slate-500 text-[9px] font-black uppercase mt-2 tracking-widest opacity-80">Chemistry • Grade 12</div>
                 </div>
                 <div className="text-slate-600 text-[9px] font-black uppercase">2 mins ago</div>
              </div>
              
              <div className="flex gap-4 mb-7 bg-[#0f172a]/30 p-4 rounded-3xl border border-white/5">
                 <div className="w-14 h-14 bg-game-danger/10 text-game-danger border border-game-danger/20 rounded-[1.2rem] flex items-center justify-center text-2xl shrink-0 shadow-inner"><i className="fas fa-exclamation-circle"></i></div>
                 <div className="min-w-0">
                    <h4 className="text-white font-black text-base uppercase tracking-tight">{getReasonLabel(r.reason)}</h4>
                    <p className="text-slate-500 italic text-xs leading-relaxed mt-1 truncate">"{r.questionText}"</p>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <button onClick={() => {
                    get(ref(db, `questions/${r.chapterId}/${r.questionId}`)).then(snap => {
                        if(snap.exists()) setEditingQuestion({ id: r.questionId, ...snap.val(), subject: r.chapterId });
                    });
                 }} className="bg-game-primary/10 text-game-primary py-3.5 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 border border-game-primary/20 hover:bg-game-primary hover:text-slate-950 transition-all shadow-lg active:scale-95"><i className="fas fa-list-check"></i> Review & Fix</button>
                 <button onClick={() => remove(ref(db, `reports/${r.id}`))} className="bg-slate-700/30 text-slate-500 py-3.5 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 border border-slate-700/50 hover:bg-slate-700 hover:text-white transition-all shadow-lg active:scale-95"><i className="fas fa-times"></i> Dismiss</button>
              </div>
           </div>
         ))}
         {filteredReports.length === 0 && <div className="text-center py-28 text-slate-700 font-black uppercase tracking-widest italic opacity-50">No reports requiring review</div>}
      </div>
    </div>
  );

  const SettingsView = () => (
    <div className="space-y-6 animate__animated animate__fadeIn">
      <div className="flex items-center gap-4 px-1">
         <div className="w-14 h-14 bg-game-primary rounded-2xl flex items-center justify-center text-slate-950 text-2xl shadow-xl shadow-game-primary/20"><i className="fas fa-smile"></i></div>
         <h2 className="text-white font-black text-2xl uppercase tracking-tighter italic">Reaction Settings</h2>
      </div>

      {/* Emoji Grid */}
      <section className="space-y-4">
        <div className="flex justify-between items-center px-1 pt-2">
          <h3 className="text-white font-black text-lg uppercase tracking-tight">Active Wheel Emojis</h3>
          <span className="text-game-primary text-[10px] font-black uppercase tracking-widest bg-game-primary/10 px-3 py-1 rounded-full border border-game-primary/20">{emojis.length}/8</span>
        </div>
        <div className="grid grid-cols-4 gap-4">
           {emojis.map(e => (
             <div key={e.id} className="aspect-square bg-[#1e293b] rounded-[1.8rem] border border-slate-700/50 flex items-center justify-center text-3xl relative group shadow-lg hover:border-game-primary transition-all">
                {e.value}
                <button onClick={() => remove(ref(db, `settings/reactions/emojis/${e.id}`))} className="absolute -top-1.5 -right-1.5 w-7 h-7 bg-game-danger text-white rounded-full text-[10px] flex items-center justify-center shadow-2xl transform scale-0 group-hover:scale-100 transition-transform active:scale-90 border-2 border-slate-900"><i className="fas fa-times"></i></button>
             </div>
           ))}
           {emojis.length < 8 && (
             <button className="aspect-square border-2 border-dashed border-slate-700 rounded-[1.8rem] flex items-center justify-center text-slate-700 text-2xl hover:border-game-primary hover:text-game-primary transition-all active:scale-95"><i className="fas fa-plus"></i></button>
           )}
        </div>
      </section>

      {/* PTT Messages */}
      <section className="space-y-4">
        <h3 className="text-white font-black text-lg uppercase tracking-tight px-1 pt-4">PTT Quick Chat Phrases</h3>
        <div className="space-y-3">
          {pttMessages.map(m => (
            <div key={m.id} className="bg-[#1e293b] p-5 rounded-[1.5rem] border border-slate-700/50 flex items-center justify-between group shadow-lg hover:border-slate-600 transition-colors">
               <div className="flex items-center gap-4">
                  <i className="fas fa-grip-vertical text-slate-800 cursor-move"></i>
                  <span className="text-white font-bold text-sm tracking-tight">{m.value}</span>
               </div>
               <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="w-9 h-9 flex items-center justify-center bg-game-primary/10 text-game-primary rounded-xl border border-game-primary/20 hover:bg-game-primary hover:text-slate-950 transition-all active:scale-90"><i className="fas fa-pencil-alt text-xs"></i></button>
                  <button onClick={() => remove(ref(db, `settings/reactions/messages/${m.id}`))} className="w-9 h-9 flex items-center justify-center bg-game-danger/10 text-game-danger rounded-xl border border-game-danger/20 hover:bg-game-danger hover:text-white transition-all active:scale-90"><i className="fas fa-trash text-xs"></i></button>
               </div>
            </div>
          ))}
          <button className="w-full py-5 border-2 border-dashed border-slate-700 rounded-[1.5rem] flex items-center justify-center gap-3 text-game-primary font-black text-xs uppercase tracking-[0.2em] hover:border-game-primary/50 hover:bg-game-primary/5 transition-all active:scale-[0.98]">
            <i className="fas fa-plus-circle"></i> New Phrase
          </button>
        </div>
      </section>

      <div className="pt-6 pb-4 flex flex-col items-center">
        <Button fullWidth className="!bg-game-primary !py-5 shadow-[0_15px_40px_rgba(249,115,22,0.2)] rounded-[2rem] text-slate-950 font-black italic tracking-widest" onClick={handleSeedDefaults}>
           <i className="fas fa-database mr-3"></i> Load Somali Defaults
        </Button>
        <p className="text-center text-slate-600 text-[8px] mt-6 font-black uppercase tracking-[0.3em] max-w-[280px] leading-relaxed opacity-50">Note: Defaults overwrite current PTT data and sync to active match clients instantly.</p>
      </div>
    </div>
  );

  const getReasonLabel = (reason: string) => {
    const map: any = { wrong_answer: 'Incorrect Answer Key', typo: 'Typo in Question', other: 'Inappropriate Content' };
    return map[reason] || reason;
  };

  // --- MAIN RENDER ---

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-6 font-sans">
        <div className="w-full max-w-md bg-[#0f172a] border border-slate-800 p-10 rounded-[3.5rem] shadow-[0_0_80px_rgba(249,115,22,0.1)] relative overflow-hidden">
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-game-primary rounded-full blur-[100px] opacity-10"></div>
          
          <div className="text-center mb-10 relative z-10">
            <div className="w-24 h-24 bg-[#1e293b] rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-white/5 shadow-2xl group active:scale-95 transition-all">
              <i className="fas fa-shield-halved text-5xl text-game-primary group-hover:scale-110 transition-transform duration-500"></i>
            </div>
            <h1 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter italic drop-shadow-md">Command Center</h1>
            <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.4em] opacity-80">Access Restricted Area</p>
          </div>
          
          <form onSubmit={checkPin} className="relative z-10">
            <div className="relative mb-8 group">
              <i className="fas fa-lock absolute left-6 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-game-primary transition-colors"></i>
              <input 
                  type="password" 
                  placeholder="PIN" 
                  value={pin} 
                  onChange={e => setPin(e.target.value)}
                  className="w-full bg-[#020617] border-2 border-slate-800 rounded-[1.5rem] py-6 text-center text-3xl tracking-[0.8em] font-mono text-game-primary focus:ring-4 focus:ring-game-primary/10 focus:border-game-primary outline-none transition-all placeholder:text-slate-900 shadow-inner"
                  autoFocus
              />
            </div>
            <Button fullWidth className="!bg-game-primary !py-6 shadow-[0_20px_50px_rgba(249,115,22,0.2)] rounded-[1.8rem] font-black text-xl italic text-slate-950 active:scale-95">AUTHENTICATE</Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans transition-colors overflow-hidden select-none">
        {/* Header Dashboard Style */}
        <header className="px-6 py-10 flex items-center justify-between z-[50]">
            <div className="flex items-center gap-4">
                <div className="relative">
                   <div className="absolute inset-0 bg-game-primary rounded-full blur-xl opacity-20 animate-pulse"></div>
                   <Avatar src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" size="sm" className="border-game-primary ring-4 ring-game-primary/10 shadow-2xl relative z-10" />
                </div>
                <div>
                   <div className="text-slate-600 text-[10px] font-black uppercase tracking-[0.3em] mb-0.5">Control Panel</div>
                   <h1 className="text-2xl font-black text-white tracking-tighter italic">Hi, Admin LP</h1>
                </div>
            </div>
            <div className="relative">
               <button className="w-14 h-14 bg-[#1e293b] border border-white/5 rounded-2xl flex items-center justify-center text-slate-500 hover:text-white transition-all shadow-xl active:scale-90">
                  <i className="fas fa-bell text-xl"></i>
               </button>
               {reports.length > 0 && (
                 <span className="absolute -top-1 -right-1 w-5 h-5 bg-game-danger rounded-full border-[3px] border-slate-950 flex items-center justify-center text-[8px] font-black text-white shadow-lg animate-bounce">
                    {reports.length}
                 </span>
               )}
            </div>
        </header>

        {/* Scroll Content Area */}
        <main className="flex-1 overflow-y-auto px-6 pb-40 pt-2 custom-scrollbar relative z-10">
            {activeTab === 'home' && <HomeView />}
            {activeTab === 'users' && <UsersView />}
            {activeTab === 'quizzes' && <QuizzesView />}
            {activeTab === 'arena' && <ArenaView />}
            {activeTab === 'reports' && <ReportsView />}
            {activeTab === 'social' && <SettingsView />}
        </main>

        {/* Bottom Tab Bar High Fidelity */}
        <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-slate-900/90 backdrop-blur-2xl border-t border-white/5 p-4 pb-8">
           <div className="max-w-md mx-auto flex items-center justify-between px-3">
              {[
                  { id: 'home', icon: 'fa-th-large', label: 'Home' },
                  { id: 'users', icon: 'fa-user-group', label: 'Users' },
                  { id: 'quizzes', icon: 'fa-question-circle', label: 'Quizzes' },
                  { id: 'arena', icon: 'fa-bolt', label: 'Arena' },
                  { id: 'social', icon: 'fa-smile', label: 'Social' }
              ].map(item => (
                <button 
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`flex flex-col items-center gap-1.5 transition-all duration-500 ${activeTab === item.id ? 'text-game-primary' : 'text-slate-600 hover:text-slate-400'}`}
                >
                  <div className={`w-14 h-14 flex items-center justify-center rounded-[1.2rem] transition-all relative ${activeTab === item.id ? 'bg-game-primary/10 shadow-[inset_0_0_15px_rgba(249,115,22,0.1)] border border-game-primary/20' : ''}`}>
                    <i className={`fas ${item.icon} ${activeTab === item.id ? 'text-2xl drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]' : 'text-xl'}`}></i>
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${activeTab === item.id ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>{item.label}</span>
                </button>
              ))}
           </div>
        </nav>

        {/* Sync Indicator Overlay */}
        <div className="fixed bottom-32 left-0 right-0 flex justify-center pointer-events-none opacity-30 select-none z-0">
           <div className="bg-slate-900/40 px-6 py-2.5 rounded-full border border-white/5 flex items-center gap-3 backdrop-blur-md">
              <span className="w-1.5 h-1.5 bg-game-success rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></span>
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em]">Live Database Connection</span>
           </div>
        </div>

        {/* MODAL: Question Editor */}
        {editingQuestion && (
            <Modal isOpen={true} title="Secure Editor" onClose={() => setEditingQuestion(null)}>
                <div className="space-y-6 pt-2 pb-2">
                    <Input 
                        label="Question Content" 
                        value={editingQuestion.question} 
                        onChange={(e) => setEditingQuestion({...editingQuestion, question: e.target.value})}
                        className="!bg-[#0f172a] !border-slate-800 !text-white !p-5 !rounded-2xl"
                    />
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Options (Tap letter to set correct)</label>
                        {editingQuestion.options.map((opt, idx) => (
                            <div key={idx} className="flex gap-3">
                                <button 
                                  onClick={() => setEditingQuestion({...editingQuestion, answer: idx})}
                                  className={`w-12 h-12 rounded-xl flex items-center justify-center font-black transition-all border-2 ${editingQuestion.answer === idx ? 'bg-game-primary border-white/20 text-slate-950 shadow-lg shadow-game-primary/30' : 'bg-[#0f172a] border-slate-800 text-slate-600'}`}
                                >
                                  {String.fromCharCode(65+idx)}
                                </button>
                                <input 
                                    value={opt}
                                    onChange={(e) => {
                                        const newOpts = [...editingQuestion.options];
                                        newOpts[idx] = e.target.value;
                                        setEditingQuestion({...editingQuestion, options: newOpts});
                                    }}
                                    className="flex-1 bg-[#0f172a] border-2 border-slate-800 rounded-xl px-5 py-3 text-white font-bold focus:border-game-primary outline-none transition-colors"
                                />
                            </div>
                        ))}
                    </div>
                    <div className="pt-6 flex gap-4">
                         <Button fullWidth variant="outline" onClick={() => setEditingQuestion(null)} className="!border-slate-800 !text-slate-500 !rounded-2xl">Cancel</Button>
                         <Button fullWidth onClick={handleUpdateQuestion} className="!bg-game-primary !text-slate-950 !rounded-2xl shadow-xl shadow-game-primary/20">Sync Changes</Button>
                    </div>
                </div>
            </Modal>
        )}
    </div>
  );
};

export default SuperAdminPage;