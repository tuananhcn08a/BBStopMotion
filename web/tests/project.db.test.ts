/**
 * T-XW03 — CRUD project/frames trên IndexedDB (fake-indexeddb, không mock nội bộ — round-trip
 * qua API public `src/lib/project/db.ts`). Bao AC4 (autosave 1 transaction, round-trip ArrayBuffer
 * đúng thứ tự seq sau "refresh"), AC5 (fpsLevel mặc định theo kind), AC6 (cascade delete + sort
 * listProjects), cộng deleteFrame/reorderFrames (chuẩn bị cho sort — wave sau).
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { DB_NAME, resetAppDbConnectionForTests } from '../src/lib/db/appDb'
import {
  addFrame,
  createProject,
  deleteFrame,
  deleteProject,
  getFrameBytes,
  getFrames,
  getProject,
  listProjects,
  renameProject,
  reorderFrames,
} from '../src/lib/project/db'

/** Đóng kết nối singleton (`appDb.ts`) TRƯỚC khi xoá DB — nếu không, connection cũ chưa đóng của
 * test trước sẽ chặn `deleteDatabase()` treo vô hạn (`onblocked` không bao giờ tự giải phóng vì
 * không ai đóng connection). */
async function deleteDb(): Promise<void> {
  await resetAppDbConnectionForTests()
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error ?? new Error('deleteDatabase failed'))
    req.onblocked = () => resolve()
  })
}

/** JPEG giả cho test — chỉ cần bytes ArrayBuffer round-trip đúng, không cần ảnh thật hợp lệ. */
function fakeJpegBytes(tag: number): ArrayBuffer {
  const buf = new ArrayBuffer(4)
  new DataView(buf).setUint32(0, tag)
  return buf
}

function bytesToTag(buf: ArrayBuffer): number {
  return new DataView(buf).getUint32(0)
}

/** `instanceof ArrayBuffer` không đáng tin cậy xuyên realm (jsdom vs `fake-indexeddb` structured
 * clone) — dùng `Object.prototype.toString` (spec-safe, không phụ thuộc realm nào tạo ra nó). */
function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return Object.prototype.toString.call(value) === '[object ArrayBuffer]'
}

beforeEach(async () => {
  await deleteDb()
})

describe('createProject (AC5 fpsLevel mặc định theo kind)', () => {
  it('createProject("animation") → fpsLevel="normal"', async () => {
    const project = await createProject('animation')
    expect(project.kind).toBe('animation')
    expect(project.fpsLevel).toBe('normal')
  })

  it('createProject("diary") → fpsLevel="slow"', async () => {
    const project = await createProject('diary')
    expect(project.kind).toBe('diary')
    expect(project.fpsLevel).toBe('slow')
  })

  it('id có prefix "proj-", schemaVersion=1, frames rỗng, title mặc định khi không truyền', async () => {
    const project = await createProject('animation')
    expect(project.id.startsWith('proj-')).toBe(true)
    expect(project.schemaVersion).toBe(1)
    expect(project.frames).toEqual([])
    expect(project.title).toBe('Phim hoạt hình mới')
  })

  it('title truyền vào được giữ nguyên (trim khoảng trắng thừa)', async () => {
    const project = await createProject('diary', '  Nhật ký của Bo  ')
    expect(project.title).toBe('Nhật ký của Bo')
  })
})

describe('addFrame — autosave 1 transaction, round-trip ArrayBuffer sau "refresh" (AC4)', () => {
  it('ghi 3 frame liên tiếp → đóng/mở lại DB (refresh) → frames còn nguyên đúng thứ tự seq', async () => {
    const project = await createProject('animation', 'Rô-bốt bay')

    await addFrame(project.id, fakeJpegBytes(1), 1000)
    await addFrame(project.id, fakeJpegBytes(2), 2000)
    await addFrame(project.id, fakeJpegBytes(3), 3000)

    // "Refresh" = đọc lại hoàn toàn từ store, không còn state trong bộ nhớ JS (mô phỏng đóng/mở tab).
    const reloaded = await getProject(project.id)
    expect(reloaded).toBeDefined()
    expect(reloaded!.frames).toHaveLength(3)
    expect(reloaded!.frames.map(f => f.seq)).toEqual([0, 1, 2])
    expect(reloaded!.frames.map(f => f.file)).toEqual(['frames/0001.jpg', 'frames/0002.jpg', 'frames/0003.jpg'])
    expect(reloaded!.frames.map(f => f.capturedAt)).toEqual([1000, 2000, 3000])

    // Bytes JPEG đọc lại đúng — round-trip ArrayBuffer, không hỏng qua IndexedDB.
    const bytes0 = await getFrameBytes(project.id, 0)
    const bytes2 = await getFrameBytes(project.id, 2)
    // `fake-indexeddb` structured-clone tạo ArrayBuffer ở realm riêng (khác `ArrayBuffer` global
    // của jsdom) → `toBeInstanceOf(ArrayBuffer)` false-negative dù bytes đúng. Check cross-realm-safe.
    expect(isArrayBuffer(bytes0)).toBe(true)
    expect(bytesToTag(bytes0!)).toBe(1)
    expect(bytesToTag(bytes2!)).toBe(3)
  })

  it('addFrame cập nhật denorm project (frameCount, lastCapturedAt) CÙNG transaction với frame', async () => {
    const project = await createProject('animation')
    await addFrame(project.id, fakeJpegBytes(1), 5000)

    const [meta] = await listProjects()
    expect(meta.frameCount).toBe(1)
    expect(meta.lastCapturedAt).toBe(5000)
    expect(meta.coverFrameSeq).toBe(0)
  })

  it('addFrame trả về ProjectFrame vừa ghi (seq/file/capturedAt đúng)', async () => {
    const project = await createProject('animation')
    const frame = await addFrame(project.id, fakeJpegBytes(1), 42)
    expect(frame).toEqual({ seq: 0, file: 'frames/0001.jpg', capturedAt: 42 })
  })

  it('addFrame vào project không tồn tại → reject, không tạo record mồ côi', async () => {
    await expect(addFrame('proj-khong-ton-tai', fakeJpegBytes(1))).rejects.toThrow()
    const frames = await getFrames('proj-khong-ton-tai')
    expect(frames).toEqual([])
  })

  it('getFrames trả về mảng KHÔNG chứa bytes (chỉ seq/file/capturedAt)', async () => {
    const project = await createProject('animation')
    await addFrame(project.id, fakeJpegBytes(1), 1)
    const frames = await getFrames(project.id)
    expect(Object.keys(frames[0]).sort()).toEqual(['capturedAt', 'file', 'seq'])
  })
})

describe('listProjects — sort cho Hub + deleteProject cascade (AC6)', () => {
  it('listProjects sắp xếp mới nhất lên đầu (createdAt giảm dần)', async () => {
    const older = await createProject('animation', 'Cũ')
    // Ép createdAt khác biệt rõ ràng bằng cách addFrame không đổi createdAt — tạo lần lượt đã đủ
    // monotonic vì Date.now(); nhưng để chắc chắn không flaky trên máy nhanh, tạo thêm khoảng cách giả lập
    // qua addFrame timestamps không ảnh hưởng thứ tự listProjects (chỉ dựa vào createdAt của project).
    await new Promise(r => setTimeout(r, 2))
    const newer = await createProject('diary', 'Mới')

    const projects = await listProjects()
    expect(projects.map(p => p.id)).toEqual([newer.id, older.id])
  })

  it('deleteProject xoá cả project + mọi frame của nó, KHÔNG rò rỉ record frames mồ côi', async () => {
    const target = await createProject('animation', 'Sẽ bị xoá')
    await addFrame(target.id, fakeJpegBytes(1), 1)
    await addFrame(target.id, fakeJpegBytes(2), 2)
    const keep = await createProject('animation', 'Giữ lại')
    await addFrame(keep.id, fakeJpegBytes(9), 9)

    await deleteProject(target.id)

    const projects = await listProjects()
    expect(projects.map(p => p.id)).toEqual([keep.id])

    const orphanFrames = await getFrames(target.id)
    expect(orphanFrames).toEqual([])

    // Dự án còn lại không bị ảnh hưởng.
    const keptFrames = await getFrames(keep.id)
    expect(keptFrames).toHaveLength(1)
  })

  it('renameProject đổi title, các field khác giữ nguyên', async () => {
    const project = await createProject('animation', 'Tên cũ')
    await renameProject(project.id, 'Tên mới')
    const reloaded = await getProject(project.id)
    expect(reloaded!.title).toBe('Tên mới')
    expect(reloaded!.kind).toBe('animation')
  })
})

describe('deleteFrame / reorderFrames — chuẩn bị cho UI sắp xếp (wave sau)', () => {
  it('deleteFrame(seq giữa) renumber các frame còn lại liên tục từ 0 + đổi tên file', async () => {
    const project = await createProject('animation')
    await addFrame(project.id, fakeJpegBytes(1), 1)
    await addFrame(project.id, fakeJpegBytes(2), 2)
    await addFrame(project.id, fakeJpegBytes(3), 3)

    await deleteFrame(project.id, 1) // xoá frame giữa (bytes tag=2)

    const frames = await getFrames(project.id)
    expect(frames.map(f => f.seq)).toEqual([0, 1])
    expect(frames.map(f => f.file)).toEqual(['frames/0001.jpg', 'frames/0002.jpg'])

    const bytes0 = await getFrameBytes(project.id, 0)
    const bytes1 = await getFrameBytes(project.id, 1)
    expect(bytesToTag(bytes0!)).toBe(1)
    expect(bytesToTag(bytes1!)).toBe(3) // frame cũ seq=2 renumber xuống seq=1

    const [meta] = await listProjects()
    expect(meta.frameCount).toBe(2)
  })

  it('reorderFrames đổi thứ tự theo hoán vị, capturedAt giữ nguyên theo frame', async () => {
    const project = await createProject('animation')
    await addFrame(project.id, fakeJpegBytes(1), 100) // seq 0
    await addFrame(project.id, fakeJpegBytes(2), 200) // seq 1
    await addFrame(project.id, fakeJpegBytes(3), 300) // seq 2

    // Đảo ngược thứ tự: seq mới 0 = seq cũ 2, seq mới 1 = seq cũ 1, seq mới 2 = seq cũ 0.
    await reorderFrames(project.id, [2, 1, 0])

    const frames = await getFrames(project.id)
    expect(frames.map(f => f.seq)).toEqual([0, 1, 2])
    expect(frames.map(f => f.capturedAt)).toEqual([300, 200, 100])

    const bytes0 = await getFrameBytes(project.id, 0)
    expect(bytesToTag(bytes0!)).toBe(3)
  })

  it('reorderFrames với hoán vị không hợp lệ → no-op an toàn (frames không đổi)', async () => {
    const project = await createProject('animation')
    await addFrame(project.id, fakeJpegBytes(1), 1)
    await addFrame(project.id, fakeJpegBytes(2), 2)

    await reorderFrames(project.id, [0, 0]) // trùng lặp — không phải hoán vị hợp lệ

    const frames = await getFrames(project.id)
    expect(frames.map(f => f.seq)).toEqual([0, 1])
  })
})
