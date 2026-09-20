'use client';

const DB_NAME = 'local_ai_audio_cache_db';
const DB_VERSION = 1;
const STORE_NAME = 'audio_cache';
const MAX_CACHE_ENTRIES = 60;

export const LAST_VOICE_STORAGE_KEY = 'last_tts_voice';
export const LAST_SPEED_STORAGE_KEY = 'last_tts_speed';
export const LAST_LANGUAGE_STORAGE_KEY = 'last_tts_language';

interface CacheRecord {
  key: string;
  blob: Blob;
  voice: string;
  language: string;
  speed: number;
  timestamp: number;
}

/**
 * Generates a consistent hash string for arbitrary text.
 */
function fastHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Creates a unique lookup key for a speech request based on voice, speed, and content.
 */
export function getAudioCacheKey(
  text: string,
  voice: string,
  language: string,
  speed: number,
): string {
  const normalized = text.trim();
  const hash = fastHash(normalized);
  const length = normalized.length;
  return `${language}_${voice}_${speed.toFixed(2)}_${length}_${hash}`;
}

/**
 * Opens or initializes the IndexedDB database for audio blobs.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Retrieves a cached audio Blob from IndexedDB if it exists.
 */
export async function getCachedAudio(
  text: string,
  voice: string,
  language: string,
  speed: number,
): Promise<Blob | null> {
  try {
    const db = await openDB();
    const key = getAudioCacheKey(text, voice, language, speed);

    return await new Promise<Blob | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const record = request.result as CacheRecord | undefined;
        if (record && record.blob) {
          resolve(record.blob);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Saves an audio Blob to the IndexedDB cache.
 * Automatically evicts older entries if cache exceeds MAX_CACHE_ENTRIES.
 */
export async function saveCachedAudio(
  text: string,
  voice: string,
  language: string,
  speed: number,
  blob: Blob,
): Promise<void> {
  try {
    const db = await openDB();
    const key = getAudioCacheKey(text, voice, language, speed);

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record: CacheRecord = {
        key,
        blob,
        voice,
        language,
        speed,
        timestamp: Date.now(),
      };

      const putRequest = store.put(record);

      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    });

    // Background prune if needed
    pruneOldCache(db).catch(() => {});
  } catch (err) {
    console.warn('Failed to save audio to IndexedDB cache:', err);
  }
}

/**
 * Evicts oldest cache items to enforce MAX_CACHE_ENTRIES.
 */
async function pruneOldCache(db: IDBDatabase): Promise<void> {
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('timestamp');

    const countReq = store.count();
    countReq.onsuccess = () => {
      const count = countReq.result;
      if (count <= MAX_CACHE_ENTRIES) return;

      const deleteCount = count - MAX_CACHE_ENTRIES;
      let deleted = 0;

      const cursorReq = index.openCursor();
      cursorReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor && deleted < deleteCount) {
          cursor.delete();
          deleted++;
          cursor.continue();
        }
      };
    };
  } catch {
    // Ignore prune errors
  }
}

/**
 * Gets the saved voice preference from localStorage, or falls back to 'af_heart'.
 */
export function getSavedVoice(): string {
  if (typeof window === 'undefined') return 'af_heart';
  try {
    return localStorage.getItem(LAST_VOICE_STORAGE_KEY) || 'af_heart';
  } catch {
    return 'af_heart';
  }
}

/**
 * Saves the last used voice preference to localStorage.
 */
export function saveLastUsedVoice(voice: string): void {
  if (typeof window === 'undefined' || !voice) return;
  try {
    localStorage.setItem(LAST_VOICE_STORAGE_KEY, voice);
  } catch (err) {
    console.warn('Failed to persist last used voice:', err);
  }
}

/**
 * Gets the saved speed preference from localStorage, or falls back to 1.0.
 */
export function getSavedSpeed(): number {
  if (typeof window === 'undefined') return 1.0;
  try {
    const saved = localStorage.getItem(LAST_SPEED_STORAGE_KEY);
    if (!saved) return 1.0;
    const parsed = parseFloat(saved);
    return isNaN(parsed) || parsed <= 0 ? 1.0 : parsed;
  } catch {
    return 1.0;
  }
}

/**
 * Saves the last used speed preference to localStorage.
 */
export function saveLastUsedSpeed(speed: number): void {
  if (typeof window === 'undefined' || !speed) return;
  try {
    localStorage.setItem(LAST_SPEED_STORAGE_KEY, speed.toString());
  } catch (err) {
    console.warn('Failed to persist last used speed:', err);
  }
}
