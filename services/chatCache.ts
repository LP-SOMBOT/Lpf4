

import { ChatMessage } from '../types';

const CACHE_KEY_PREFIX = 'quiz_chat_v2_'; 
const CACHE_LIMIT = 100; // Limit per chat to safe size for LocalStorage

class ChatCacheService {
  
  private getKey(chatId: string) {
      return `${CACHE_KEY_PREFIX}${chatId}`;
  }

  // Save or Update a message in LocalStorage
  async saveMessage(message: ChatMessage): Promise<void> {
    if (!message.chatId || !message.id) return;
    const key = this.getKey(message.chatId);
    
    let msgs: ChatMessage[] = [];
    try {
        const raw = localStorage.getItem(key);
        msgs = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(msgs)) msgs = [];
    } catch(e) { msgs = []; }

    // Deduplication & Merge Logic
    const existingIndex = msgs.findIndex(m => m.id === message.id);
    
    if (existingIndex !== -1) {
        // Update existing message (e.g. status change sent -> delivered)
        msgs[existingIndex] = { ...msgs[existingIndex], ...message };
    } else {
        // Heuristic: Check if this "real" message replaces a "temp" message
        // This prevents duplicates when Firebase confirms a message previously added optimistically
        const isTemp = message.id.startsWith('temp_');
        let replaced = false;

        if (!isTemp) {
            // Find a temp message with same content sent recently (5s window)
            const tempIndex = msgs.findIndex(m => 
                m.id.startsWith('temp_') &&
                m.text === message.text &&
                m.sender === message.sender &&
                Math.abs((m.timestamp || 0) - (message.timestamp || 0)) < 5000
            );
            
            if (tempIndex !== -1) {
                msgs[tempIndex] = message; // Swap temp for real
                replaced = true;
            }
        }

        if (!replaced) {
            msgs.push(message);
        }
    }
    
    // Sort by timestamp (Oldest -> Newest)
    msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    // Enforce Limit (Keep latest N)
    if (msgs.length > CACHE_LIMIT) {
        msgs = msgs.slice(msgs.length - CACHE_LIMIT);
    }
    
    try {
        localStorage.setItem(key, JSON.stringify(msgs));
    } catch (e) {
        console.warn("LocalStorage quota or error", e);
    }
  }

  // Retrieve messages with optional pagination support
  async getMessages(chatId: string, limit: number = 50, offsetTimestamp?: number): Promise<ChatMessage[]> {
    const key = this.getKey(chatId);
    try {
        const raw = localStorage.getItem(key);
        let msgs: ChatMessage[] = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(msgs)) return [];

        // Ensure timestamps exist
        msgs = msgs.filter(m => m && typeof m.timestamp === 'number');

        // Filter: Get messages OLDER than offsetTimestamp (for scrolling up)
        if (offsetTimestamp) {
            msgs = msgs.filter(m => m.timestamp < offsetTimestamp);
        }

        // Return last 'limit' messages
        if (msgs.length > limit) {
            msgs = msgs.slice(msgs.length - limit);
        }
        
        // Ensure sorted
        msgs.sort((a, b) => a.timestamp - b.timestamp);

        return msgs;
    } catch (e) {
        return [];
    }
  }

  // Get the timestamp of the latest message to optimize Firebase sync
  async getLastMessageTimestamp(chatId: string): Promise<number> {
      try {
          const msgs = await this.getMessages(chatId, 100);
          if (msgs.length === 0) return 0;
          return msgs[msgs.length - 1].timestamp;
      } catch {
          return 0;
      }
  }
}

export const chatCache = new ChatCacheService();
