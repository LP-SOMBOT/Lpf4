
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
    if (typeof window !== 'undefined' && !('indexedDB' in window)) {
      console.warn('IndexedDB not supported. Falling back to LocalStorage.');
      this.useLocalStorage = true;
    }
  }

  async init(): Promise<void> {
    if (this.useLocalStorage) return;

    return new Promise((resolve) => {
      try {
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
      } catch (e) {
          console.error("IDB Open Error", e);
          this.useLocalStorage = true;
          resolve();
      }
    });
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
              // Fallback silently
              this.saveToLocalStorage(message);
              resolve();
          };
      } catch(e) {
          this.saveToLocalStorage(message);
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

          request.onerror = () => {
              console.warn("IDB Read Error");
              resolve(this.getFromLocalStorage(chatId, limit, offsetTimestamp));
          };
      } catch(e) {
          console.error("IDB Transaction Error", e);
          resolve(this.getFromLocalStorage(chatId, limit, offsetTimestamp));
      }
    });
  }

  async updateMessageStatus(id: string, status: 'sent' | 'delivered' | 'read'): Promise<void> {
    if (!this.db && !this.useLocalStorage) await this.init();
    
    if (this.useLocalStorage || !this.db) return;

    return new Promise((resolve) => {
        try {
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
        } catch { resolve(); }
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
                // Oldest first
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
          msgs = JSON.parse(localStorage.getItem(key) || '[]');
      } catch(e) { msgs = []; }

      // Remove existing if updating (by id or tempId)
      msgs = msgs.filter(m => m.id !== message.id && m.tempId !== message.tempId);
      msgs.push(message);
      
      // Sort by timestamp
      msgs.sort((a, b) => a.timestamp - b.timestamp);
      
      // Limit size
      if (msgs.length > FALLBACK_LIMIT) {
          msgs = msgs.slice(msgs.length - FALLBACK_LIMIT);
      }
      
      localStorage.setItem(key, JSON.stringify(msgs));
  }

  private getFromLocalStorage(chatId: string, limit: number = 50, offsetTimestamp?: number): ChatMessage[] {
      const key = this.getLocalStorageKey(chatId);
      try {
          let msgs: ChatMessage[] = JSON.parse(localStorage.getItem(key) || '[]');
          
          // Filter if offset is provided (fetch older messages)
          if (offsetTimestamp) {
              msgs = msgs.filter(m => m.timestamp < offsetTimestamp);
          }
          
          // Since LS stores in chronological order (old -> new), 
          // and we usually want the *latest* subset for the UI:
          if (msgs.length > limit) {
              msgs = msgs.slice(msgs.length - limit);
          }
          
          return msgs;
      } catch { return []; }
  }
}

export const chatCache = new ChatCacheService();
