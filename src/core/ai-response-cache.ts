/**
 * LLM 응답 캐시 (Response Cache) 레이어
 * 동일한 요청 및 맥락에 대해 불필요한 LLM 추론 호출을 방지하고 즉각적인 응답을 제공합니다.
 */

export interface CacheEntry<T = string> {
  key: string;
  data: T;
  createdAt: number;
  expiresAt: number;
  metrics?: {
    durationMs: number;
    evalCount: number;
    tokPerSec?: number;
  };
}

export class AiResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxEntries: number;
  private defaultTtlMs: number;
  private storageKey = 'rhwp-ai-response-cache';

  constructor(maxEntries: number = 50, defaultTtlMs: number = 1000 * 60 * 60) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
    this.loadFromStorage();
  }

  /** 캐시 키 생성 (SHA-like deterministic hash) */
  hashKey(input: string | object): string {
    const raw = typeof input === 'string' ? input : JSON.stringify(input);
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `ai_cache_${Math.abs(hash).toString(36)}_${raw.length}`;
  }

  /** 캐시 조회 */
  get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  /** 캐시 저장 */
  set(
    key: string,
    data: string,
    metrics?: { durationMs: number; evalCount: number; tokPerSec?: number },
    ttlMs: number = this.defaultTtlMs,
  ): void {
    if (this.cache.size >= this.maxEntries) {
      // LRU: 가장 오래된 첫 번째 항목 제거
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    const now = Date.now();
    this.cache.set(key, {
      key,
      data,
      createdAt: now,
      expiresAt: now + ttlMs,
      metrics,
    });

    this.saveToStorage();
  }

  /** 캐시 전체 삭제 */
  clear(): void {
    this.cache.clear();
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(this.storageKey);
      }
    } catch {}
  }

  /** 캐시 크기 */
  size(): number {
    return this.cache.size;
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const entries = Array.from(this.cache.entries()).slice(-20);
        localStorage.setItem(this.storageKey, JSON.stringify(entries));
      }
    } catch {}
  }

  private loadFromStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) {
          const entries: [string, CacheEntry][] = JSON.parse(raw);
          const now = Date.now();
          for (const [k, v] of entries) {
            if (v && v.expiresAt > now) {
              this.cache.set(k, v);
            }
          }
        }
      }
    } catch {}
  }
}

export const aiResponseCache = new AiResponseCache();
