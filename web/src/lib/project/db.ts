import { FpsLevel } from '../../types'
import { openAppDb, STORE_PROJECTS, STORE_FRAMES, FRAMES_BY_PROJECT_INDEX } from '../db/appDb'
import { defaultFpsLevel } from './fps'
import {
  CURRENT_SCHEMA_VERSION,
  Project,
  ProjectFrame,
  ProjectKind,
  ProjectMeta,
  defaultProjectTitle,
  frameFileName,
  newProjectId,
} from './types'

/**
 * T-XW03 — tầng store thuần dữ liệu (no React) cho `projects`/`frames`. KEYSTONE của phase web:
 * fix điểm yếu "refresh mất frame" (frames trước đây chỉ sống trong React state) — mọi
 * `addFrame` ghi bytes JPEG + cập nhật denorm project trong CÙNG 1 transaction (mô phỏng autosave
 * đồng bộ của `ProjectStore.swift`: kill/refresh ngay sau khi Promise resolve không mất frame).
 *
 * `projects` store lưu METADATA + denorm (frameCount/coverFrameSeq/lastCapturedAt) — KHÔNG lưu
 * mảng `frames` (frames thô sống ở store `frames` riêng, keyPath `[projectId, seq]`). `getProject`
 * join 2 store lại thành đúng shape `Project` (§types.ts) cho call site ngoài.
 */

/** Record thật sự nằm trong object store `projects` (không có `frames` — xem module doc). */
interface ProjectRecord {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION
  id: string
  title: string
  kind: ProjectKind
  fpsLevel: FpsLevel
  createdAt: number
  lastCapturedAt?: number
  exportedAt?: number
  frameCount: number
  coverFrameSeq?: number
}

/** Record thật sự nằm trong object store `frames` — bytes JPEG thô dạng ArrayBuffer. */
interface FrameRecord {
  projectId: string
  seq: number
  file: string
  capturedAt: number
  bytes: ArrayBuffer
}

/** Bỏ hẳn các key có giá trị `undefined` trước khi ghi IndexedDB (khớp `encodeIfPresent` Swift —
 * quan trọng để `getProject()`/`listProjects()` trả object không có key `lastCapturedAt`/`exportedAt`
 * khi chưa có giá trị, đúng schema thay vì ghi `undefined`). */
function stripUndefined<T extends object>(obj: T): T {
  const out = {} as T
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) out[key] = obj[key]
  }
  return out
}

function toProjectMeta(r: ProjectRecord): ProjectMeta {
  return stripUndefined({
    id: r.id,
    title: r.title,
    kind: r.kind,
    fpsLevel: r.fpsLevel,
    frameCount: r.frameCount,
    coverFrameSeq: r.coverFrameSeq,
    createdAt: r.createdAt,
    lastCapturedAt: r.lastCapturedAt,
    exportedAt: r.exportedAt,
  })
}

function toProjectFrame(r: FrameRecord): ProjectFrame {
  return { seq: r.seq, file: r.file, capturedAt: r.capturedAt }
}

// ---------- CRUD dự án ----------

/** S2 — tạo dự án mới, fps mặc định theo `kind`, 0 frame. */
export async function createProject(kind: ProjectKind, title?: string): Promise<Project> {
  const db = await openAppDb()
  const id = newProjectId()
  const createdAt = Date.now()
  const fpsLevel = defaultFpsLevel(kind)
  const resolvedTitle = title?.trim() || defaultProjectTitle(kind)

  const record: ProjectRecord = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id,
    title: resolvedTitle,
    kind,
    fpsLevel,
    createdAt,
    frameCount: 0,
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite')
    tx.objectStore(STORE_PROJECTS).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('createProject failed'))
  })

  return { schemaVersion: CURRENT_SCHEMA_VERSION, id, title: resolvedTitle, kind, fpsLevel, createdAt, frames: [] }
}

/** Đọc 1 dự án đầy đủ (metadata + `frames[]` join từ store `frames`, sort theo `seq`). */
export async function getProject(id: string): Promise<Project | undefined> {
  const db = await openAppDb()
  const record = await new Promise<ProjectRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readonly')
    const req = tx.objectStore(STORE_PROJECTS).get(id)
    req.onsuccess = () => resolve(req.result as ProjectRecord | undefined)
    req.onerror = () => reject(req.error ?? new Error('getProject failed'))
  })
  if (!record) return undefined

  const frames = await getFrames(id)
  return stripUndefined({
    schemaVersion: record.schemaVersion,
    id: record.id,
    title: record.title,
    kind: record.kind,
    fpsLevel: record.fpsLevel,
    createdAt: record.createdAt,
    lastCapturedAt: record.lastCapturedAt,
    exportedAt: record.exportedAt,
    frames,
  })
}

/** Danh sách denorm cho Hub — mới nhất lên đầu (cùng quy ước `listLibraryEntries`). */
export async function listProjects(): Promise<ProjectMeta[]> {
  const db = await openAppDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readonly')
    const req = tx.objectStore(STORE_PROJECTS).getAll()
    req.onsuccess = () => {
      const records = req.result as ProjectRecord[]
      const metas = records.map(toProjectMeta).sort((a, b) => b.createdAt - a.createdAt)
      resolve(metas)
    }
    req.onerror = () => reject(req.error ?? new Error('listProjects failed'))
  })
}

export async function renameProject(id: string, title: string): Promise<void> {
  const db = await openAppDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite')
    const store = tx.objectStore(STORE_PROJECTS)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const record = getReq.result as ProjectRecord | undefined
      if (record) {
        record.title = title
        store.put(record)
      }
    }
    getReq.onerror = () => reject(getReq.error ?? new Error('renameProject read failed'))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('renameProject failed'))
  })
}

/** AC6 — xoá dự án + CASCADE mọi frame của nó (không rò rỉ record `frames` mồ côi). */
export async function deleteProject(id: string): Promise<void> {
  const db = await openAppDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PROJECTS, STORE_FRAMES], 'readwrite')
    tx.objectStore(STORE_PROJECTS).delete(id)

    const idx = tx.objectStore(STORE_FRAMES).index(FRAMES_BY_PROJECT_INDEX)
    const cursorReq = idx.openCursor(IDBKeyRange.only(id))
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
    cursorReq.onerror = () => reject(cursorReq.error ?? new Error('deleteProject cascade failed'))

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('deleteProject failed'))
  })
}

// ---------- Frames ----------

/** AC4 — autosave: ghi bytes JPEG + cập nhật denorm project TRONG CÙNG 1 transaction. */
export function addFrame(
  projectId: string,
  jpegBytes: ArrayBuffer,
  capturedAt: number = Date.now(),
): Promise<ProjectFrame> {
  return openAppDb().then(
    db =>
      new Promise<ProjectFrame>((resolve, reject) => {
        const tx = db.transaction([STORE_PROJECTS, STORE_FRAMES], 'readwrite')
        const projectsStore = tx.objectStore(STORE_PROJECTS)
        const framesStore = tx.objectStore(STORE_FRAMES)
        let newFrame: ProjectFrame | undefined

        const getReq = projectsStore.get(projectId)
        getReq.onsuccess = () => {
          const record = getReq.result as ProjectRecord | undefined
          if (!record) {
            reject(new Error(`addFrame: project ${projectId} không tồn tại`))
            tx.abort()
            return
          }
          const seq = record.frameCount
          const file = frameFileName(seq)
          const frameRecord: FrameRecord = { projectId, seq, file, capturedAt, bytes: jpegBytes }
          framesStore.put(frameRecord)

          record.frameCount = seq + 1
          record.coverFrameSeq = seq
          record.lastCapturedAt = capturedAt
          projectsStore.put(record)

          newFrame = { seq, file, capturedAt }
        }
        getReq.onerror = () => reject(getReq.error ?? new Error('addFrame read failed'))

        tx.oncomplete = () => {
          if (newFrame) resolve(newFrame)
        }
        tx.onerror = () => reject(tx.error ?? new Error('addFrame failed'))
      }),
  )
}

/** Danh sách frame (metadata only, KHÔNG bytes) của 1 dự án, sort theo `seq` tăng dần. */
export async function getFrames(projectId: string): Promise<ProjectFrame[]> {
  const db = await openAppDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FRAMES, 'readonly')
    const idx = tx.objectStore(STORE_FRAMES).index(FRAMES_BY_PROJECT_INDEX)
    const req = idx.getAll(IDBKeyRange.only(projectId))
    req.onsuccess = () => {
      const records = (req.result as FrameRecord[]).sort((a, b) => a.seq - b.seq)
      resolve(records.map(toProjectFrame))
    }
    req.onerror = () => reject(req.error ?? new Error('getFrames failed'))
  })
}

/** Bytes JPEG thô của 1 frame — dùng cho preview/onion-skin/ghép phim. */
export async function getFrameBytes(projectId: string, seq: number): Promise<ArrayBuffer | undefined> {
  const db = await openAppDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FRAMES, 'readonly')
    const req = tx.objectStore(STORE_FRAMES).get([projectId, seq])
    req.onsuccess = () => resolve((req.result as FrameRecord | undefined)?.bytes)
    req.onerror = () => reject(req.error ?? new Error('getFrameBytes failed'))
  })
}

/**
 * Xoá 1 frame + renumber các frame còn lại liên tục từ 0 (giữ 2 bất biến schema: `seq` liên tục
 * VÀ tên file `seq+1` pad 4 — khớp `ProjectStore.deleteFrame` phía iOS). No-op an toàn nếu `seq`
 * không tồn tại. Chuẩn bị cho UI sắp xếp/xoá frame (wave sau) — chưa có UI ở task này.
 */
export function deleteFrame(projectId: string, seq: number): Promise<void> {
  return openAppDb().then(
    db =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_PROJECTS, STORE_FRAMES], 'readwrite')
        const projectsStore = tx.objectStore(STORE_PROJECTS)
        const framesStore = tx.objectStore(STORE_FRAMES)
        const idx = framesStore.index(FRAMES_BY_PROJECT_INDEX)

        const getAllReq = idx.getAll(IDBKeyRange.only(projectId))
        getAllReq.onsuccess = () => {
          const records = (getAllReq.result as FrameRecord[]).sort((a, b) => a.seq - b.seq)
          const target = records.find(r => r.seq === seq)
          if (!target) return // no-op: seq không tồn tại

          for (const r of records) framesStore.delete([projectId, r.seq])

          const remaining = records.filter(r => r.seq !== seq)
          let lastCapturedAt: number | undefined
          let coverFrameSeq: number | undefined
          remaining.forEach((r, newSeq) => {
            const file = frameFileName(newSeq)
            framesStore.put({ projectId, seq: newSeq, file, capturedAt: r.capturedAt, bytes: r.bytes })
            lastCapturedAt = r.capturedAt
            coverFrameSeq = newSeq
          })

          const getProjReq = projectsStore.get(projectId)
          getProjReq.onsuccess = () => {
            const record = getProjReq.result as ProjectRecord | undefined
            if (record) {
              record.frameCount = remaining.length
              record.coverFrameSeq = coverFrameSeq
              record.lastCapturedAt = lastCapturedAt
              projectsStore.put(record)
            }
          }
        }
        getAllReq.onerror = () => reject(getAllReq.error ?? new Error('deleteFrame failed'))

        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('deleteFrame failed'))
      }),
  )
}

/**
 * Sắp xếp lại frame theo hoán vị `newOrder` (mảng `seq` CŨ theo đúng thứ tự MỚI mong muốn — cùng
 * hợp đồng `ProjectStore.reorderFrames` phía iOS). No-op an toàn nếu `newOrder` không phải hoán vị
 * hợp lệ của frame hiện có. `capturedAt` giữ nguyên từng frame — chỉ `seq`/`file` đổi theo vị trí.
 */
export function reorderFrames(projectId: string, newOrder: number[]): Promise<void> {
  return openAppDb().then(
    db =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_PROJECTS, STORE_FRAMES], 'readwrite')
        const projectsStore = tx.objectStore(STORE_PROJECTS)
        const framesStore = tx.objectStore(STORE_FRAMES)
        const idx = framesStore.index(FRAMES_BY_PROJECT_INDEX)

        const getAllReq = idx.getAll(IDBKeyRange.only(projectId))
        getAllReq.onsuccess = () => {
          const records = getAllReq.result as FrameRecord[]
          const existingSeqs = new Set(records.map(r => r.seq))
          const isValidPermutation =
            newOrder.length === records.length &&
            new Set(newOrder).size === newOrder.length &&
            newOrder.every(seq => existingSeqs.has(seq))
          if (!isValidPermutation) return // no-op an toàn — khớp hành vi iOS

          const bySeq = new Map(records.map(r => [r.seq, r]))
          for (const r of records) framesStore.delete([projectId, r.seq])

          let lastCapturedAt: number | undefined
          newOrder.forEach((oldSeq, newSeq) => {
            const r = bySeq.get(oldSeq)
            if (!r) return
            const file = frameFileName(newSeq)
            framesStore.put({ projectId, seq: newSeq, file, capturedAt: r.capturedAt, bytes: r.bytes })
            lastCapturedAt = r.capturedAt
          })

          const getProjReq = projectsStore.get(projectId)
          getProjReq.onsuccess = () => {
            const record = getProjReq.result as ProjectRecord | undefined
            if (record) {
              record.coverFrameSeq = newOrder.length ? newOrder.length - 1 : undefined
              record.lastCapturedAt = lastCapturedAt
              projectsStore.put(record)
            }
          }
        }
        getAllReq.onerror = () => reject(getAllReq.error ?? new Error('reorderFrames failed'))

        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('reorderFrames failed'))
      }),
  )
}
