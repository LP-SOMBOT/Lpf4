
import React, { useContext, useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, updateProfile } from 'firebase/auth';
import { ref, update, get } from 'firebase/database';
import { auth, db } from '../firebase';
import { UserContext } from '../contexts';
import { Avatar, Button, Card, Input, Modal, VerificationBadge } from '../components/UI';
import { playSound } from '../services/audioService';
import { generateAvatarUrl } from '../constants';
import { showToast, showAlert } from '../services/alert';

// --- EXTENDED ICON LIBRARY ---
const BADGE_LIBRARY = [
    // Ranks & Status
    { url: "https://cdn-icons-png.flaticon.com/512/12559/12559876.png", category: "Rank", tags: ["verified", "check", "blue"] },
    { url: "https://cdn-icons-png.flaticon.com/512/2583/2583344.png", category: "Rank", tags: ["crown", "king", "queen", "gold"] },
    { url: "https://cdn-icons-png.flaticon.com/512/1828/1828884.png", category: "Rank", tags: ["star", "favorite", "yellow"] },
    { url: "https://cdn-icons-png.flaticon.com/512/771/771237.png", category: "Rank", tags: ["diamond", "gem", "rich"] },
    { url: "https://cdn-icons-png.flaticon.com/512/929/929440.png", category: "Rank", tags: ["shield", "security", "guard"] },
    { url: "https://cdn-icons-png.flaticon.com/512/6469/6469274.png", category: "Rank", tags: ["medal", "gold", "first"] },
    { url: "https://cdn-icons-png.flaticon.com/512/3113/3113023.png", category: "Rank", tags: ["trophy", "cup", "winner"] },

    // Elements & Nature
    { url: "https://cdn-icons-png.flaticon.com/512/785/785116.png", category: "Nature", tags: ["fire", "flame", "hot", "burn"] },
    { url: "https://cdn-icons-png.flaticon.com/512/3579/3579059.png", category: "Nature", tags: ["lightning", "bolt", "storm", "energy"] },
    { url: "https://cdn-icons-png.flaticon.com/512/414/414825.png", category: "Nature", tags: ["water", "drop", "sea"] },
    { url: "https://cdn-icons-png.flaticon.com/512/1598/1598431.png", category: "Nature", tags: ["earth", "globe", "world"] },
    { url: "https://cdn-icons-png.flaticon.com/512/1169/1169659.png", category: "Nature", tags: ["leaf", "plant", "green"] },
    { url: "https://cdn-icons-png.flaticon.com/512/1827/1827827.png", category: "Nature", tags: ["moon", "night", "sleep"] },
    
    // Gaming & Sci-Fi
    { url: "https://cdn-icons-png.flaticon.com/512/1356/1356479.png", category: "Gaming", tags: ["rocket", "space", "fly"] },
    { url: "https://cdn-icons-png.flaticon.com/512/2855/2855269.png", category: "Gaming", tags: ["skull", "death", "danger"] },
    { url: "https://cdn-icons-png.flaticon.com/512/681/681564.png", category: "Gaming", tags: ["gamepad", "controller", "play"] },
    { url: "https://cdn-icons-png.flaticon.com/512/1500/1500427.png", category: "Gaming", tags: ["robot", "bot", "ai"] },
    { url: "https://cdn-icons-png.flaticon.com/512/2621/2621040.png", category: "Gaming", tags: ["alien", "space", "ufo"] },
    { url: "https://cdn-icons-png.flaticon.com/512/2316/2316752.png", category: "Gaming", tags: ["sword", "battle", "fight"] },

    // Fun & Abstract
    { url: "https://cdn-icons-png.flaticon.com/512/833/833472.png", category: "Fun", tags: ["heart", "love", "like"] },
    { url: "https://cdn-icons-png.flaticon.com/512/742/742751.png", category: "Fun", tags: ["smile", "happy", "face"] },
    { url: "https://cdn-icons-png.flaticon.com/512/2072/2072130.png", category: "Fun", tags: ["ghost", "spooky", "halloween"] },
    { url: "https://cdn-icons-png.flaticon.com/512/1998/1998592.png", category: "Fun", tags: ["cool", "glasses", "sunglasses"] },
    { url: "https://cdn-icons-png.flaticon.com/512/260/260250.png", category: "Fun", tags: ["peace", "hand", "victory"] },
    { url: "https://cdn-icons-png.flaticon.com/512/1139/1139982.png", category: "Fun", tags: ["music", "note", "song"] }
];

const CATEGORIES = ["All", "Rank", "Nature", "Gaming", "Fun"];

const ProfilePage: React.FC = () => {
  const { profile, user } = useContext(UserContext);
  const navigate = useNavigate();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Avatar Selection State
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [randomAvatars, setRandomAvatars] = useState<string[]>([]);
  
  // Badge Selection State (Super Admin)
  const [showBadgeSelector, setShowBadgeSelector] = useState(false);
  const [customBadgeUrl, setCustomBadgeUrl] = useState('');
  
  // Badge Browser State
  const [badgeTab, setBadgeTab] = useState<'browse' | 'search' | 'custom'>('browse');
  const [activeCategory, setActiveCategory] = useState('All');
  const [badgeSearch, setBadgeSearch] = useState('');

  // Custom Upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Username prompt state
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  useEffect(() => {
    if (profile) {
      setEditName(profile.name);
      setCurrentAvatarUrl(profile.avatar);
      setCustomBadgeUrl(profile.customBadge || '');
      // Strictly prevent prompt if guest using robust check
      // Guests from AuthPage have 'isGuest: true'.
      if (!profile.username && !profile.isGuest) {
          setShowUsernamePrompt(true);
      }
    }
  }, [profile]);

  useEffect(() => {
      if (showAvatarSelector) {
          // Generate 9 random seeds
          const seeds = Array.from({length: 9}, () => Math.random().toString(36).substring(7));
          setRandomAvatars(seeds);
      }
  }, [showAvatarSelector]);

  // Reset badge modal state on open
  useEffect(() => {
      if (showBadgeSelector) {
          setBadgeTab('browse');
          setActiveCategory('All');
          setBadgeSearch('');
      }
  }, [showBadgeSelector]);

  const handleLogout = () => {
    playSound('click');
    signOut(auth);
    navigate('/auth');
  };

  const selectAvatar = (seed: string) => {
    const url = generateAvatarUrl(seed);
    setCurrentAvatarUrl(url);
    setShowAvatarSelector(false);
    playSound('click');
    // If we are not in edit mode, auto-save the avatar change immediately
    if (!isEditing) {
        handleSaveAvatarOnly(url);
    }
  };

  const handleSaveAvatarOnly = async (url: string) => {
      if (!user) return;
      try {
          await update(ref(db, `users/${user.uid}`), { avatar: url });
          playSound('correct');
      } catch (e) {
          console.error("Error saving avatar", e);
      }
  };

  const handleSaveProfile = async () => {
    if (!user || !editName.trim()) return;
    setLoading(true);
    try {
      // Update Auth Profile
      await updateProfile(user, { displayName: editName });
      
      // Update Database Profile
      await update(ref(db, `users/${user.uid}`), {
        name: editName,
        avatar: currentAvatarUrl,
      });
      
      playSound('correct');
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      playSound('wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSetUsername = async () => {
      if (!user || !newUsername.trim()) return;
      setLoading(true);
      const clean = newUsername.toLowerCase().replace(/[^a-z0-9_]/g, '');
      
      if (clean.length < 3) {
          showToast("Username too short", "error");
          setLoading(false);
          return;
      }

      // Check uniqueness via client-side filter
      const snapshot = await get(ref(db, 'users'));
      let exists = false;
      if (snapshot.exists()) {
          const users = snapshot.val();
          exists = Object.values(users).some((u: any) => (u.username || '').toLowerCase() === clean);
      }
      
      if (exists) {
           showToast("Username taken", "error");
           setLoading(false);
           return;
      }

      try {
          await update(ref(db, `users/${user.uid}`), { username: clean });
          setShowUsernamePrompt(false);
          showToast("Username set!", "success");
      } catch (e) {
          showAlert("Error", "Failed to set username", "error");
      } finally {
          setLoading(false);
      }
  };

  // Image Upload Handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
              // Resize logic to prevent DB bloat
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 300;
              const MAX_HEIGHT = 300;
              let width = img.width;
              let height = img.height;

              if (width > height) {
                  if (width > MAX_WIDTH) {
                      height *= MAX_WIDTH / width;
                      width = MAX_WIDTH;
                  }
              } else {
                  if (height > MAX_HEIGHT) {
                      width *= MAX_HEIGHT / height;
                      height = MAX_HEIGHT;
                  }
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, width, height);
              
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              setCurrentAvatarUrl(dataUrl);
              setShowAvatarSelector(false);
              
              if (!isEditing) {
                  handleSaveAvatarOnly(dataUrl);
              }
          };
          img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
  };

  const triggerFileUpload = () => {
      fileInputRef.current?.click();
  };

  const handleSaveBadge = async (url: string | null) => {
      if (!user) return;
      try {
          // If null, remove custom badge and keep isVerified logic
          if (url === null) {
              await update(ref(db, `users/${user.uid}`), { customBadge: null });
          } else {
              await update(ref(db, `users/${user.uid}`), { customBadge: url });
          }
          playSound('correct');
          setShowBadgeSelector(false);
          showToast("Badge Updated!", "success");
      } catch (e) {
          showAlert("Error", "Failed to update badge", "error");
      }
  };

  const handleRandomizeBadge = () => {
      const randomIcon = BADGE_LIBRARY[Math.floor(Math.random() * BADGE_LIBRARY.length)];
      handleSaveBadge(randomIcon.url);
  };

  // Filtered Badges Logic
  const filteredBadges = useMemo(() => {
      if (badgeTab === 'search') {
          if (!badgeSearch.trim()) return BADGE_LIBRARY;
          return BADGE_LIBRARY.filter(b => b.tags.some(t => t.includes(badgeSearch.toLowerCase())));
      }
      if (activeCategory === 'All') return BADGE_LIBRARY;
      return BADGE_LIBRARY.filter(b => b.category === activeCategory);
  }, [badgeTab, activeCategory, badgeSearch]);

  if (!profile) return null;

  const currentPoints = profile.points || 0;
  const level = Math.floor(currentPoints / 10) + 1;
  const pointsInCurrentLevel = currentPoints % 10;
  const progressPercent = (pointsInCurrentLevel / 10) * 100;
  const pointsToNext = 10 - pointsInCurrentLevel;
  const isSuperAdmin = profile.roles?.superAdmin;

  return (
    <div className="min-h-full p-4 flex flex-col transition-colors max-w-3xl mx-auto w-full pb-24 pt-24">
       <style>
           {`
             @keyframes progress-bar-stripes {
               from { background-position: 1rem 0; }
               to { background-position: 0 0; }
             }
           `}
       </style>
       <div className="fixed top-0 left-0 right-0 z-50 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/5 shadow-sm flex items-center gap-4 px-4 py-3 transition-colors duration-300">
        <button onClick={() => navigate('/')} className="text-white hover:text-cyan-400 transition-colors">
            <i className="fas fa-arrow-left fa-lg"></i>
        </button>
        <h1 className="text-xl md:text-2xl font-bold text-white">My Profile</h1>
        <div className="flex-1 text-right">
            {!isEditing && (
                <button onClick={() => setIsEditing(true)} className="font-bold text-sm px-3 py-1 rounded-full border transition-all text-cyan-400 bg-cyan-900/20 border-cyan-500/20 hover:bg-cyan-900/40">
                    <i className="fas fa-edit mr-1"></i> Edit
                </button>
            )}
        </div>
      </div>

      <div className="flex flex-col items-center mb-8">
        <div className="relative group">
            <Avatar 
                src={currentAvatarUrl} 
                seed={user?.uid} 
                size="xl" 
                isVerified={profile.isVerified}
                className="mb-4 border-4 border-slate-800 shadow-xl cursor-pointer hover:opacity-90 transition-opacity" 
                onClick={() => setShowAvatarSelector(true)}
            />
            <button 
                onClick={() => setShowAvatarSelector(true)}
                className="absolute bottom-4 right-0 bg-game-primary text-white p-2.5 rounded-full shadow-lg hover:scale-110 transition-transform border-2 border-slate-800"
                title="Choose Avatar"
            >
                <i className="fas fa-camera"></i>
            </button>
        </div>

        {isEditing ? (
            <div className="w-full max-w-xs animate__animated animate__fadeIn space-y-4">
                <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1 ml-1">Display Name</label>
                    <Input 
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Enter new name"
                        className="text-center font-bold text-lg !bg-slate-800 !border-slate-700 !text-white"
                        autoFocus
                    />
                </div>

                <div className="flex gap-3 pt-2">
                    <Button fullWidth variant="secondary" onClick={() => { setIsEditing(false); setEditName(profile.name); setCurrentAvatarUrl(profile.avatar); }}>Cancel</Button>
                    <Button fullWidth onClick={handleSaveProfile} isLoading={loading}>Save</Button>
                </div>
            </div>
        ) : (
            <>
                <div className="flex items-center justify-center gap-2 group relative">
                    <h2 
                        onClick={() => setIsEditing(true)}
                        className="text-2xl font-black text-white cursor-pointer hover:text-game-primary transition-colors flex items-center justify-center gap-2"
                        title="Click to edit name"
                    >
                        {profile.name}
                        {(profile.isVerified || profile.customBadge) && <VerificationBadge size="lg" className="text-blue-500" src={profile.customBadge} />}
                        {profile.isSupport && <i className="fas fa-check-circle text-game-primary text-lg" title="Support Team"></i>}
                    </h2>
                    
                    {isSuperAdmin && (
                        <button 
                            onClick={() => setShowBadgeSelector(true)}
                            className="w-6 h-6 rounded-full bg-slate-700 hover:bg-game-primary text-white flex items-center justify-center ml-1 transition-all"
                            title="Edit Badge (Super Admin)"
                        >
                            <i className="fas fa-id-badge text-xs"></i>
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2 text-gray-300 font-bold font-mono bg-slate-800 px-3 py-1 rounded-full mt-2">
                    @{profile.username || 'unknown'}
                </div>
            </>
        )}
      </div>

      {/* Avatar Selection Modal */}
      <Modal isOpen={showAvatarSelector} title="Choose Avatar" onClose={() => setShowAvatarSelector(false)}>
          <div className="text-center mb-4">
              {profile.allowCustomAvatar && (
                  <div className="mb-6">
                      <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handleImageUpload}
                      />
                      <Button fullWidth onClick={triggerFileUpload} className="shadow-lg bg-indigo-600 border-indigo-800 hover:bg-indigo-700">
                          <i className="fas fa-upload mr-2"></i> Upload from Gallery
                      </Button>
                      <p className="text-xs text-gray-400 mt-2">Upload a profile picture (max 300px)</p>
                  </div>
              )}
              
              <div className="grid grid-cols-3 gap-4">
                  {randomAvatars.map((seed, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => selectAvatar(seed)}
                        className="aspect-square rounded-full overflow-hidden border-2 border-transparent hover:border-game-primary cursor-pointer transition-all hover:scale-110 bg-slate-800"
                      >
                          <img src={generateAvatarUrl(seed)} alt="avatar" className="w-full h-full object-cover" />
                      </div>
                  ))}
              </div>
              <Button fullWidth variant="secondary" className="mt-6" onClick={() => setRandomAvatars(Array.from({length: 9}, () => Math.random().toString(36).substring(7)))}>
                 <i className="fas fa-sync mr-2"></i> Randomize
              </Button>
          </div>
      </Modal>

      {/* Badge Selector Modal (Super Admin) - REFACTORED */}
      <Modal isOpen={showBadgeSelector} title="Badge Center" onClose={() => setShowBadgeSelector(false)}>
          <div className="flex flex-col h-[500px]">
              
              {/* Tab Navigation */}
              <div className="flex bg-slate-800 p-1 rounded-xl mb-4 shrink-0">
                  <button onClick={() => setBadgeTab('browse')} className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${badgeTab === 'browse' ? 'bg-game-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Browse</button>
                  <button onClick={() => setBadgeTab('search')} className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${badgeTab === 'search' ? 'bg-game-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Search</button>
                  <button onClick={() => setBadgeTab('custom')} className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${badgeTab === 'custom' ? 'bg-game-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Custom URL</button>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                  
                  {/* BROWSE MODE */}
                  {badgeTab === 'browse' && (
                      <div className="space-y-4">
                          {/* Categories Horizontal Scroll */}
                          <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar-hide">
                              {CATEGORIES.map(cat => (
                                  <button 
                                    key={cat} 
                                    onClick={() => setActiveCategory(cat)}
                                    className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all border ${activeCategory === cat ? 'bg-white text-slate-900 border-white' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'}`}
                                  >
                                      {cat}
                                  </button>
                              ))}
                          </div>
                          
                          {/* Icons Grid */}
                          <div className="grid grid-cols-5 gap-3 p-1">
                              {filteredBadges.map((badge, idx) => (
                                  <button 
                                    key={idx} 
                                    onClick={() => handleSaveBadge(badge.url)}
                                    className={`aspect-square p-2 rounded-xl border-2 bg-slate-800 border-slate-700 hover:border-game-primary hover:scale-110 transition-all flex items-center justify-center ${customBadgeUrl === badge.url ? 'ring-2 ring-game-primary ring-offset-2 ring-offset-slate-900' : ''}`}
                                  >
                                      <img src={badge.url} alt="Badge" className="w-full h-full object-contain" />
                                  </button>
                              ))}
                          </div>
                      </div>
                  )}

                  {/* SEARCH MODE */}
                  {badgeTab === 'search' && (
                      <div className="space-y-4">
                          <Input 
                              placeholder="Search icons (e.g. fire, king)..." 
                              value={badgeSearch} 
                              onChange={(e) => setBadgeSearch(e.target.value)} 
                              icon="fa-search"
                              className="!bg-slate-800 !border-slate-700"
                              autoFocus
                          />
                          <div className="grid grid-cols-5 gap-3 p-1">
                              {filteredBadges.length > 0 ? filteredBadges.map((badge, idx) => (
                                  <button 
                                    key={idx} 
                                    onClick={() => handleSaveBadge(badge.url)}
                                    className="aspect-square p-2 rounded-xl border-2 bg-slate-800 border-slate-700 hover:border-game-primary hover:scale-110 transition-all flex items-center justify-center"
                                  >
                                      <img src={badge.url} alt="Badge" className="w-full h-full object-contain" />
                                  </button>
                              )) : (
                                  <div className="col-span-5 text-center py-10 text-slate-500 font-bold text-sm">
                                      No icons found.
                                  </div>
                              )}
                          </div>
                      </div>
                  )}

                  {/* CUSTOM MODE */}
                  {badgeTab === 'custom' && (
                      <div className="flex flex-col justify-center h-full space-y-6">
                          <div className="text-center space-y-2">
                              <i className="fas fa-link text-4xl text-slate-600"></i>
                              <p className="text-sm font-bold text-slate-400">Paste a direct image URL.</p>
                          </div>
                          <Input 
                              placeholder="https://example.com/icon.png" 
                              value={customBadgeUrl} 
                              onChange={(e) => setCustomBadgeUrl(e.target.value)}
                              className="!bg-slate-800 !border-slate-700"
                          />
                          <Button fullWidth onClick={() => handleSaveBadge(customBadgeUrl)}>
                              Save Custom URL
                          </Button>
                          <div className="text-[10px] text-slate-500 text-center leading-relaxed px-4">
                              Tip: You can use Flaticon or any CDN. Right-click an image online and select "Copy Image Link".
                          </div>
                      </div>
                  )}
              </div>

              {/* Footer Actions */}
              <div className="pt-4 mt-2 border-t border-slate-700 grid grid-cols-2 gap-3 shrink-0">
                  <button 
                    onClick={handleRandomizeBadge} 
                    className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl text-xs font-black uppercase transition-colors"
                  >
                      <i className="fas fa-dice"></i> Randomize
                  </button>
                  <button 
                    onClick={() => handleSaveBadge(null)} 
                    className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white py-3 rounded-xl text-xs font-black uppercase border border-red-500/50 transition-colors"
                  >
                      <i className="fas fa-trash"></i> Remove Badge
                  </button>
              </div>
          </div>
      </Modal>
      
      {/* Username Modal */}
      <Modal isOpen={showUsernamePrompt} title="Set Username">
          <div className="space-y-4">
              <p className="text-sm text-slate-400 text-center font-bold">You need a unique username to use social features.</p>
              <Input 
                  placeholder="Username" 
                  value={newUsername} 
                  onChange={e => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="text-center font-bold !bg-slate-800 !border-slate-700 !text-white"
              />
              <Button fullWidth onClick={handleSetUsername} isLoading={loading}>Save Username</Button>
          </div>
      </Modal>

      {/* Live Level Progress Card */}
      <Card className="mb-6 relative overflow-hidden bg-slate-800 !p-6 border border-slate-700">
        <div className="flex justify-between items-end mb-4 relative z-10">
            <div>
                <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Current Rank</span>
                <span className="font-black text-2xl text-white">Level {level}</span>
            </div>
            <div className="text-right">
                 <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Total Score</span>
                 <span className="font-black text-2xl text-orange-400">{currentPoints} XP</span>
            </div>
        </div>
        
        {/* Redesigned "Real" Progress Bar */}
        <div className="relative w-full h-6 bg-slate-900 rounded-full overflow-hidden shadow-inner border border-slate-700">
            {/* Background Stripes */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 50%, #000 50%, #000 75%, transparent 75%, transparent)', backgroundSize: '1rem 1rem' }}></div>
            
            {/* Active Bar */}
            <div 
                className="h-full bg-gradient-to-r from-orange-500 to-red-500 relative transition-all duration-1000 ease-out flex items-center justify-end pr-2"
                style={{ width: `${progressPercent}%` }}
            >
                {/* Glow at tip */}
                <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/50 blur-[2px]"></div>
                {/* Animated Stripes on Bar */}
                <div className="absolute inset-0 w-full h-full animate-[progress-bar-stripes_1s_linear_infinite]" 
                     style={{ 
                         backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', 
                         backgroundSize: '1rem 1rem' 
                     }}
                ></div>
            </div>
        </div>
        
        <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span>0 XP</span>
            <span className="text-game-primary">{pointsInCurrentLevel} / 10 XP</span>
            <span>10 XP</span>
        </div>
        
        <div className="text-center mt-4">
            <span className="inline-block bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-xs font-bold">
                {pointsToNext} XP to Level {level + 1}
            </span>
        </div>
      </Card>

      {/* Settings Section */}
      <div className="mb-6">
          <h3 className="text-xs font-bold text-gray-200 uppercase tracking-widest mb-3 ml-2">App Settings</h3>
          <Card className="flex flex-col gap-4 py-4 !bg-slate-800 border-slate-700">
              
              {!isEditing && (
                <>
                    <button 
                        onClick={handleLogout}
                        className="flex items-center gap-4 w-full text-left group"
                    >
                         <div className="w-12 h-12 rounded-full bg-red-900/30 text-red-500 flex items-center justify-center group-hover:bg-red-900/50 transition-colors">
                            <i className="fas fa-sign-out-alt text-xl"></i>
                         </div>
                         <div>
                            <div className="font-bold text-red-400 text-lg">Log Out</div>
                            <div className="text-xs text-red-300/70 font-bold">Sign out of your account</div>
                         </div>
                    </button>
                </>
              )}
          </Card>
      </div>
    </div>
  );
};

export default ProfilePage;
