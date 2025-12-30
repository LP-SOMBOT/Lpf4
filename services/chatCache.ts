
import { ChatMessage } from '../types';

const DB_NAME = 'quiz_chat_cache';
const STORE_NAME = 'messages';
const DB_VERSION = 1;
const CACHE_LIMIT = 200;
const FALLBACK_LIMIT = 50;

class ChatCacheService {
  private db: IDBDatabase | null = null;
  private useLocalStorage = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    if (typeof window !== 'undefined' && !('indexedDB' in window)) {
      this.useLocalStorage = true;
    }
  }

  async init(): Promise<void> {
    if (this.useLocalStorage) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve) => {
      const timeout = setTimeout(() => {
          console.warn("IDB init timed out, falling back to LS");
          this.useLocalStorage = true;
          resolve();
      }, 2000); // 2 second timeout

      try {
          const request = indexedDB.open(DB_NAME, DB_VERSION);

          request.onerror = () => {
            clearTimeout(timeout);
            console.error('Failed to open chat cache DB');
            this.useLocalStorage = true;
            resolve();
          };

          request.onsuccess = (event) => {
            clearTimeout(timeout);
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
      } catch (e) {
          clearTimeout(timeout);
          console.error("IDB Open Error", e);
          this.useLocalStorage = true;
          resolve();
      }
    });
    return this.initPromise;
  }

  async saveMessage(message: ChatMessage): Promise<void> {
    if (!message.chatId || !message.id) return;

    if (!this.db && !this.useLocalStorage) await this.init();

    if (this.useLocalStorage || !this.db) {
      this.saveToLocalStorage(message);
      return;
    }

    return new Promise((resolve) => {
      try {
          const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          store.put(message);
          transaction.oncomplete = () => {
            this.cleanupChat(message.chatId!);
            resolve();
          };
          transaction.onerror = () => {
              this.saveToLocalStorage(message); // Fallback
              resolve();
          };
      } catch(e) {
          this.saveToLocalStorage(message); // Fallback
          resolve();
      }
    });
  }

  async getMessages(chatId: string, limit: number = 50, offsetTimestamp?: number): Promise<ChatMessage[]> {
    if (!this.db && !this.useLocalStorage) await this.init();

    if (this.useLocalStorage || !this.db) {
      return this.getFromLocalStorage(chatId, limit, offsetTimestamp);
    }

    return new Promise((resolve) => {
      try {
          const transaction = this.db!.transaction([STORE_NAME], 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const index = store.index('timestamp');
          
          const range = offsetTimestamp ? IDBKeyRange.upperBound(offsetTimestamp, true) : null;
          
          const messages: ChatMessage[] = [];
          const request = index.openCursor(range, 'prev');

          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
            if (cursor && messages.length < limit) {
              if (cursor.value.chatId === chatId) {
                messages.push(cursor.value);
              }
              cursor.continue();
            } else {
              resolve(messages.reverse());
            }
          };

          request.onerror = () => {
              console.warn("IDB Read Error, using LS");
              resolve(this.getFromLocalStorage(chatId, limit, offsetTimestamp));
          };
      } catch(e) {
          console.error("IDB Transaction Error", e);
          resolve(this.getFromLocalStorage(chatId, limit, offsetTimestamp));
      }
    });
  }

  async getLastMessageTimestamp(chatId: string): Promise<number> {
      try {
          const msgs = await this.getMessages(chatId, 1);
          return msgs.length > 0 ? msgs[msgs.length - 1].timestamp : 0;
      } catch {
          return 0;
      }
  }

  private async cleanupChat(chatId: string) {
    if (!this.db) return;
    try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('chatId');
        const countRequest = index.count(IDBKeyRange.only(chatId));

        countRequest.onsuccess = () => {
            if (countRequest.result > CACHE_LIMIT) {
                const diff = countRequest.result - CACHE_LIMIT;
                let deleted = 0;
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
    } catch (e) { console.error("Cleanup error", e); }
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
          const raw = localStorage.getItem(key);
          msgs = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(msgs)) msgs = [];
      } catch(e) { msgs = []; }

      // Deduplicate
      msgs = msgs.filter(m => m.id !== message.id && m.tempId !== message.tempId);
      msgs.push(message);
      
      msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      
      if (msgs.length > FALLBACK_LIMIT) {
          msgs = msgs.slice(msgs.length - FALLBACK_LIMIT);
      }
      
      try {
        localStorage.setItem(key, JSON.stringify(msgs));
      } catch (e) {
        console.warn("LocalStorage full or disabled");
      }
  }

  private getFromLocalStorage(chatId: string, limit: number = 50, offsetTimestamp?: number): ChatMessage[] {
      const key = this.getLocalStorageKey(chatId);
      try {
          const raw = localStorage.getItem(key);
          let msgs: ChatMessage[] = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(msgs)) return [];
          
          if (offsetTimestamp) {
              msgs = msgs.filter(m => m.timestamp < offsetTimestamp);
          }
          
          // Return last N messages
          if (msgs.length > limit) {
              msgs = msgs.slice(msgs.length - limit);
          }
          
          return msgs;
      } catch { return []; }
  }
}

export const chatCache = new ChatCacheService();
