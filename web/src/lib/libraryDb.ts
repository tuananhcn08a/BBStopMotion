import { LibraryEntry } from '../types'
import { openAppDb, STORE_ENTRIES as STORE, STORE_VIDEO_BLOBS } from './db/appDb'

/**
 * Web Library storage — IndexedDB (F7, Q6a đã chốt).
 * Lưu metadata (title, thumbnail/poster dataURL nhỏ, uploadUrl, expiresAt, frameCount, duration).
 *
 * T-XW03: opener hợp nhất chuyển sang `./db/appDb.ts` (DB bump lên version 2, thêm store
 * `projects`/`frames` — xem `src/lib/project/db.ts`). API + hành vi của module này KHÔNG đổi.
 *
 * T-XW17: blob MP4 nhị phân (nặng) giờ CÓ lưu trong IndexedDB — store RIÊNG `videoBlobs` (v3,
 * xem `saveLibraryVideoBlob`/`getLibraryVideoBlob` bên dưới), tách khỏi `entries` (vẫn chỉ
 * metadata nhẹ) để không phình bản ghi `entries` — trước T-XW17, blob chỉ sống trong RAM
 * (`App.tsx blobCacheRef`), mất khi reload trang.
 */

export async function addLibraryEntry(entry: LibraryEntry): Promise<void> {
  const db = await openAppDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
  })
}

export async function listLibraryEntries(): Promise<LibraryEntry[]> {
  const db = await openAppDb()
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
  const db = await openAppDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'))
  })
}

export async function updateLibraryEntry(id: string, patch: Partial<LibraryEntry>): Promise<void> {
  const db = await openAppDb()
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

// ---------- T-XW17 AC4 — persist blob MP4 (thay `blobCacheRef` RAM-only) ----------

interface VideoBlobRecord {
  id: string
  bytes: ArrayBuffer
  mimeType: string
}

/** Lưu blob MP4 đã export xuống IndexedDB — ArrayBuffer (không phải `Blob` trực tiếp, xem doc-
 *  comment đầu file). Gọi 1 lần ngay sau export xong (`App.tsx handleExport`), fire-and-forget. */
export async function saveLibraryVideoBlob(id: string, blob: Blob): Promise<void> {
  const bytes = await blob.arrayBuffer()
  const mimeType = blob.type || 'video/mp4'
  const db = await openAppDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VIDEO_BLOBS, 'readwrite')
    const record: VideoBlobRecord = { id, bytes, mimeType }
    tx.objectStore(STORE_VIDEO_BLOBS).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('saveLibraryVideoBlob failed'))
  })
}

/** Đọc lại blob MP4 (nếu có) — dựng lại `Blob` thật từ bytes ArrayBuffer, dùng được ngay cho
 *  `URL.createObjectURL`/upload. `undefined` khi chưa từng persist (phim rất cũ trước T-XW17) hoặc
 *  IndexedDB không khả dụng. */
export async function getLibraryVideoBlob(id: string): Promise<Blob | undefined> {
  const db = await openAppDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VIDEO_BLOBS, 'readonly')
    const req = tx.objectStore(STORE_VIDEO_BLOBS).get(id)
    req.onsuccess = () => {
      const record = req.result as VideoBlobRecord | undefined
      resolve(record ? new Blob([record.bytes], { type: record.mimeType }) : undefined)
    }
    req.onerror = () => reject(req.error ?? new Error('getLibraryVideoBlob failed'))
  })
}

/** Xoá blob MP4 persist — gọi cùng lúc xoá 1 phim khỏi Library (tránh rác mồ côi). */
export async function deleteLibraryVideoBlob(id: string): Promise<void> {
  const db = await openAppDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VIDEO_BLOBS, 'readwrite')
    tx.objectStore(STORE_VIDEO_BLOBS).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('deleteLibraryVideoBlob failed'))
  })
}
