
import React, { useEffect, useState, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, onValue, update, onDisconnect, get, set, remove, serverTimestamp, push } from 'firebase/database';
import { db } from '../firebase';
import { UserContext } from '../contexts';
import { POINTS_PER_QUESTION } from '../constants';
import { MatchState, Question, Chapter, UserProfile, MatchReaction } from '../types';
import { Avatar, Button, Card, Modal } from '../components/UI';
import { playSound } from '../services/audioService';
import { showToast, showConfirm } from '../services/alert';
import confetti from 'canvas-confetti';
import Swal from 'sweetalert2';

const REACTION_EMOJIS = ['😂', '😡', '👏', '😱', '🥲', '🔥', '🏆', '🤯'];
const REACTION_MESSAGES = ['Nasiib wacan!', 'Aad u fiican', 'Iska jir!', 'Hala soo baxo!', 'Mahadsanid'];

const createSeededRandom = (seedStr: string) => {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
        hash = ((hash << 5) - hash) + seedStr.charCodeAt(i);
        hash |= 0;
    }
    let seed = Math.abs(hash);
    return () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
};

const shuffleArraySeeded = <T,>(array: T[], rng: () => number): T[] => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
};

const GamePage: React.FC = () => {
  const { matchId } = useParams();
  const { user, profile } = useContext(UserContext);
  const navigate = useNavigate();

  const [match, setMatch] = useState<MatchState | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjectName, setSubjectName] = useState('');
  
  const [leftProfile, setLeftProfile] = useState<UserProfile | null>(null);
  const [rightProfile, setRightProfile] = useState<UserProfile | null>(null);
  const [isSpectator, setIsSpectator] = useState(false);

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState<{correct: boolean, answer: number} | null>(null);
  
  const [showIntro, setShowIntro] = useState(false);
  const [introShownOnce, setIntroShownOnce] = useState(false);
  const [showSpectatorList, setShowSpectatorList] = useState(false);
  
  const [showReactionMenu, setShowReactionMenu] = useState(false);
  const [activeReactions, setActiveReactions] = useState<{id: number, senderId: string, value: string, avatar?: string, name?: string}[]>([]);
  const reactionCounter = useRef(0);
  const lastProcessedReactionTime = useRef(0);

  const [isLoadingError, setIsLoadingError] = useState(false);
  
  const processingRef = useRef(false);
  const questionsLoadedRef = useRef(false);

  // 1. Sync Match Data
  useEffect(() => {
    if (!matchId || !user) return;
    const matchRef = ref(db, `matches/${matchId}`);

    const unsubscribe = onValue(matchRef, async (snapshot) => {
      const data = snapshot.val() as MatchState;
      if (!data) {
        if (!profile?.isSupport) set(ref(db, `users/${user.uid}/activeMatch`), null);
        navigate(profile?.isSupport ? '/support' : '/');
        return;
      }
      setMatch(data);

      if (data.lastReaction && data.lastReaction.timestamp > lastProcessedReactionTime.current) {
          lastProcessedReactionTime.current = data.lastReaction.timestamp;
          triggerReactionAnimation(data.lastReaction);
      }

      const pIds = Object.keys(data.players || {});
      const userIsPlayer = pIds.includes(user.uid);
      setIsSpectator(!userIsPlayer);

      if (data.status === 'completed' && data.winner) {
          if (data.winner === user.uid) { 
              playSound('win'); 
              confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); 
          } else if (data.winner !== 'draw' && userIsPlayer) {
              playSound('wrong');
          }
      }
    });
    return () => unsubscribe();
  }, [matchId, user, navigate]); 

  // 2. Presence & Spectator Logic
  useEffect(() => {
      if (!matchId || !user || !profile || !match) return;
      const pIds = Object.keys(match.players || {});
      const userIsPlayer = pIds.includes(user.uid);

      if (userIsPlayer) {
          const myStatusRef = ref(db, `matches/${matchId}/players/${user.uid}`);
          update(myStatusRef, { status: 'online', lastSeen: serverTimestamp(), level: Math.floor((profile.points || 0) / 10) + 1 });
          const disconnectRef = onDisconnect(myStatusRef);
          disconnectRef.update({ status: 'offline', lastSeen: serverTimestamp() });
          return () => { disconnectRef.cancel(); };
      } else {
          const specRef = ref(db, `matches/${matchId}/spectators/${user.uid}`);
          set(specRef, { name: profile.name, avatar: profile.avatar });
          const discRef = onDisconnect(specRef);
          discRef.remove();
          return () => { remove(specRef); discRef.cancel(); };
      }
  }, [matchId, user, profile, match?.matchId]);

  // 3. Load Player Profiles
  useEffect(() => {
      if (!match) return;
      const loadProfiles = async () => {
          const pIds = Object.keys(match.players || {});
          if (pIds.length >= 2) {
              const [p1Snap, p2Snap] = await Promise.all([
                  get(ref(db, `users/${pIds[0]}`)),
                  get(ref(db, `users/${pIds[1]}`))
              ]);
              if (p1Snap.exists()) setLeftProfile({ uid: pIds[0], ...p1Snap.val() });
              if (p2Snap.exists()) setRightProfile({ uid: pIds[1], ...p2Snap.val() });
          }
      };
      loadProfiles();
  }, [match?.players]);

  // 4. Load Questions
  useEffect(() => {
      if (!match || questions.length > 0 || questionsLoadedRef.current) return;
      loadQuestions();
  }, [match?.subject, match?.matchId]);

  const loadQuestions = async () => {
      if (!match) return;
      questionsLoadedRef.current = true;
      setIsLoadingError(false);
      try {
        if (match.subjectTitle) setSubjectName(match.subjectTitle);
        let loadedQ: Question[] = [];
        if (match.subject.startsWith('ALL_')) {
            const subjectId = match.subject.replace('ALL_', '');
            const chaptersSnap = await get(ref(db, `chapters/${subjectId}`));
            if (chaptersSnap.exists()) {
                const chapters = Object.values(chaptersSnap.val()) as Chapter[];
                const snaps = await Promise.all(chapters.map(c => get(ref(db, `questions/${c.id}`))));
                snaps.forEach(s => { if (s.exists()) Object.keys(s.val()).forEach(k => loadedQ.push({...s.val()[k], id: k})); });
            }
        } else {
            const snap = await get(ref(db, `questions/${match.subject}`));
            if(snap.exists()) Object.keys(snap.val()).forEach(k => loadedQ.push({...snap.val()[k], id: k}));
        }

        if (loadedQ.length > 0) {
            const rng = createSeededRandom(match.matchId);
            let shuffledQ = shuffleArraySeeded(loadedQ, rng).map(q => {
                const opts = q.options.map((o, i) => ({ t: o, c: i === q.answer }));
                const sOpts = shuffleArraySeeded(opts, rng);
                return { ...q, options: sOpts.map(o => o.t), answer: sOpts.findIndex(o => o.c) };
            });
            setQuestions(shuffledQ.slice(0, match.questionLimit || 10));
        } else {
            setIsLoadingError(true);
        }
      } catch(e) { setIsLoadingError(true); }
  };

  useEffect(() => {
      if (!introShownOnce && questions.length > 0 && leftProfile && rightProfile && !isSpectator) {
          setShowIntro(true); setIntroShownOnce(true); playSound('click');
          setTimeout(() => setShowIntro(false), 3500);
      }
  }, [questions.length, leftProfile, rightProfile, isSpectator]);

  const triggerReactionAnimation = (reaction: MatchReaction) => {
    const id = ++reactionCounter.current;
    setActiveReactions(prev => [...prev.filter(r => r.senderId !== reaction.senderId), { id, ...reaction, value: reaction.value, avatar: reaction.senderAvatar, name: reaction.senderName }]);
    playSound('reaction');
    setTimeout(() => setActiveReactions(prev => prev.filter(r => r.id !== id)), 4000);
  };

  const sendReaction = async (val: string) => {
      if (!user || !matchId) return;
      setShowReactionMenu(false);
      playSound('click');
      await update(ref(db, `matches/${matchId}`), {
          lastReaction: { senderId: user.uid, value: val, timestamp: Date.now(), senderAvatar: profile?.avatar, senderName: profile?.name }
      });
  };

  const handleOptionClick = async (index: number) => {
    if (isSpectator || !match || !user || match.turn !== user.uid || selectedOption !== null || processingRef.current) return;
    const currentScores = match.scores || {};
    setSelectedOption(index);
    processingRef.current = true;
    const isCorrect = index === questions[match.currentQ].answer;
    isCorrect ? playSound('correct') : playSound('wrong');
    setShowFeedback({ correct: isCorrect, answer: questions[match.currentQ].answer });

    setTimeout(async () => {
        const oppUid = Object.keys(currentScores).find(uid => uid !== user.uid) || '';
        const newScores = { ...currentScores };
        if (isCorrect) newScores[user.uid] = (newScores[user.uid] || 0) + POINTS_PER_QUESTION;

        const currentAnswers = match.answersCount || 0;
        if (currentAnswers >= 1) {
            if (match.currentQ >= questions.length - 1) {
                let winner = 'draw';
                if (newScores[user.uid] > (newScores[oppUid]||0)) winner = user.uid;
                else if ((newScores[oppUid]||0) > newScores[user.uid]) winner = oppUid;

                const myPtsRef = ref(db, `users/${user.uid}/points`);
                const myPts = (await get(myPtsRef)).val() || 0;
                await update(ref(db, `users/${user.uid}`), { points: myPts + (newScores[user.uid]||0), activeMatch: null });
                if (oppUid) {
                    const oppPts = (await get(ref(db, `users/${oppUid}/points`))).val() || 0;
                    await update(ref(db, `users/${oppUid}`), { points: oppPts + (newScores[oppUid]||0), activeMatch: null });
                }
                await update(ref(db, `matches/${matchId}`), { scores: newScores, status: 'completed', winner, answersCount: 2 });
                return;
            }
            await update(ref(db, `matches/${matchId}`), { scores: newScores, currentQ: match.currentQ + 1, turn: oppUid, answersCount: 0 });
        } else {
            await update(ref(db, `matches/${matchId}`), { scores: newScores, turn: oppUid, answersCount: 1 });
        }
        setSelectedOption(null); setShowFeedback(null); processingRef.current = false;
    }, 1500); 
  };

  const handleLeave = async () => {
      if(!user || !matchId) return;
      if (!isSpectator && match?.status === 'completed') try { await remove(ref(db, `matches/${matchId}`)); } catch(e) {}
      if (!isSpectator) await set(ref(db, `users/${user.uid}/activeMatch`), null);
      navigate(profile?.isSupport ? '/support' : '/');
  };

  const handleReport = async () => {
      const currentQ = questions[match?.currentQ || 0];
      if (!currentQ || !user) return;
      const { value: reason } = await Swal.fire({
          title: 'Report Question',
          input: 'select',
          inputOptions: { 'wrong_answer': 'Jawaabta ayaa qaldan', 'typo': 'Qoraal ayaa qaldan', 'other': 'Sabab kale' },
          inputPlaceholder: 'Dooro sababta...',
          showCancelButton: true,
          confirmButtonText: 'Dir',
          customClass: { popup: 'glass-swal-popup' }
      });
      if (reason) {
          const reportRef = push(ref(db, 'reports'));
          await set(reportRef, { id: reportRef.key, questionId: currentQ.id, chapterId: match?.subject || 'unknown', reason, reporterUid: user.uid, timestamp: serverTimestamp(), questionText: currentQ.question });
          showToast("Waad ku mahadsantahay!", "success");
      }
  };

  if (!match || !leftProfile || !rightProfile) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-black animate-pulse">LOADING BATTLE...</div>;

  const currentQuestion = questions[match.currentQ];
  const isGameOver = match.status === 'completed';
  const winnerUid = match.winner;
  const isMyTurn = match.turn === user?.uid;
  const leftIsActive = match.turn === leftProfile.uid;
  const rightIsActive = match.turn === rightProfile.uid;
  const spectatorCount = Object.keys(match.spectators || {}).length;

  return (
    <div className="min-h-screen relative flex flex-col font-sans overflow-hidden transition-colors pt-20 bg-slate-50 dark:bg-slate-950">
       
       {/* INTRO VS SCREEN */}
       {showIntro && (
          <div className="fixed inset-0 z-[100] flex flex-col md:flex-row items-center justify-center bg-slate-900 overflow-hidden">
              <div className="w-full md:w-1/2 h-1/2 md:h-full bg-orange-500 relative flex items-center justify-center animate__animated animate__slideInLeft">
                  <div className="text-center z-10">
                      <Avatar src={leftProfile.avatar} size="xl" className="border-4 border-white mb-4 mx-auto" isVerified={leftProfile.isVerified} isSupport={leftProfile.isSupport} />
                      <h2 className="text-3xl font-black text-white uppercase italic drop-shadow-lg">{leftProfile.name}</h2>
                      <div className="inline-block bg-black/30 px-3 py-1 rounded-full text-white font-bold mt-2">LVL {Math.floor(leftProfile.points/10)+1}</div>
                  </div>
              </div>
              <div className="absolute z-20 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate__animated animate__zoomIn animate__delay-1s">
                  <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center border-4 border-slate-900 shadow-2xl">
                      <span className="font-black text-4xl italic text-slate-900">VS</span>
                  </div>
              </div>
              <div className="w-full md:w-1/2 h-1/2 md:h-full bg-indigo-600 relative flex items-center justify-center animate__animated animate__slideInRight">
                  <div className="text-center z-10">
                      <Avatar src={rightProfile.avatar} size="xl" className="border-4 border-white mb-4 mx-auto" isVerified={rightProfile.isVerified} isSupport={rightProfile.isSupport} />
                      <h2 className="text-3xl font-black text-white uppercase italic drop-shadow-lg">{rightProfile.name}</h2>
                      <div className="inline-block bg-black/30 px-3 py-1 rounded-full text-white font-bold mt-2">LVL {Math.floor(rightProfile.points/10)+1}</div>
                  </div>
              </div>
          </div>
       )}

       {/* HEADER SCOREBOARD */}
       <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shadow-lg p-3">
          <div className="max-w-4xl mx-auto flex justify-between items-center px-2">
             <div className={`flex items-center gap-2 transition-all ${leftIsActive && !isGameOver ? 'scale-105' : 'opacity-70 grayscale-[50%]'}`}>
                <div className="relative">
                    <Avatar src={leftProfile.avatar} size="sm" isVerified={leftProfile.isVerified} isSupport={leftProfile.isSupport} />
                    {activeReactions.filter(r => r.senderId === leftProfile.uid).map(r => (
                        <div key={r.id} className="absolute -bottom-12 left-0 z-50 animate__animated animate__bounceIn">
                            <div className="bg-white dark:bg-slate-800 px-3 py-1 rounded-2xl shadow-2xl border-2 border-orange-500 whitespace-nowrap">
                                <span className="text-2xl">{r.value}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div>
                    <div className="text-[10px] font-black uppercase text-slate-500 truncate max-w-[70px]">{leftProfile.name}</div>
                    <div className="text-xl font-black text-orange-500 leading-none">{match.scores[leftProfile.uid] || 0}</div>
                </div>
             </div>

             <div className="flex flex-col items-center">
                 <div className="text-lg font-black text-slate-800 dark:text-white italic tracking-tighter">VS</div>
                 <button onClick={() => setShowSpectatorList(true)} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-green-600 animate-pulse border border-green-200 dark:border-green-900">
                    <i className="fas fa-eye"></i> {spectatorCount}
                 </button>
             </div>

             <div className={`flex items-center gap-2 flex-row-reverse text-right transition-all ${rightIsActive && !isGameOver ? 'scale-105' : 'opacity-70 grayscale-[50%]'}`}>
                <div className="relative">
                    <Avatar src={rightProfile.avatar} size="sm" isVerified={rightProfile.isVerified} isSupport={rightProfile.isSupport} />
                    {activeReactions.filter(r => r.senderId === rightProfile.uid).map(r => (
                        <div key={r.id} className="absolute -bottom-12 right-0 z-50 animate__animated animate__bounceIn">
                            <div className="bg-white dark:bg-slate-800 px-3 py-1 rounded-2xl shadow-2xl border-2 border-indigo-500 whitespace-nowrap">
                                <span className="text-2xl">{r.value}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div>
                    <div className="text-[10px] font-black uppercase text-slate-500 truncate max-w-[70px]">{rightProfile.name}</div>
                    <div className="text-xl font-black text-indigo-500 leading-none">{match.scores[rightProfile.uid] || 0}</div>
                </div>
             </div>
          </div>
       </div>

       {/* MAIN GAME AREA */}
       <div className="flex-1 flex flex-col items-center justify-center p-4 w-full max-w-3xl mx-auto z-10">
          {isGameOver ? (
            /* REDESIGNED LUXURY RESULT CARD */
            <div className="w-full max-w-lg animate__animated animate__zoomIn">
                <Card className="!p-0 overflow-hidden border-none shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-white dark:bg-slate-800 rounded-[3rem]">
                    <div className={`py-12 px-6 relative text-center overflow-hidden ${winnerUid === user?.uid ? 'bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600' : winnerUid === 'draw' ? 'bg-slate-700' : 'bg-gradient-to-br from-slate-700 to-slate-900'}`}>
                        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                        <div className="relative z-10">
                            <div className="inline-block px-4 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black text-white uppercase tracking-[0.2em] mb-3">Battle Concluded</div>
                            <h1 className="text-6xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg">
                                {winnerUid === user?.uid ? 'VICTORY' : winnerUid === 'draw' ? 'DRAW' : 'DEFEAT'}
                            </h1>
                            <p className="text-white/80 font-bold mt-2 text-sm uppercase tracking-widest">{subjectName}</p>
                        </div>
                    </div>

                    <div className="p-10">
                        <div className="flex justify-between items-center mb-12 gap-4">
                            <div className="flex-1 flex flex-col items-center">
                                <div className="relative mb-3">
                                    <Avatar src={leftProfile.avatar} size="lg" className={`border-4 ${winnerUid === leftProfile.uid ? 'border-yellow-400 ring-4 ring-yellow-400/20 scale-110' : 'border-slate-100 dark:border-slate-700'}`} isVerified={leftProfile.isVerified} isSupport={leftProfile.isSupport} />
                                    {winnerUid === leftProfile.uid && <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-4xl animate-bounce">👑</div>}
                                </div>
                                <div className="text-center">
                                    <div className="font-black text-slate-800 dark:text-white uppercase text-xs truncate max-w-[90px]">You</div>
                                    <div className="text-4xl font-black text-orange-500">{match.scores[leftProfile.uid] || 0}</div>
                                </div>
                            </div>
                            <div className="text-slate-200 dark:text-slate-600 font-black text-3xl italic px-4">VS</div>
                            <div className="flex-1 flex flex-col items-center">
                                <div className="relative mb-3">
                                    <Avatar src={rightProfile.avatar} size="lg" className={`border-4 ${winnerUid === rightProfile.uid ? 'border-yellow-400 ring-4 ring-yellow-400/20 scale-110' : 'border-slate-100 dark:border-slate-700'}`} isVerified={rightProfile.isVerified} isSupport={rightProfile.isSupport} />
                                    {winnerUid === rightProfile.uid && <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-4xl animate-bounce">👑</div>}
                                </div>
                                <div className="text-center">
                                    <div className="font-black text-slate-800 dark:text-white uppercase text-xs truncate max-w-[90px]">{rightProfile.name.split(' ')[0]}</div>
                                    <div className="text-4xl font-black text-indigo-500">{match.scores[rightProfile.uid] || 0}</div>
                                </div>
                            </div>
                        </div>

                        {!isSpectator && (
                            <div className="grid grid-cols-2 gap-4 mb-10">
                                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-700 flex flex-col items-center">
                                    <span className="text-[10px] font-black text-slate-400 uppercase mb-1">XP Gained</span>
                                    <div className="flex items-center gap-2">
                                        <i className="fas fa-bolt text-orange-500"></i>
                                        <span className="text-3xl font-black text-slate-800 dark:text-white">+{match.scores[user?.uid||''] || 0}</span>
                                    </div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-700 flex flex-col items-center">
                                    <span className="text-[10px] font-black text-slate-400 uppercase mb-1">Current Level</span>
                                    <div className="flex items-center gap-2">
                                        <i className="fas fa-star text-yellow-500"></i>
                                        <span className="text-3xl font-black text-slate-800 dark:text-white">{Math.floor((profile?.points||0)/10)+1}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <Button onClick={handleLeave} size="lg" fullWidth className="py-6 shadow-2xl !rounded-3xl text-xl shadow-orange-500/20">
                            CONTINUE <i className="fas fa-arrow-right ml-2"></i>
                        </Button>
                    </div>
                </Card>
            </div>
          ) : (
            <>
                {/* QUESTION CARD */}
                <div className="relative w-full bg-white dark:bg-slate-800 rounded-[2rem] p-8 shadow-2xl mb-8 min-h-[220px] flex flex-col items-center justify-center text-center border-t-8 border-orange-500 overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    <button onClick={handleReport} className="absolute top-4 right-6 text-slate-300 hover:text-red-500 transition-colors z-30" title="Report Question"><i className="fas fa-flag text-lg"></i></button>
                    <div className="mb-4">
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest border border-slate-200 dark:border-slate-600">
                           <i className="fas fa-layer-group text-orange-500"></i> {subjectName}
                        </span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white leading-tight drop-shadow-sm">
                        {currentQuestion?.question}
                    </h2>
                </div>

                {/* OPTIONS GRID */}
                <div className="relative w-full grid grid-cols-1 gap-4">
                    {!isMyTurn && !isSpectator && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                            <div className="bg-white/95 dark:bg-slate-800/95 px-10 py-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-4 animate__animated animate__fadeIn border border-indigo-500/20">
                                <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                                    <i className="fas fa-hourglass-half text-indigo-500 text-2xl animate-spin"></i>
                                </div>
                                <div className="text-center">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Opponent's Turn</div>
                                    <div className="text-xl font-black text-slate-800 dark:text-white tracking-tight">{rightProfile.name}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentQuestion?.options.map((opt, idx) => {
                        let style = "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200";
                        if (showFeedback) {
                            if (idx === showFeedback.answer) style = "bg-green-500 text-white border-green-500 shadow-lg scale-[1.02]";
                            else if (selectedOption === idx) style = "bg-red-500 text-white border-red-500 opacity-90";
                            else style = "opacity-40 grayscale-[50%]";
                        }
                        return (
                            <button key={idx} disabled={!isMyTurn || selectedOption !== null || isSpectator} onClick={() => handleOptionClick(idx)} className={`w-full p-5 rounded-3xl text-left transition-all duration-200 flex items-center gap-5 border-2 shadow-sm font-bold text-lg ${style}`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 bg-slate-50 dark:bg-slate-700 text-slate-400 ${showFeedback ? 'bg-white/20 text-white' : ''}`}>{String.fromCharCode(65 + idx)}</div>
                                <span className="flex-1 leading-snug">{opt}</span>
                            </button>
                        );
                    })}
                </div>
            </>
          )}
       </div>

       {/* SPECTATOR REACTIONS (FLOATING) */}
       <div className="fixed inset-0 pointer-events-none z-[40]">
           {activeReactions.filter(r => r.senderId !== leftProfile.uid && r.senderId !== rightProfile.uid).map(r => (
               <div key={r.id} className="absolute bottom-40 left-1/2 -translate-x-1/2 animate__animated animate__fadeInUp">
                    <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-1.5 pr-5 rounded-full shadow-2xl border-2 border-orange-500">
                         <Avatar src={r.avatar} size="sm" className="border-2 border-white dark:border-slate-700" />
                         <span className="text-2xl">{r.value}</span>
                    </div>
               </div>
           ))}
       </div>

       {/* REACTION MENU */}
       {!isGameOver && (
          <div className="fixed bottom-24 right-6 z-[60]">
               <button onClick={() => setShowReactionMenu(!showReactionMenu)} className="w-16 h-16 rounded-full bg-white dark:bg-slate-800 shadow-[0_10px_30px_rgba(249,115,22,0.3)] border-4 border-orange-500 text-3xl flex items-center justify-center active:scale-90 transition-transform">
                   <i className={`fas ${showReactionMenu ? 'fa-times text-red-500' : 'fa-smile text-orange-500'}`}></i>
               </button>
               {showReactionMenu && (
                   <div className="absolute bottom-20 right-0 w-72 p-5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-[2rem] shadow-2xl border-2 border-slate-100 dark:border-slate-700 animate__animated animate__bounceIn">
                       <div className="grid grid-cols-4 gap-3 mb-5">
                           {REACTION_EMOJIS.map(emoji => <button key={emoji} onClick={() => sendReaction(emoji)} className="text-3xl hover:scale-125 transition-transform p-1">{emoji}</button>)}
                       </div>
                       <div className="space-y-2 border-t border-slate-100 dark:border-slate-700 pt-4">
                           {REACTION_MESSAGES.map(msg => <button key={msg} onClick={() => sendReaction(msg)} className="w-full text-left px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 text-xs font-black text-slate-600 dark:text-slate-300 uppercase hover:bg-orange-500 hover:text-white transition-colors">{msg}</button>)}
                       </div>
                   </div>
               )}
          </div>
       )}

       {/* SPECTATOR LIST MODAL */}
       <Modal isOpen={showSpectatorList} onClose={() => setShowSpectatorList(false)} title="Spectators">
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {spectatorCount === 0 ? (
                    <div className="text-center py-10 text-slate-400 font-bold">Arena is private.</div>
                ) : (
                    Object.values(match.spectators || {}).map((s: any, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <Avatar src={s.avatar} size="sm" />
                            <span className="font-black text-slate-800 dark:text-white uppercase text-sm tracking-tight">{s.name}</span>
                        </div>
                    ))
                )}
            </div>
            <Button fullWidth onClick={() => setShowSpectatorList(false)} className="mt-8">Close</Button>
       </Modal>
    </div>
  );
};

export default GamePage;
