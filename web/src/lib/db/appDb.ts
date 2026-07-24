/**
 * T-XW03 — Opener IndexedDB HỢP NHẤT cho toàn bộ app web.
 *
 * GIỮ NGUYÊN `DB_NAME`/version-1 store `entries` (Library, F7/Q6a — `src/lib/libraryDb.ts`) để
 * KHÔNG mất dữ liệu Library hiện có của người dùng khi lên phiên bản mới. Bump `DB_VERSION` lên 2
 * và thêm 2 store MỚI (`projects`, `frames`) trong CÙNG `onupgradeneeded` — chỉ có DUY NHẤT một
 * `indexedDB.open()` call-site trong toàn app để tránh `VersionError` (2 module tự mở cùng DB ở
 * 2 version khác nhau sẽ đụng nhau).
 *
 * `frames` dùng keyPath phức hợp `[projectId, seq]` (khớp seq liên tục từ 0 của schema `.bbsproj`)
 * + index `by-project` trên `projectId` để liệt kê nhanh mọi frame của 1 dự án cho Hub/Capture.
 */

export const DB_NAME = 'bbstopmotion-library'
export const DB_VERSION = 2

/** v1 — Library (metadata phim đã export), xem `src/lib/libraryDb.ts`. */
export const STORE_ENTRIES = 'entries'
/** v2 — T-XW03: metadata dự án + denorm cho Hub. */
export const STORE_PROJECTS = 'projects'
/** v2 — T-XW03: frame thô (bytes JPEG dạng ArrayBuffer) của từng dự án. */
export const STORE_FRAMES = 'frames'
/** Index trên `frames.projectId` — liệt kê mọi frame của 1 dự án. */
export const FRAMES_BY_PROJECT_INDEX = 'by-project'

// Singleton connection — mọi call-site (libraryDb.ts + project/db.ts) share 1 kết nối thay vì mở
// mới mỗi lần gọi. Ngoài đỡ tốn tài nguyên, đây là cách chuẩn tránh IndexedDB "blocked" mãi mãi:
// nếu KHÔNG cache, mỗi CRUD call để lại 1 connection mở vĩnh viễn (không ai gọi `db.close()`) →
// một `indexedDB.deleteDatabase()`/nâng version sau đó (vd tab khác, hoặc test dọn DB) sẽ treo vô
// hạn vì luôn còn connection cũ chưa đóng chặn nó.
let dbPromise: Promise<IDBDatabase> | null = null

export function openAppDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        dbPromise = null
        reject(new Error('IndexedDB not available'))
        return
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result

        // v1 (giữ nguyên — không đụng dữ liệu Library cũ nếu store đã tồn tại).
        if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
          db.createObjectStore(STORE_ENTRIES, { keyPath: 'id' })
        }

        // v2 — T-XW03.
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORE_FRAMES)) {
          const framesStore = db.createObjectStore(STORE_FRAMES, { keyPath: ['projectId', 'seq'] })
          framesStore.createIndex(FRAMES_BY_PROJECT_INDEX, 'projectId')
        }
      }
      req.onsuccess = () => {
        const db = req.result
        // Tab/context khác yêu cầu nâng version (hoặc xoá DB) → đóng kết nối này ngay để nhường
        // chỗ, tránh chặn `onblocked` phía kia mãi mãi.
        db.onversionchange = () => {
          db.close()
          dbPromise = null
        }
        resolve(db)
      }
      req.onerror = () => {
        dbPromise = null
        reject(req.error ?? new Error('IndexedDB open failed'))
      }
    })
  }
  return dbPromise
}

/**
 * CHỈ dùng trong test: đóng kết nối đang cache + reset singleton, để test sau có thể mở lại DB ở
 * version khác (vd mô phỏng migration v1→v2 bằng `indexedDB.deleteDatabase()` giữa các test) mà
 * không bị "blocked" bởi kết nối cũ chưa đóng.
 */
export async function resetAppDbConnectionForTests(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise.catch(() => undefined)
    db?.close()
  }
  dbPromise = null
}
