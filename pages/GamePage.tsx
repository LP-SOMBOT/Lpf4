
import React, { useEffect, useState, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, onValue, update, onDisconnect, get, set, remove, serverTimestamp, push } from 'firebase/database';
import { db } from '../firebase';
import { UserContext } from '../contexts';
import { POINTS_PER_QUESTION } from '../constants';
import { MatchState, Question, Chapter, UserProfile, MatchReaction } from '../types';
import { Avatar, Button, Card, Modal } from '../components/UI';
import { playSound } from '../services/audioService';
import { showToast, showConfirm, showAlert } from '../services/alert';
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

      // Handle Reactions
      if (data.lastReaction && data.lastReaction.timestamp > lastProcessedReactionTime.current) {
          lastProcessedReactionTime.current = data.lastReaction.timestamp;
          triggerReactionAnimation(data.lastReaction);
      }

      // Determine Role - Fix spectator logic
      const pIds = Object.keys(data.players || {});
      const userIsPlayer = pIds.includes(user.uid);
      setIsSpectator(!userIsPlayer);

      // Check Winner
      if (data.status === 'completed' && data.winner) {
          if (data.winner === user.uid) { 
              playSound('win'); 
              confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); 
          }
          else if (data.winner !== 'draw' && userIsPlayer) playSound('wrong'); 
      }
    });

    return () => { unsubscribe(); };
  }, [matchId, user, navigate, profile?.isSupport]); 

  // 2. Presence & Spectator Logic
  useEffect(() => {
      if (!matchId || !user || !profile || !match) return;
      
      const pIds = Object.keys(match.players || {});
      const userIsPlayer = pIds.includes(user.uid);

      if (userIsPlayer) {
          const myStatusRef = ref(db, `matches/${matchId}/players/${user.uid}`);
          const myLevel = Math.floor((profile?.points || 0) / 10) + 1;
          update(myStatusRef, { status: 'online', lastSeen: serverTimestamp(), level: myLevel });
          const disconnectRef = onDisconnect(myStatusRef);
          disconnectRef.update({ status: 'offline', lastSeen: serverTimestamp() });
          return () => { disconnectRef.cancel(); };
      } else {
          // Track Spectator Presence
          const specRef = ref(db, `matches/${matchId}/spectators/${user.uid}`);
          set(specRef, { name: profile.name, avatar: profile.avatar });
          const discRef = onDisconnect(specRef);
          discRef.remove();
          return () => { 
              remove(specRef);
              discRef.cancel(); 
          };
      }
  }, [matchId, user, profile, match?.matchId]);

  // 3. Load Player Profiles
  useEffect(() => {
      if (!match) return;
      
      const loadProfiles = async () => {
          const pIds = Object.keys(match.players || {});
          if (pIds.length >= 2) {
              const p1Snap = await get(ref(db, `users/${pIds[0]}`));
              const p2Snap = await get(ref(db, `users/${pIds[1]}`));
              
              if (p1Snap.exists()) {
                  const p1 = { uid: pIds[0], ...p1Snap.val() };
                  setLeftProfile(p1);
              }
              if (p2Snap.exists()) {
                  const p2 = { uid: pIds[1], ...p2Snap.val() };
                  setRightProfile(p2);
              }
          }
      };
      loadProfiles();
  }, [match?.matchId]);

  // 4. Load Questions
  useEffect(() => {
      if (!match || !match.subject || questions.length > 0 || questionsLoadedRef.current) return;
      loadQuestions();
  }, [match?.subject, match?.matchId]);

  const loadQuestions = async () => {
      if (!match) return;
      questionsLoadedRef.current = true;
      setIsLoadingError(false);
      let loadedQ: Question[] = [];
      const cacheKey = `questions_cache_${match.subject}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      try {
        if (match.subjectTitle) setSubjectName(match.subjectTitle);

        if (match.subject.startsWith('ALL_')) {
            const subjectId = match.subject.replace('ALL_', '');
            if (!match.subjectTitle) {
                const subSnap = await get(ref(db, `subjects/${subjectId}`));
                if(subSnap.exists()) setSubjectName(subSnap.val().name);
            }
            const chaptersSnap = await get(ref(db, `chapters/${subjectId}`));
            if (chaptersSnap.exists()) {
                const chapters = Object.values(chaptersSnap.val() || {}) as Chapter[];
                const snaps = await Promise.all(chapters.map(c => get(ref(db, `questions/${c.id}`))));
                snaps.forEach(s => {
                    if (s.exists()) {
                        const data = s.val();
                        const chapterQ = Object.keys(data).map(key => ({ ...data[key], id: key }));
                        loadedQ.push(...chapterQ);
                    }
                });
            }
        } else {
            if (cachedData) try { loadedQ = JSON.parse(cachedData); } catch(e) {}
            if (loadedQ.length === 0) {
                const snap = await get(ref(db, `questions/${match.subject}`));
                if(snap.exists()) {
                    const data = snap.val();
                    loadedQ = Object.keys(data).map(key => ({ ...data[key], id: key }));
                    try { localStorage.setItem(cacheKey, JSON.stringify(loadedQ)); } catch(e) {}
                }
            }
        }

        if (loadedQ.length > 0) {
            const rng = createSeededRandom(match.matchId);
            let shuffledQ = shuffleArraySeeded(loadedQ, rng).map(q => {
                const opts = q.options.map((o, i) => ({ t: o, c: i === q.answer }));
                const sOpts = shuffleArraySeeded(opts, rng);
                return { ...q, options: sOpts.map(o => o.t), answer: sOpts.findIndex(o => o.c) };
            });
            const limit = match.questionLimit || 10;
            setQuestions(shuffledQ.slice(0, limit));
        } else {
            setIsLoadingError(true);
            questionsLoadedRef.current = false;
        }
      } catch(e) {
          setIsLoadingError(true);
          questionsLoadedRef.current = false;
      }
  };

  useEffect(() => {
      if (!introShownOnce && questions.length > 0 && leftProfile && rightProfile && match && match.currentQ === 0 && match.answersCount === 0 && !isSpectator) {
          setShowIntro(true);
          setIntroShownOnce(true);
          playSound('click');
      }
  }, [questions.length, leftProfile, rightProfile, match?.matchId, introShownOnce, isSpectator]);

  useEffect(() => {
      if (showIntro) {
          const timer = setTimeout(() => { setShowIntro(false); }, 3500);
          return () => clearTimeout(timer);
      }
  }, [showIntro]);

  const triggerReactionAnimation = (reaction: MatchReaction) => {
    const id = ++reactionCounter.current;
    setActiveReactions(prev => {
        const filtered = prev.filter(r => r.senderId !== reaction.senderId);
        return [...filtered, { id, senderId: reaction.senderId, value: reaction.value, avatar: reaction.senderAvatar, name: reaction.senderName }];
    });
    playSound('reaction');
    setTimeout(() => {
        setActiveReactions(prev => prev.filter(r => r.id !== id));
    }, 4000);
  };

  const sendReaction = async (val: string) => {
      if (!user || !matchId) return;
      setShowReactionMenu(false);
      playSound('click');
      await update(ref(db, `matches/${matchId}`), {
          lastReaction: {
              senderId: user.uid,
              value: val,
              timestamp: Date.now(),
              senderAvatar: profile?.avatar,
              senderName: profile?.name
          }
      });
  };

  const handleOptionClick = async (index: number) => {
    if (isSpectator) return;
    if (!match || !user || match.turn !== user.uid || selectedOption !== null || processingRef.current || !currentQuestion) return;
    
    const currentScores = match.scores || {};
    setSelectedOption(index);
    playSound('click');
    processingRef.current = true;

    const isCorrect = index === currentQuestion.answer;
    isCorrect ? playSound('correct') : playSound('wrong');
    setShowFeedback({ correct: isCorrect, answer: currentQuestion.answer });

    setTimeout(async () => {
        const oppUid = Object.keys(currentScores).find(uid => uid !== user.uid) || '';
        const newScores = { ...currentScores };
        if (isCorrect) newScores[user.uid] = (newScores[user.uid] || 0) + POINTS_PER_QUESTION;

        const currentAnswers = match.answersCount || 0;
        let nextQ = match.currentQ;
        let nextAnswersCount = currentAnswers + 1;
        let nextTurn = oppUid; 

        if (currentAnswers >= 1) {
            if (match.currentQ >= questions.length - 1) {
                let winner = 'draw';
                const myScore = newScores[user.uid] || 0;
                const oppScore = newScores[oppUid] || 0;
                
                if (myScore > oppScore) winner = user.uid;
                else if (oppScore > myScore) winner = oppUid;

                const myPts = (await get(ref(db, `users/${user.uid}/points`))).val() || 0;
                await update(ref(db, `users/${user.uid}`), { points: myPts + myScore, activeMatch: null });
                if (oppUid) {
                    const oppPts = (await get(ref(db, `users/${oppUid}/points`))).val() || 0;
                    await update(ref(db, `users/${oppUid}`), { points: oppPts + oppScore, activeMatch: null });
                }

                await update(ref(db, `matches/${matchId}`), { scores: newScores, status: 'completed', winner, answersCount: 2 });
                return;
            }
            nextQ = match.currentQ + 1;
            nextAnswersCount = 0;
        }

        await update(ref(db, `matches/${matchId}`), { 
            scores: newScores, currentQ: nextQ, turn: nextTurn, answersCount: nextAnswersCount 
        });

        setSelectedOption(null); setShowFeedback(null); processingRef.current = false;
    }, 400); 
  };

  const handleReport = async () => {
      const currentQ = questions[match?.currentQ || 0];
      if (!currentQ || !user) return;
      playSound('click');
      const { value: reason } = await Swal.fire({
          title: 'Report Question',
          input: 'select',
          inputOptions: { 'wrong_answer': 'Jawaabta ayaa qaldan', 'typo': 'Qoraal ayaa qaldan', 'other': 'Sabab kale' },
          inputPlaceholder: 'Dooro sababta...',
          showCancelButton: true,
          confirmButtonText: 'Dir'
      });

      if (reason) {
          try {
              const reportRef = push(ref(db, 'reports'));
              await set(reportRef, {
                  id: reportRef.key,
                  questionId: currentQ.id,
                  chapterId: match?.subject || 'unknown',
                  reason, reporterUid: user.uid, timestamp: serverTimestamp(), questionText: currentQ.question
              });
              showToast("Waad ku mahadsantahay!", "success");
          } catch (e) { showToast("Cilad ayaa dhacday.", "error"); }
      }
  };

  const handleLeave = async () => {
      if(!user || !matchId) return;
      if (!isSpectator && match?.status === 'completed') try { await remove(ref(db, `matches/${matchId}`)); } catch(e) {}
      if (!isSpectator) await set(ref(db, `users/${user.uid}/activeMatch`), null);
      navigate(profile?.isSupport ? '/support' : '/');
  };

  const handleSurrender = async () => {
      if (isSpectator) { handleLeave(); return; }
      if (!match || !user || !rightProfile) return;
      const confirmed = await showConfirm("Exit Match?", "If you exit now, you will lose.", "Exit", "Stay", "warning");
      if (!confirmed) return;

      const oppPts = (await get(ref(db, `users/${rightProfile.uid}/points`))).val() || 0;
      await update(ref(db, `users/${rightProfile.uid}`), { points: oppPts + 20, activeMatch: null });
      await update(ref(db, `matches/${matchId}`), { status: 'completed', winner: rightProfile.uid });
      await set(ref(db, `users/${user.uid}/activeMatch`), null);
      navigate('/');
  };

  const currentQuestion = match && questions.length > 0 ? questions[match.currentQ] : null;
  const isMyTurn = match?.turn === user?.uid;
  const isGameOver = match?.status === 'completed';

  if (!match || !leftProfile || !rightProfile || isLoadingError || (!currentQuestion && !isGameOver && !showIntro && !isSpectator)) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
             <div className="animate__animated animate__fadeIn">
                  {isLoadingError ? (
                      <div className="flex flex-col items-center gap-4">
                          <i className="fas fa-exclamation-circle text-5xl text-red-500 mb-2"></i>
                          <h2 className="font-bold text-xl">Connection Problem</h2>
                          <Button onClick={handleLeave}>Exit</Button>
                      </div>
                  ) : (
                      <>
                        <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                           <i className="fas fa-gamepad text-game-accent"></i>
                        </div>
                        <h2 className="font-bold text-xl">{isSpectator ? 'Spectating Match...' : 'Waiting for opponent...'}</h2>
                      </>
                  )}
             </div>
        </div>
    );
  }

  const leftLevel = Math.floor((leftProfile.points || 0) / 10) + 1;
  const rightLevel = Math.floor((rightProfile.points || 0) / 10) + 1;
  const leftIsActive = match.turn === leftProfile.uid;
  const rightIsActive = match.turn === rightProfile.uid;
  const safeScores = match.scores || {};
  const winnerUid = match.winner;
  const spectators = match.spectators || {};
  const spectatorCount = Object.keys(spectators).length;

  return (
    <div className="min-h-screen relative flex flex-col font-sans overflow-hidden transition-colors pt-24">
       
      {/* Intro VS Animation */}
      {showIntro && (
          <div className="fixed inset-0 z-[100] flex flex-col md:flex-row items-center justify-center bg-slate-900 overflow-hidden">
              <div className="w-full md:w-1/2 h-1/2 md:h-full bg-orange-500 relative flex items-center justify-center animate__animated animate__slideInLeft">
                  <div className="text-center z-10">
                      <Avatar src={leftProfile.avatar} size="xl" className="border-4 border-white mb-4 mx-auto" isVerified={leftProfile.isVerified} />
                      <h2 className="text-3xl font-black text-white uppercase italic">{leftProfile.name}</h2>
                      <div className="inline-block bg-black/30 px-3 py-1 rounded-full text-white font-bold mt-2">LVL {leftLevel}</div>
                  </div>
              </div>
              <div className="absolute z-20 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate__animated animate__zoomIn animate__delay-1s">
                  <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center border-4 border-slate-900 shadow-2xl">
                      <span className="font-black text-4xl italic text-slate-900">VS</span>
                  </div>
              </div>
              <div className="w-full md:w-1/2 h-1/2 md:h-full bg-indigo-600 relative flex items-center justify-center animate__animated animate__slideInRight">
                  <div className="text-center z-10">
                      <Avatar src={rightProfile.avatar} size="xl" className="border-4 border-white mb-4 mx-auto" isVerified={rightProfile.isVerified} />
                      <h2 className="text-3xl font-black text-white uppercase italic">{rightProfile.name}</h2>
                      <div className="inline-block bg-black/30 px-3 py-1 rounded-full text-white font-bold mt-2">LVL {rightLevel}</div>
                  </div>
              </div>
          </div>
      )}

      {/* Header UI */}
      {!isGameOver && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60]">
              <button onClick={handleSurrender} className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-full font-black text-xs uppercase tracking-tighter shadow-xl border-2 border-white/30 active:scale-95">
                  <i className="fas fa-sign-out-alt rotate-180"></i> EXIT
              </button>
          </div>
      )}

      <div className="fixed top-0 left-0 right-0 z-50 bg-slate-800 border-b border-slate-700 shadow-xl p-3">
         <div className="max-w-4xl mx-auto flex justify-between items-center px-4">
            <div className={`flex items-center gap-3 transition-all ${leftIsActive && !isGameOver ? 'scale-105' : 'opacity-80'}`}>
                 <div className="relative">
                     <Avatar src={leftProfile.avatar} size="sm" />
                     <div className="absolute -bottom-1 -right-1 bg-slate-900 text-white text-[7px] px-1 rounded-sm border border-white">LVL {leftLevel}</div>
                     {activeReactions.filter(r => r.senderId === leftProfile.uid).map(r => (
                         <div key={r.id} className="absolute -bottom-14 left-0 z-50 animate__animated animate__bounceIn">
                             <div className="bg-white px-3 py-1.5 rounded-2xl shadow-2xl border-2 border-game-primary relative whitespace-nowrap">
                                <span className={r.value.length > 2 ? "text-[10px] font-black text-game-primary uppercase" : "text-3xl"}>{r.value}</span>
                                <div className="absolute -top-1.5 left-4 w-3 h-3 bg-white border-t-2 border-l-2 border-game-primary rotate-45"></div>
                             </div>
                         </div>
                     ))}
                 </div>
                 <div>
                     <div className="text-[10px] font-black uppercase text-slate-300 truncate max-w-[80px]">{leftProfile.name}</div>
                     <div className="text-2xl font-black text-orange-400 leading-none">{safeScores[leftProfile.uid] ?? 0}</div>
                 </div>
            </div>
            
            <div className="text-center flex flex-col items-center">
                 <div className="text-lg font-black text-slate-100 italic tracking-tighter">VS</div>
                 <button onClick={() => setShowSpectatorList(true)} className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase bg-slate-700 px-2 py-0.5 rounded-full mt-1">
                     <i className="fas fa-eye text-green-400"></i> {spectatorCount}
                 </button>
            </div>
            
            <div className={`flex items-center gap-3 flex-row-reverse text-right transition-all ${rightIsActive && !isGameOver ? 'scale-105' : 'opacity-80'}`}>
                 <div className="relative">
                    <Avatar src={rightProfile.avatar} size="sm" />
                    <div className="absolute -bottom-1 -right-1 bg-slate-900 text-white text-[7px] px-1 rounded-sm border border-white">LVL {rightLevel}</div>
                    {activeReactions.filter(r => r.senderId === rightProfile.uid).map(r => (
                         <div key={r.id} className="absolute -bottom-14 right-0 z-50 animate__animated animate__bounceIn">
                             <div className="bg-white px-3 py-1.5 rounded-2xl shadow-2xl border-2 border-game-primary relative whitespace-nowrap">
                                <span className={r.value.length > 2 ? "text-[10px] font-black text-game-primary uppercase" : "text-3xl"}>{r.value}</span>
                                <div className="absolute -top-1.5 right-4 w-3 h-3 bg-white border-t-2 border-l-2 border-game-primary rotate-45"></div>
                             </div>
                         </div>
                     ))}
                 </div>
                 <div>
                     <div className="text-[10px] font-black uppercase text-slate-300 truncate max-w-[80px]">{rightProfile.name}</div>
                     <div className="text-2xl font-black text-orange-400 leading-none">{safeScores[rightProfile.uid] ?? 0}</div>
                 </div>
            </div>
         </div>
      </div>

      {/* Floating Spectator Reactions */}
      <div className="fixed inset-0 pointer-events-none z-[40]">
           {activeReactions.filter(r => r.senderId !== leftProfile.uid && r.senderId !== rightProfile.uid).map(r => (
               <div key={r.id} className="absolute bottom-40 left-1/2 -translate-x-1/2 animate__animated animate__fadeInUp">
                    <div className="flex items-center gap-2 bg-white p-1 pr-4 rounded-full shadow-2xl border-2 border-indigo-500">
                         <Avatar src={r.avatar} size="sm" />
                         <span className="text-2xl">{r.value}</span>
                    </div>
               </div>
           ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 w-full max-w-3xl mx-auto z-10">
        {isGameOver ? (
           <div className="w-full max-w-lg animate__animated animate__zoomIn">
              <Card className="!p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-slate-800 rounded-[2.5rem]">
                  <div className={`py-10 text-center ${winnerUid === user?.uid ? 'bg-gradient-to-br from-yellow-400 to-orange-500' : 'bg-slate-700'}`}>
                      <h1 className="text-5xl font-black text-white uppercase italic tracking-tighter">
                          {winnerUid === user?.uid ? 'VICTORY' : winnerUid === 'draw' ? 'DRAW' : 'DEFEAT'}
                      </h1>
                  </div>
                  <div className="p-8">
                      <div className="flex justify-between items-center mb-10">
                          <div className="flex-1 flex flex-col items-center">
                              <Avatar src={leftProfile.avatar} size="lg" className={winnerUid === leftProfile.uid ? 'border-yellow-400' : ''} />
                              <div className="font-black mt-2">{safeScores[leftProfile.uid] ?? 0}</div>
                          </div>
                          <div className="text-slate-300 font-black text-2xl italic">VS</div>
                          <div className="flex-1 flex flex-col items-center">
                              <Avatar src={rightProfile.avatar} size="lg" className={winnerUid === rightProfile.uid ? 'border-yellow-400' : ''} />
                              <div className="font-black mt-2">{safeScores[rightProfile.uid] ?? 0}</div>
                          </div>
                      </div>
                      <Button onClick={handleLeave} size="lg" fullWidth>CONTINUE</Button>
                  </div>
              </Card>
           </div>
        ) : (
            <>
                 <div className="relative w-full bg-slate-100 dark:bg-slate-800 rounded-[1.5rem] p-6 shadow-xl mb-6 min-h-[180px] flex flex-col items-center justify-center text-center border-t-4 border-orange-500">
                     <button onClick={handleReport} className="absolute top-4 right-6 text-slate-300 hover:text-red-500 transition-colors z-30"><i className="fas fa-flag"></i></button>
                     <span className="bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full text-[10px] font-black text-slate-500 uppercase mb-4">{subjectName}</span>
                     <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white leading-snug">{currentQuestion && currentQuestion.question}</h2>
                 </div>

                 <div className="relative w-full grid grid-cols-1 gap-3">
                     {!isMyTurn && !isSpectator && (
                         <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                             <div className="bg-white/90 dark:bg-slate-800/90 p-6 rounded-3xl shadow-2xl border border-indigo-500 text-center animate-pulse">
                                 <div className="text-xs font-black text-slate-400 uppercase">Waiting for Opponent</div>
                                 <div className="font-bold text-lg">{rightProfile.name}</div>
                             </div>
                         </div>
                     )}

                     {currentQuestion && currentQuestion.options.map((opt, idx) => {
                        let bgClass = "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200";
                        if (showFeedback) {
                            if (idx === showFeedback.answer) bgClass = "bg-green-500 text-white border-green-500";
                            else if (selectedOption === idx) bgClass = "bg-red-500 text-white border-red-500";
                            else bgClass = "opacity-50 grayscale";
                        }

                        return (
                            <button key={idx} disabled={!isMyTurn || selectedOption !== null || isSpectator} onClick={() => handleOptionClick(idx)} className={`w-full p-4 rounded-2xl text-left transition-all flex items-center gap-4 border-2 shadow-sm ${bgClass}`}>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0 bg-slate-50 dark:bg-slate-700 text-slate-400 ${showFeedback ? 'bg-white/20' : ''}`}>{String.fromCharCode(65 + idx)}</div>
                                <span className="font-bold flex-1">{opt}</span>
                            </button>
                        );
                    })}
                 </div>
            </>
        )}
      </div>

      {/* Reaction Toggle Button */}
      {!isGameOver && (
          <div className="fixed bottom-24 right-4 z-[60]">
               <button onClick={() => setShowReactionMenu(!showReactionMenu)} className="w-16 h-16 rounded-full bg-white shadow-2xl border-4 border-game-primary text-3xl flex items-center justify-center active:scale-95">
                   <i className={`fas ${showReactionMenu ? 'fa-times text-red-500' : 'fa-smile text-game-primary'}`}></i>
               </button>
               {showReactionMenu && (
                   <div className="absolute bottom-20 right-0 w-64 p-4 bg-white/95 rounded-3xl shadow-2xl border-2 border-slate-100 animate__animated animate__bounceIn">
                       <div className="grid grid-cols-4 gap-3 mb-4">
                           {REACTION_EMOJIS.map(emoji => <button key={emoji} onClick={() => sendReaction(emoji)} className="text-3xl hover:scale-125 p-1">{emoji}</button>)}
                       </div>
                       <div className="space-y-2 border-t border-slate-100 pt-3">
                           {REACTION_MESSAGES.map(msg => <button key={msg} onClick={() => sendReaction(msg)} className="w-full text-left px-4 py-2 rounded-xl bg-slate-50 text-[11px] font-black text-slate-600 uppercase hover:bg-game-primary hover:text-white">{msg}</button>)}
                       </div>
                   </div>
               )}
          </div>
      )}

      {/* Spectator List Modal */}
      <Modal isOpen={showSpectatorList} onClose={() => setShowSpectatorList(false)} title="Spectators">
          <div className="space-y-4">
              {spectatorCount === 0 ? (
                  <p className="text-center text-slate-400">No one is currently watching.</p>
              ) : (
                  // Fix type errors by explicitly typing the map parameter
                  Object.values(spectators).map((s: { name: string; avatar: string }, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                          <Avatar src={s.avatar} size="sm" />
                          <span className="font-bold">{s.name}</span>
                      </div>
                  ))
              )}
          </div>
          <Button fullWidth onClick={() => setShowSpectatorList(false)} className="mt-6">Close</Button>
      </Modal>
    </div>
  );
};

export default GamePage;
