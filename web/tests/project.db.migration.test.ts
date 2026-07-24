/**
 * T-XW03 — AC3: IndexedDB v2 GIỮ DB name cũ (`bbstopmotion-library`), Library store cũ (`entries`)
 * KHÔNG mất dữ liệu sau khi app bump lên version 2 (thêm store `projects`/`frames`). Test mô
 * phỏng đúng kịch bản người dùng cũ: DB đã tồn tại ở version 1 (chỉ có `entries`, dữ liệu Library
 * thật) → mở lại bằng opener MỚI (`openAppDb`, version 2) → verify:
 *   1. `entries` cũ đọc lại đủ, không mất/hỏng dữ liệu (không có `VersionError`).
 *   2. 2 store mới `projects`/`frames` đã tồn tại và dùng được ngay.
 *
 * jsdom KHÔNG implement IndexedDB → dùng driver thật `fake-indexeddb` (không mock nội bộ).
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  DB_NAME,
  openAppDb,
  resetAppDbConnectionForTests,
  STORE_ENTRIES,
  STORE_PROJECTS,
  STORE_FRAMES,
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
  it('DB đã có dữ liệu Library ở version 1 → mở lại bằng openAppDb (v2) → entries còn nguyên', async () => {
    // Bước 1: mô phỏng người dùng cũ — DB version 1, có 1 entry Library thật.
    await seedLegacyEntry(makeLegacyEntry())

    // Bước 2: app mới mở DB bằng opener hợp nhất (bump version 2) — DB v1 đã tồn tại nên
    // `onupgradeneeded` chạy đúng đường "nâng cấp" (1 → 2), không phải "tạo mới" (0 → 2).
    const db = await openAppDb()

    expect(db.version).toBe(2)
    expect(db.objectStoreNames.contains(STORE_ENTRIES)).toBe(true)
    expect(db.objectStoreNames.contains(STORE_PROJECTS)).toBe(true)
    expect(db.objectStoreNames.contains(STORE_FRAMES)).toBe(true)

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
