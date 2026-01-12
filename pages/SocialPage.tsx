
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { ref, onValue, off, update, remove } from 'firebase/database';
import { db } from '../firebase';
import { UserContext } from '../contexts';
import { UserProfile } from '../types';
import { Avatar } from '../components/UI';
import { UserProfileModal } from '../components/UserProfileModal';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../services/alert';

interface ChatMeta {
  lastMessage: string;
  lastTimestamp: number;
  unreadCount: number;
  lastMessageSender?: string; 
  lastMessageStatus?: string; 
  type?: string; 
}

const SocialPage: React.FC = () => {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'explore'>('friends');
  const [searchTerm, setSearchTerm] = useState('');

  // --- DATA STATES ---
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<{uid: string, user: UserProfile}[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [chatMetadata, setChatMetadata] = useState<Record<string, ChatMeta>>({});
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // --- RESTORE CACHE ---
  useEffect(() => {
      // 1. Social Data
      const cached = localStorage.getItem('social_cache');
      if (cached) {
          try {
              const { friends: cFriends, requests: cRequests, allUsers: cAll } = JSON.parse(cached);
              if (cFriends) setFriends(cFriends);
              if (cRequests) setRequests(cRequests);
              if (cAll) setAllUsers(cAll);
          } catch(e) {
              console.error("Cache load failed", e);
          }
      }

      // 2. Chat Metadata (for instant last message display)
      const cachedMeta = localStorage.getItem('social_meta_cache');
      if (cachedMeta) {
          try {
              setChatMetadata(JSON.parse(cachedMeta));
          } catch(e) {}
      }
  }, []);

  // --- PERSIST META CACHE ---
  useEffect(() => {
      if (Object.keys(chatMetadata).length > 0) {
          localStorage.setItem('social_meta_cache', JSON.stringify(chatMetadata));
      }
  }, [chatMetadata]);

  // --- FIREBASE LISTENERS ---
  useEffect(() => {
      if (!user) return;
      const usersRef = ref(db, 'users');
      
      const handleData = (snap: any) => {
          if (!snap.exists()) return;
          const data = snap.val();
          
          // 1. Requests
          const myRequests = data[user.uid]?.friendRequests || {};
          const reqList: any[] = [];
          Object.keys(myRequests).forEach(uid => {
              if(data[uid]) reqList.push({ uid, user: { uid, ...data[uid] } });
          });
          setRequests(reqList);

          // 2. Friends (Chats)
          const myFriends = data[user.uid]?.friends || {};
          const friendList: UserProfile[] = [];
          Object.keys(myFriends).forEach(uid => {
              if(data[uid]) friendList.push({ uid, ...data[uid] });
          });
          setFriends(friendList);

          // 3. All Users (Explore)
          const all: UserProfile[] = Object.keys(data).map(k => ({ uid: k, ...data[k] }));
          const filtered = all.filter(u => u.uid !== user.uid);
          setAllUsers(filtered);

          // SAVE TO CACHE
          localStorage.setItem('social_cache', JSON.stringify({ 
              friends: friendList, 
              requests: reqList, 
              allUsers: filtered 
          }));
      };

      onValue(usersRef, handleData);
      return () => off(usersRef);
  }, [user]);

  // Chat Metadata Listener
  useEffect(() => {
    if (!user || friends.length === 0) return;
    const listeners: Function[] = [];

    friends.forEach(f => {
        const participants = [user.uid, f.uid].sort();
        const chatId = `${participants[0]}_${participants[1]}`;
        const chatRef = ref(db, `chats/${chatId}`);

        const unsub = onValue(chatRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const meta = {
                    lastMessage: data.lastMessage || '',
                    lastTimestamp: data.lastTimestamp || 0,
                    unreadCount: data.unread?.[user.uid]?.count || 0,
                    lastMessageSender: data.lastMessageSender,
                    lastMessageStatus: data.lastMessageStatus,
                    type: (data.lastMessage === 'CHALLENGE_INVITE') ? 'invite' : 'text'
                };

                setChatMetadata(prev => ({ ...prev, [f.uid]: meta }));
            }
        });
        listeners.push(() => off(chatRef));
    });
    return () => listeners.forEach(unsub => unsub());
  }, [user, friends]);

  // --- ACTIONS ---
  const sendRequest = async (targetUid: string) => {
      if(!user) return;
      await update(ref(db, `users/${targetUid}/friendRequests`), { [user.uid]: true });
      showToast("Request sent", "success");
  };

  // --- LIST PROCESSING ---
  const exploreList = useMemo(() => {
      return allUsers.filter(u => {
          const isFriend = friends.some(f => f.uid === u.uid);
          const isRequested = requests.some(r => r.uid === u.uid); 
          const matchesSearch = (u.name||'').toLowerCase().includes(searchTerm.toLowerCase());
          return !isFriend && !isRequested && matchesSearch;
      }).sort((a, b) => {
          // 1. Online First
          if (a.isOnline !== b.isOnline) return b.isOnline ? 1 : -1;
          // 2. Points High to Low
          return (b.points || 0) - (a.points || 0);
      }); 
  }, [allUsers, friends, requests, searchTerm]);

  const sortedFriends = useMemo(() => {
      return [...friends].filter(f => 
          (f.name||'').toLowerCase().includes(searchTerm.toLowerCase())
      ).sort((a, b) => {
          const tA = chatMetadata[a.uid]?.lastTimestamp || 0;
          const tB = chatMetadata[b.uid]?.lastTimestamp || 0;
          return tB - tA; // Recent first
      });
  }, [friends, chatMetadata, searchTerm]);

  const getLevel = (points: number = 0) => Math.floor(points / 10) + 1;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-900 pb-24 pt-4 px-4 flex flex-col font-sans transition-colors">
        
        {/* 1. Search Bar */}
        <div className="relative mb-6">
            <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
            <input 
                className="w-full bg-white dark:bg-slate-800 py-4 pl-14 pr-4 rounded-[1.5rem] shadow-sm border-none outline-none font-bold text-slate-700 dark:text-white placeholder-slate-400 text-sm transition-all focus:ring-2 focus:ring-game-primary/20"
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        {/* 2. Tabs (Smooth Slider) */}
        <div className="relative flex w-full bg-slate-200 dark:bg-slate-800 p-1 rounded-2xl mb-6 shadow-inner h-14">
            {/* Sliding Indicator */}
            <div 
                className="absolute top-1 bottom-1 bg-white dark:bg-slate-700 rounded-xl shadow-md transition-all duration-300 ease-out z-0"
                style={{
                    width: 'calc((100% - 0.5rem) / 3)',
                    left: '0.25rem',
                    transform: `translateX(${activeTab === 'friends' ? '0%' : activeTab === 'requests' ? '100%' : '200%'})`
                }}
            />
            
            <button 
                onClick={() => setActiveTab('friends')}
                className={`flex-1 relative z-10 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-colors duration-300 ${activeTab === 'friends' ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-400'}`}
            >
                Friends
                {friends.length > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] leading-none ${activeTab === 'friends' ? 'bg-game-primary text-white' : 'bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300'}`}>
                        {friends.length}
                    </span>
                )}
            </button>
            
            <button 
                onClick={() => setActiveTab('requests')}
                className={`flex-1 relative z-10 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-colors duration-300 ${activeTab === 'requests' ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-400'}`}
            >
                Requests
                {requests.length > 0 && (
                    <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[9px] leading-none ${activeTab === 'requests' ? 'bg-red-500 text-white' : 'bg-red-500/80 text-white'}`}>
                        {requests.length}
                    </span>
                )}
            </button>
            
            <button 
                onClick={() => setActiveTab('explore')}
                className={`flex-1 relative z-10 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-colors duration-300 ${activeTab === 'explore' ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-400'}`}
            >
                Explore
            </button>
        </div>

        {/* 3. Content List */}
        <div className="flex-1 space-y-3">
            
            {/* --- FRIENDS TAB --- */}
            {activeTab === 'friends' && (
                <>
                    {sortedFriends.length === 0 ? (
                        <div className="text-center py-10 opacity-50">
                            <p className="font-bold text-slate-400">No friends found.</p>
                        </div>
                    ) : (
                        sortedFriends.map(f => {
                            const meta = chatMetadata[f.uid] || { lastMessage: '', unreadCount: 0 };
                            const lastMsg = meta.lastMessage 
                                ? (meta.lastMessage === 'CHALLENGE_INVITE' ? '🎮 Game Invite' : meta.lastMessage) 
                                : 'Start chatting';
                            const isMe = meta.lastMessageSender === user?.uid;
                            
                            return (
                                <div 
                                    key={f.uid} 
                                    onClick={() => navigate(`/chat/${f.uid}`)}
                                    className="bg-white dark:bg-slate-800 p-4 rounded-[1.8rem] shadow-sm flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-all relative overflow-hidden group"
                                >
                                    {/* Avatar + Online Dot */}
                                    <div className="relative shrink-0">
                                        <Avatar src={f.avatar} seed={f.uid} size="md" isOnline={f.isOnline} />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-black text-slate-800 dark:text-white text-base truncate mb-0.5 flex items-center gap-1">
                                            {f.name}
                                            {f.isVerified && <i className="fas fa-check-circle text-blue-500 text-xs"></i>}
                                            {f.isSupport && <i className="fas fa-check-circle text-game-primary text-xs"></i>}
                                        </div>
                                        <div className={`text-xs truncate font-bold ${meta.unreadCount > 0 ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>
                                            {isMe ? `You: ${lastMsg}` : lastMsg}
                                        </div>
                                    </div>

                                    {/* Right Side: Level Badge (No Chat Icon) */}
                                    <div className="shrink-0 flex items-center gap-3">
                                        {meta.unreadCount > 0 && (
                                            <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white font-black animate-pulse">
                                                {meta.unreadCount}
                                            </div>
                                        )}
                                        <div className="bg-[#fbbf24] text-white text-[10px] font-black px-3 py-1 rounded-full shadow-sm tracking-wide">
                                            Lv.{getLevel(f.points)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </>
            )}

            {/* --- EXPLORE TAB --- */}
            {activeTab === 'explore' && (
                <>
                    {exploreList.slice(0, 50).map(u => {
                        const hasRequested = (u as any).friendRequests?.[user?.uid || ''];
                        return (
                            <div 
                                key={u.uid} 
                                onClick={() => setSelectedUser(u)}
                                className="bg-white dark:bg-slate-800 p-4 rounded-[1.8rem] shadow-sm flex items-center justify-between gap-4 cursor-pointer active:scale-[0.98] transition-all"
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="relative shrink-0">
                                        <Avatar src={u.avatar} seed={u.uid} size="md" isOnline={u.isOnline} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-black text-slate-800 dark:text-white text-sm truncate flex items-center gap-1">
                                            {u.name}
                                            {u.isVerified && <i className="fas fa-check-circle text-blue-500 text-xs"></i>}
                                            {u.isSupport && <i className="fas fa-check-circle text-game-primary text-xs"></i>}
                                        </div>
                                        <div className="text-xs text-slate-400 font-bold truncate">@{u.username || 'user'}</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="bg-[#fbbf24] text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm">
                                        Lv.{getLevel(u.points)}
                                    </div>
                                    
                                    {hasRequested ? (
                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                                            <i className="fas fa-check text-xs"></i>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); sendRequest(u.uid); }}
                                            className="btn-3d bg-[#8b5cf6] text-white px-4 py-2 rounded-full text-xs font-black flex items-center gap-1 transition-all"
                                            style={{ boxShadow: '0px 3px 0px 0px #6d28d9' }}
                                        >
                                            <i className="fas fa-user-plus text-[10px]"></i> Add
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </>
            )}

            {/* --- REQUESTS TAB --- */}
            {activeTab === 'requests' && (
                <>
                    {requests.length === 0 ? (
                        <div className="text-center py-10 opacity-50">
                            <p className="font-bold text-slate-400">No pending requests.</p>
                        </div>
                    ) : (
                        requests.map(r => (
                            <div key={r.uid} className="bg-white dark:bg-slate-800 p-4 rounded-[1.8rem] shadow-sm flex flex-col gap-4 animate__animated animate__fadeIn">
                                <div className="flex items-center gap-4">
                                    <Avatar src={r.user.avatar} seed={r.user.uid} size="md" />
                                    <div>
                                        <div className="font-black text-slate-800 dark:text-white text-sm flex items-center gap-1">
                                            {r.user.name}
                                            {r.user.isVerified && <i className="fas fa-check-circle text-blue-500 text-xs" title="Verified"></i>}
                                            {r.user.isSupport && <i className="fas fa-check-circle text-game-primary text-xs" title="Official Support"></i>}
                                        </div>
                                        <div className="text-xs text-slate-400 font-bold">Wants to be friends</div>
                                    </div>
                                    <div className="ml-auto bg-[#fbbf24] text-white text-[10px] font-black px-2.5 py-1 rounded-full">
                                        Lv.{getLevel(r.user.points)}
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button 
                                        onClick={async () => {
                                            await update(ref(db), { 
                                                [`users/${user?.uid}/friends/${r.uid}`]: true, 
                                                [`users/${r.uid}/friends/${user?.uid}`]: true, 
                                                [`users/${user?.uid}/friendRequests/${r.uid}`]: null 
                                            });
                                            showToast("Friend Added!", "success");
                                        }} 
                                        className="btn-3d flex-1 bg-game-primary text-white py-3 rounded-xl text-xs font-black uppercase"
                                        style={{ boxShadow: '0px 4px 0px 0px #c2410c' }}
                                    >
                                        Accept
                                    </button>
                                    <button 
                                        onClick={() => remove(ref(db, `users/${user?.uid}/friendRequests/${r.uid}`))} 
                                        className="btn-3d flex-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 py-3 rounded-xl text-xs font-black uppercase"
                                        style={{ boxShadow: '0px 4px 0px 0px rgba(0,0,0,0.2)' }}
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </>
            )}
        </div>

        {/* User Modal */}
        {selectedUser && (
            <UserProfileModal 
                user={selectedUser} 
                onClose={() => setSelectedUser(null)}
                actionLabel={friends.some(f => f.uid === selectedUser.uid) ? "Message" : "Send Request"}
                onAction={friends.some(f => f.uid === selectedUser.uid) 
                    ? () => { navigate(`/chat/${selectedUser.uid}`); setSelectedUser(null); }
                    : () => { sendRequest(selectedUser.uid); setSelectedUser(null); }
                }
            />
        )}
    </div>
  );
};

export default SocialPage;
