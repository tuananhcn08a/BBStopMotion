/**
 * T-XW03 — AC3: IndexedDB v2 GIỮ DB name cũ (`bbstopmotion-library`), Library store cũ (`entries`)
 * KHÔNG mất dữ liệu sau khi app bump lên version 2 (thêm store `projects`/`frames`). Test mô
 * phỏng đúng kịch bản người dùng cũ: DB đã tồn tại ở version 1 (chỉ có `entries`, dữ liệu Library
 * thật) → mở lại bằng opener MỚI (`openAppDb`, version hiện tại) → verify:
 *   1. `entries` cũ đọc lại đủ, không mất/hỏng dữ liệu (không có `VersionError`).
 *   2. Mọi store mới (`projects`/`frames`/`videoBlobs`) đã tồn tại và dùng được ngay.
 *
 * T-XW17 — bump thêm lên v3 (+ store `videoBlobs`) — test này giờ verify CHUỖI migration v1→v3
 * (không chỉ v1→v2), đúng kịch bản người dùng có DB v1 rất cũ mở app bản mới nhất thẳng 1 phát
 * (IndexedDB tự chạy nối tiếp mọi mốc `onupgradeneeded` bỏ lỡ, không dừng giữa chừng ở v2).
 *
 * jsdom KHÔNG implement IndexedDB → dùng driver thật `fake-indexeddb` (không mock nội bộ).
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  DB_NAME,
  DB_VERSION,
  openAppDb,
  resetAppDbConnectionForTests,
  STORE_ENTRIES,
  STORE_PROJECTS,
  STORE_FRAMES,
  STORE_VIDEO_BLOBS,
} from '../src/lib/db/appDb'
import { listLibraryEntries } from '../src/lib/libraryDb'
import { createProject, listProjects } from '../src/lib/project/db'
import { LibraryEntry } from '../src/types'

/** Đóng kết nối singleton (`appDb.ts`) TRƯỚC khi xoá DB — nếu không, connection cũ chưa đóng của
 * test trước sẽ chặn `deleteDatabase()` treo vô hạn. */
async function deleteDb(): Promise<void> {
  await resetAppDbConnectionForTests()
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error ?? new Error('deleteDatabase failed'))
    req.onblocked = () => resolve()
  })
}

/** Mở DB ở đúng version 1 với CHỈ store `entries` — tái tạo state "người dùng cũ" TRƯỚC T-XW03. */
function openLegacyV1Db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('entries')) {
        db.createObjectStore('entries', { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('openLegacyV1Db failed'))
  })
}

function makeLegacyEntry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id: 'lib-legacy-1',
    title: 'Phim cũ trước migration',
    thumbnailDataUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ycACwAAAAABAAEAAAIBTAA7',
    frameCount: 12,
    durationSeconds: 1.2,
    createdAt: 1700000000000,
    ...overrides,
  }
}

async function seedLegacyEntry(entry: LibraryEntry): Promise<void> {
  const legacyDb = await openLegacyV1Db()
  await new Promise<void>((resolve, reject) => {
    const tx = legacyDb.transaction('entries', 'readwrite')
    tx.objectStore('entries').put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('seedLegacyEntry failed'))
  })
  legacyDb.close()
}

beforeEach(async () => {
  await deleteDb()
})

describe('IndexedDB v2 migration — giữ Library store cũ (AC3)', () => {
  it('DB đã có dữ liệu Library ở version 1 → mở lại bằng openAppDb (v3 hiện tại) → entries còn nguyên', async () => {
    // Bước 1: mô phỏng người dùng cũ — DB version 1, có 1 entry Library thật.
    await seedLegacyEntry(makeLegacyEntry())

    // Bước 2: app mới mở DB bằng opener hợp nhất (bump lên DB_VERSION hiện tại, nay =3) — DB v1
    // đã tồn tại nên `onupgradeneeded` chạy đúng đường "nâng cấp" (1 → 3, chạy nối tiếp qua mốc
    // 2), không phải "tạo mới" (0 → 3).
    const db = await openAppDb()

    expect(db.version).toBe(DB_VERSION)
    expect(db.objectStoreNames.contains(STORE_ENTRIES)).toBe(true)
    expect(db.objectStoreNames.contains(STORE_PROJECTS)).toBe(true)
    expect(db.objectStoreNames.contains(STORE_FRAMES)).toBe(true)
    expect(db.objectStoreNames.contains(STORE_VIDEO_BLOBS)).toBe(true)

    const entries = await new Promise<LibraryEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_ENTRIES, 'readonly')
      const req = tx.objectStore(STORE_ENTRIES).getAll()
      req.onsuccess = () => resolve(req.result as LibraryEntry[])
      req.onerror = () => reject(req.error ?? new Error('read entries failed'))
    })
    expect(entries).toHaveLength(1)
    expect(entries[0]).toEqual(makeLegacyEntry())
    db.close()
  })

  it('sau migration, libraryDb.ts (API cũ, không đổi) vẫn đọc đúng entry đã có từ trước', async () => {
    await seedLegacyEntry(makeLegacyEntry({ id: 'lib-legacy-2', title: 'Phim cũ #2' }))

    const entries = await listLibraryEntries()
    expect(entries.map(e => e.id)).toEqual(['lib-legacy-2'])
  })

  it('sau migration, tầng project mới (projects/frames) dùng được ngay dù DB có sẵn Library cũ', async () => {
    await seedLegacyEntry(makeLegacyEntry())

    await createProject('animation', 'Dự án sau migration')
    const projects = await listProjects()
    expect(projects).toHaveLength(1)
    expect(projects[0].title).toBe('Dự án sau migration')

    // Library cũ vẫn còn nguyên song song.
    const entries = await listLibraryEntries()
    expect(entries).toHaveLength(1)
  })
})

/** Mở DB ở đúng version 2 với store `entries`/`projects`/`frames` (KHÔNG `videoBlobs`) — tái tạo
 *  state "người dùng T-XW03..T-XW14" (trước T-XW17) TRƯỚC khi bump lên v3. */
function openLegacyV2Db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('frames')) {
        const framesStore = db.createObjectStore('frames', { keyPath: ['projectId', 'seq'] })
        framesStore.createIndex('by-project', 'projectId')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('openLegacyV2Db failed'))
  })
}

describe('IndexedDB v3 migration — thêm store videoBlobs (T-XW17 AC4), không đụng v1/v2 data', () => {
  it('DB đã ở v2 (có Library + 1 dự án/frame thật) → mở lại bằng openAppDb (v3) → videoBlobs mới có, data cũ nguyên vẹn', async () => {
    const legacyDb = await openLegacyV2Db()
    await new Promise<void>((resolve, reject) => {
      const tx = legacyDb.transaction(['entries', 'projects', 'frames'], 'readwrite')
      tx.objectStore('entries').put(makeLegacyEntry({ id: 'lib-v2', title: 'Phim v2' }))
      tx.objectStore('projects').put({
        schemaVersion: 1, id: 'proj-v2', title: 'Dự án v2', kind: 'animation',
        fpsLevel: 'normal', createdAt: 1700000000000, frameCount: 1,
      })
      tx.objectStore('frames').put({
        projectId: 'proj-v2', seq: 0, file: 'frames/0001.jpg', capturedAt: 1700000000000,
        bytes: new ArrayBuffer(4),
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('seed v2 failed'))
    })
    legacyDb.close()

    const db = await openAppDb()
    expect(db.version).toBe(DB_VERSION)
    expect(db.objectStoreNames.contains(STORE_VIDEO_BLOBS)).toBe(true)

    // Data v1/v2 cũ còn nguyên (không bị `onupgradeneeded` mới đụng vào/xoá nhầm).
    const entries = await listLibraryEntries()
    expect(entries.map(e => e.id)).toEqual(['lib-v2'])
    const projects = await listProjects()
    expect(projects.map(p => p.id)).toEqual(['proj-v2'])

    // Store videoBlobs mới TRỐNG (chưa có dữ liệu, dùng được ngay).
    const emptyRead = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE_VIDEO_BLOBS, 'readonly')
      const req = tx.objectStore(STORE_VIDEO_BLOBS).get('khong-ton-tai')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    expect(emptyRead).toBeUndefined()
    db.close()
  })
})
