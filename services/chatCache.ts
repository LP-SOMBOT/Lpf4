
import { ChatMessage } from '../types';

const DB_NAME = 'quiz_chat_cache';
const STORE_NAME = 'messages';
const DB_VERSION = 1;
const CACHE_LIMIT = 200;
const FALLBACK_LIMIT = 50;

class ChatCacheService {
  private db: IDBDatabase | null = null;
  private useLocalStorage = false;

  constructor() {
    if (!('indexedDB' in window)) {
      console.warn('IndexedDB not supported. Falling back to LocalStorage.');
      this.useLocalStorage = true;
    }
  }

  async init(): Promise<void> {
    if (this.useLocalStorage) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open chat cache DB');
        this.useLocalStorage = true;
        resolve();
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('chatId', 'chatId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async saveMessage(message: ChatMessage): Promise<void> {
    if (!message.chatId || !message.id) return;

    if (this.useLocalStorage) {
      this.saveToLocalStorage(message);
      return;
    }

    if (!this.db) await this.init();

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Put message
      store.put(message);

      transaction.oncomplete = () => {
        this.cleanupChat(message.chatId!);
        resolve();
      };
      
      transaction.onerror = () => resolve(); // Fail silently
    });
  }

  async getMessages(chatId: string, limit: number = 50, offsetTimestamp?: number): Promise<ChatMessage[]> {
    if (this.useLocalStorage) {
      return this.getFromLocalStorage(chatId);
    }

    if (!this.db) await this.init();

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      
      // We want messages BEFORE offsetTimestamp (older), or all if no offset
      const range = offsetTimestamp ? IDBKeyRange.upperBound(offsetTimestamp, true) : null;
      
      const messages: ChatMessage[] = [];
      // Iterate backwards (newest first)
      const request = index.openCursor(range, 'prev');

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
        if (cursor && messages.length < limit) {
          if (cursor.value.chatId === chatId) {
            messages.push(cursor.value);
          }
          cursor.continue();
        } else {
          // Return reversed to show chronological order in UI
          resolve(messages.reverse());
        }
      };

      request.onerror = () => resolve([]);
    });
  }

  async updateMessageStatus(id: string, status: 'sent' | 'delivered' | 'read'): Promise<void> {
    if (this.useLocalStorage) {
        // Not efficiently implemented for LS fallback, skipping for performance
        return;
    }
    if (!this.db) await this.init();

    return new Promise((resolve) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
            const data = request.result as ChatMessage;
            if (data) {
                data.msgStatus = status;
                store.put(data);
            }
            resolve();
        };
        request.onerror = () => resolve();
    });
  }

  async getLastMessageTimestamp(chatId: string): Promise<number> {
      const msgs = await this.getMessages(chatId, 1);
      return msgs.length > 0 ? msgs[msgs.length - 1].timestamp : 0;
  }

  private async cleanupChat(chatId: string) {
    if (!this.db) return;
    
    // Count items
    const transaction = this.db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('chatId');
    const countRequest = index.count(IDBKeyRange.only(chatId));

    countRequest.onsuccess = () => {
        if (countRequest.result > CACHE_LIMIT) {
            // Delete oldest
            const diff = countRequest.result - CACHE_LIMIT;
            let deleted = 0;
            // Open cursor normally (oldest first)
            const cursorReq = index.openCursor(IDBKeyRange.only(chatId));
            cursorReq.onsuccess = (e) => {
                const cursor = (e.target as IDBRequest).result as IDBCursor;
                if (cursor && deleted < diff) {
                    cursor.delete();
                    deleted++;
                    cursor.continue();
                }
            };
        }
    };
  }

  // --- LocalStorage Fallback ---
  private getLocalStorageKey(chatId: string) {
      return `chat_cache_${chatId}`;
  }

  private saveToLocalStorage(message: ChatMessage) {
      if (!message.chatId) return;
      const key = this.getLocalStorageKey(message.chatId);
      let msgs: ChatMessage[] = [];
      try {
          msgs = JSON.parse(localStorage.getItem(key) || '[]');
      } catch(e) { msgs = []; }

      // Remove existing if updating
      msgs = msgs.filter(m => m.id !== message.id && m.tempId !== message.tempId);
      msgs.push(message);
      
      // Sort
      msgs.sort((a, b) => a.timestamp - b.timestamp);
      
      // Limit
      if (msgs.length > FALLBACK_LIMIT) {
          msgs = msgs.slice(msgs.length - FALLBACK_LIMIT);
      }
      
      localStorage.setItem(key, JSON.stringify(msgs));
  }

  private getFromLocalStorage(chatId: string): ChatMessage[] {
      const key = this.getLocalStorageKey(chatId);
      try {
          return JSON.parse(localStorage.getItem(key) || '[]');
      } catch { return []; }
  }
}

export const chatCache = new ChatCacheService();
