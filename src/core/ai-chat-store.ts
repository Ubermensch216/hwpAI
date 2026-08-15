/**
 * AI Assister 대화 히스토리 영속화 저장소 (IndexedDB 기반, 메모리 폴백 지원)
 */
import type { OllamaChatMessage } from './ollama';

export interface ChatSession {
  id: string;
  documentName: string;
  createdAt: number;
  updatedAt: number;
  messages: OllamaChatMessage[];
}

const DB_NAME = 'rhwp_ai_chat_db';
const DB_VER = 1;
const STORE_NAME = 'sessions';
const MAX_SESSIONS = 50;

function idbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

export class AiChatStore {
  private memoryStore = new Map<string, ChatSession>();

  private openDb(): Promise<IDBDatabase | null> {
    if (!idbAvailable()) return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VER);
        req.onerror = () => resolve(null);
        req.onsuccess = () => resolve(req.result);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('updatedAt', 'updatedAt', { unique: false });
            store.createIndex('documentName', 'documentName', { unique: false });
          }
        };
      } catch {
        resolve(null);
      }
    });
  }

  /** 세션 저장 또는 업데이트 */
  async saveSession(session: ChatSession): Promise<void> {
    if (!session.updatedAt) {
      session.updatedAt = Date.now();
    }
    this.memoryStore.set(session.id, { ...session, messages: [...session.messages] });

    const db = await this.openDb();
    if (!db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(session);
        req.onsuccess = () => {
          this.pruneOldSessions(MAX_SESSIONS).then(() => resolve()).catch(() => resolve());
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        resolve();
      }
    });
  }

  /** 특정 세션 불러오기 */
  async loadSession(id: string): Promise<ChatSession | null> {
    const db = await this.openDb();
    if (!db) {
      const mem = this.memoryStore.get(id);
      return mem ? { ...mem, messages: [...mem.messages] } : null;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => {
          const res = req.result as ChatSession | undefined;
          resolve(res || null);
        };
        req.onerror = () => {
          const mem = this.memoryStore.get(id);
          resolve(mem || null);
        };
      } catch {
        const mem = this.memoryStore.get(id);
        resolve(mem || null);
      }
    });
  }

  /** 모든 세션 목록 최신순 조회 */
  async listSessions(documentName?: string): Promise<ChatSession[]> {
    const db = await this.openDb();
    if (!db) {
      const list = Array.from(this.memoryStore.values());
      const filtered = documentName ? list.filter(s => s.documentName === documentName) : list;
      return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          let list = (req.result as ChatSession[]) || [];
          if (documentName) {
            list = list.filter(s => s.documentName === documentName);
          }
          list.sort((a, b) => b.updatedAt - a.updatedAt);
          resolve(list);
        };
        req.onerror = () => {
          const list = Array.from(this.memoryStore.values());
          resolve(list.sort((a, b) => b.updatedAt - a.updatedAt));
        };
      } catch {
        const list = Array.from(this.memoryStore.values());
        resolve(list.sort((a, b) => b.updatedAt - a.updatedAt));
      }
    });
  }

  /** 특정 세션 삭제 */
  async deleteSession(id: string): Promise<void> {
    this.memoryStore.delete(id);
    const db = await this.openDb();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /** 전체 대화 기록 초기화 */
  async clearAll(): Promise<void> {
    this.memoryStore.clear();
    const db = await this.openDb();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /** 오래된 세션 정리 (최대 개수 초과 시) */
  async pruneOldSessions(maxCount: number = MAX_SESSIONS): Promise<void> {
    const all = await this.listSessions();
    if (all.length <= maxCount) return;

    const toDelete = all.slice(maxCount);
    for (const session of toDelete) {
      await this.deleteSession(session.id);
    }
  }
}

export const aiChatStore = new AiChatStore();
