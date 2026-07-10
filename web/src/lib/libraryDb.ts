import { LibraryEntry } from '../types'

/**
 * Web Library storage — IndexedDB (F7, Q6a đã chốt).
 * Chỉ lưu metadata (title, thumbnail dataURL nhỏ, uploadUrl, expiresAt, frameCount, duration)
 * — KHÔNG lưu blob phim nhị phân nặng (MP4/GIF) trong IndexedDB.
 */

const DB_NAME = 'bbstopmotion-library'
const DB_VERSION = 1
const STORE = 'entries'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
}

export async function addLibraryEntry(entry: LibraryEntry): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
  })
}

export async function listLibraryEntries(): Promise<LibraryEntry[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => {
      const entries = (req.result as LibraryEntry[]).sort((a, b) => b.createdAt - a.createdAt)
      resolve(entries)
    }
    req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'))
  })
}

export async function deleteLibraryEntry(id: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'))
  })
}

export async function updateLibraryEntry(id: string, patch: Partial<LibraryEntry>): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const existing = getReq.result as LibraryEntry | undefined
      if (existing) store.put({ ...existing, ...patch })
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB update failed'))
  })
}
