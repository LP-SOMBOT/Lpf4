
export interface UserProfile {
  uid: string;
  name: string;
  email?: string; // Optional for guests
  username?: string; // Unique handle
  points: number;
  avatar: string; // URL
  gender?: 'male' | 'female';
  activeMatch?: string | null;
  role?: 'user' | 'admin';
  banned?: boolean;
  avatarUpdated?: boolean;
  usernameUpdated?: boolean; // Track if guest has set/skipped username
  isVerified?: boolean; // Blue tick
  verificationNotificationPending?: boolean; // Trigger for Congrats Modal
  isSupport?: boolean; // Orange tick (Support Verified)
  allowCustomAvatar?: boolean; // Privilege to upload custom pics
  isGuest?: boolean;
  isOnline?: boolean;
  lastSeen?: number;
  createdAt?: number; // Registration timestamp
  friends?: { [uid: string]: boolean };
}

export interface Subject {
  id: string;
  name: string;
}

export interface Chapter {
  id: string;
  name: string;
  subjectId: string;
}

export interface Question {
  id: string | number;
  question: string;
  options: string[];
  answer: number; // Index of correct answer
  subject: string; // This will now typically refer to the chapterId
}

export interface QuestionReport {
  id: string;
  questionId: string;
  chapterId: string;
  reason: string;
  reporterUid: string;
  timestamp: number;
  questionText: string;
}

export interface MatchReaction {
  senderId: string;
  value: string;
  timestamp: number;
}

export interface MatchState {
  matchId: string;
  status: 'active' | 'completed' | 'cancelled';
  mode: 'auto' | 'custom' | '4p'; // Added 4p
  turn?: string; // 1v1 Only
  currentQ: number; // index of DEMO_DATA
  answersCount?: number; // 1v1 Only
  
  // 4P Specific: Track who answered current Q
  currentAnswers?: { [uid: string]: boolean }; 
  
  scores: {
    [uid: string]: number;
  };
  
  // Tie-breaker for 4P
  totalResponseTime?: {
      [uid: string]: number; 
  };

  players: {
    [uid: string]: {
      name: string;
      avatar: string;
      level?: number;
      status?: 'online' | 'offline';
      lastSeen?: number;
      isSpeaking?: boolean; 
    }
  };
  winner?: string | null; // 'draw', 'disconnect', or uid
  subject: string;
  subjectTitle?: string; 
  questionLimit?: number; 
  lastReaction?: MatchReaction;
}

export interface Room {
  host: string;
  sid: string; // Subject ID
  lid: string; // Chapter ID 
  code: string;
  mode?: '1v1' | '4p';
  questionLimit: number;
  createdAt: number;
  linkedChatPath?: string;
  // Track players in Lobby for 4P
  players?: {
      [uid: string]: {
          name: string;
          avatar: string;
      }
  }
}

export interface ChatMessage {
  id: string;
  tempId?: string; 
  chatId?: string; 
  sender: string;
  text: string;
  timestamp: number;
  type?: 'text' | 'invite'; 
  msgStatus?: 'sending' | 'sent' | 'delivered' | 'read'; 
  inviteCode?: string; 
  subjectName?: string; 
  status?: 'waiting' | 'played' | 'canceled' | 'expired';
}
