/**
 * T-XW21 — `bbsprojArchive.ts` writer/reader/validator. CHUẨN BINDING:
 * `docs/02-architecture/bbsproj-format-v1.md` + iOS `BbsprojArchive.swift`/
 * `BbsprojArchiveIOSTests.swift` (tên test mirror 1-1 khi hợp lý, xem comment từng `it`).
 *
 * jsdom KHÔNG implement `createImageBitmap` → stub global (xem `tests/importImage.test.ts` cùng
 * pattern) — mặc định resolve THÀNH CÔNG (giả định ảnh hợp lệ) trừ khi 1 test cụ thể muốn test
 * nhánh "JPEG không giải mã được" (mock reject riêng cho test đó). Quyết định LOGIC (rẽ nhánh theo
 * kết quả decode) được test đầy đủ; decode THẬT trên nội dung byte thật được xác nhận ở
 * `e2e/bbsproj-transfer.test.mjs` (Chrome thật, CÓ `createImageBitmap`).
 */
import 'fake-indexeddb/auto'
import * as fs from 'fs'
import * as path from 'path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { strFromU8, unzipSync, zipSync } from 'fflate'
import { DB_NAME, resetAppDbConnectionForTests } from '../src/lib/db/appDb'
import {
  MAX_FILE_BYTES, MAX_FRAME_BYTES,
  commitParsedImport, exportProjectToBbsproj, parseBbsprojBytes,
} from '../src/lib/project/bbsprojArchive'
import { addFrame, createProject, getFrames, getFrameBytes, getProject } from '../src/lib/project/db'
import { frameFileName } from '../src/lib/project/types'

async function deleteDb(): Promise<void> {
  await resetAppDbConnectionForTests()
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error ?? new Error('deleteDatabase failed'))
    req.onblocked = () => resolve()
  })
}

beforeEach(async () => {
  await deleteDb()
  vi.restoreAllMocks()
  // Mặc định: MỌI bytes đều "giải mã được" (bitmap giả) — trừ khi 1 test cụ thể ghi đè riêng.
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 12, height: 12, close: vi.fn() }))
})

function fakeJpegBytes(tag: number): ArrayBuffer {
  const buf = new ArrayBuffer(8)
  new DataView(buf).setUint32(0, 0xffd8ffe0) // magic JPEG SOI + APP0 (không bắt buộc nhưng thực tế hơn)
  new DataView(buf).setUint32(4, tag)
  return buf
}

/** Zip THỦ CÔNG (không qua `exportProjectToBbsproj`) để test importer robustness không cần dự án
 *  thật trong IndexedDB cho từng ca lỗi — mirror `BbsprojArchiveIOSTests.makeZip`. */
function makeZip(projectJson: Record<string, unknown>, frames: Record<string, Uint8Array> = {}): Uint8Array {
  const files: Record<string, Uint8Array> = {
    'project.json': new TextEncoder().encode(JSON.stringify(projectJson)),
    ...frames,
  }
  return zipSync(files, { level: 0 })
}

describe('exportProjectToBbsproj — AC1: ZIP STORE hợp lệ', () => {
  it('xuất dự án 5 frame → zip có project.json + 5 frame, method STORE (0) cho MỌI entry', async () => {
    const project = await createProject('animation', 'Cây đậu của Bin')
    for (let i = 0; i < 5; i++) await addFrame(project.id, fakeJpegBytes(i), 1000 + i)

    const result = await exportProjectToBbsproj(project.id)
    expect(result).not.toBeNull()
    expect(result?.fileName).toBe('Cây đậu của Bin.bbsproj')
  })

  it('project.json đúng schema: schemaVersion=1, id lowercase proj-, epoch ms, KHÔNG có exportedAt khi chưa export', async () => {
    const project = await createProject('diary', 'Nhật ký')
    await addFrame(project.id, fakeJpegBytes(0), 5000)

    const result = await exportProjectToBbsproj(project.id)
    const entries = unzipSync(new Uint8Array(await result!.blob.arrayBuffer()))
    const json = JSON.parse(strFromU8(entries['project.json']))

    expect(json.schemaVersion).toBe(1)
    expect(json.id).toBe(project.id)
    expect(json.id).toBe(project.id.toLowerCase())
    expect(json.kind).toBe('diary')
    expect(typeof json.createdAt).toBe('number')
    expect(json).not.toHaveProperty('exportedAt') // OMIT hẳn key — KHÔNG ghi 0/null
  })

  it('tên frame ĐÚNG %04d = seq+1 (seq 0 → frames/0001.jpg)', async () => {
    const project = await createProject('animation')
    await addFrame(project.id, fakeJpegBytes(0), 1)
    await addFrame(project.id, fakeJpegBytes(1), 2)

    const result = await exportProjectToBbsproj(project.id)
    const entries = unzipSync(new Uint8Array(await result!.blob.arrayBuffer()))
    expect(Object.keys(entries).sort()).toEqual(['frames/0001.jpg', 'frames/0002.jpg', 'project.json'])
  })

  it('[BYTE-CRITICAL] MỌI entry trong zip xuất ra là method STORE (0) — verify qua central directory thật', async () => {
    const project = await createProject('animation')
    await addFrame(project.id, fakeJpegBytes(0), 1)
    const result = await exportProjectToBbsproj(project.id)
    const zipBytes = new Uint8Array(await result!.blob.arrayBuffer())

    const methods: number[] = []
    unzipSync(zipBytes, {
      filter(file) {
        methods.push(file.compression)
        return true
      },
    })
    expect(methods.length).toBeGreaterThan(0)
    expect(methods.every(m => m === 0)).toBe(true)
  })

  it('dự án không tồn tại → null (không throw)', async () => {
    const result = await exportProjectToBbsproj('proj-khong-ton-tai')
    expect(result).toBeNull()
  })

  it('sanitizedFileName giữ NGUYÊN chữ có dấu tiếng Việt (Unicode Letter), chỉ thay ký tự thật sự lạ', async () => {
    const project = await createProject('animation', 'Cây đậu/của: Bin?')
    const result = await exportProjectToBbsproj(project.id)
    // '/' ':' '?' không hợp lệ trong tên file → "_"; chữ có dấu giữ nguyên.
    expect(result?.fileName).toBe('Cây đậu_của_ Bin_.bbsproj')
  })
})

describe('Round-trip WEB (AC2) — xuất → nhập lại → dự án giống hệt', () => {
  it('frames đúng số/thứ tự/bytes, kind/fpsLevel/title giữ nguyên, seq liên tục', async () => {
    const original = await createProject('diary', 'Cây đậu của Bin')
    const capturedAts = [1000, 2000, 3000, 4000]
    for (let i = 0; i < 4; i++) await addFrame(original.id, fakeJpegBytes(i), capturedAts[i])

    const exported = await exportProjectToBbsproj(original.id)
    const zipBytes = new Uint8Array(await exported!.blob.arrayBuffer())

    // "Chuyển máy" mô phỏng: xoá sạch DB, nhập lại như dự án đến từ máy khác.
    await deleteDb()
    const parseResult = await parseBbsprojBytes(zipBytes, new Set())
    expect(parseResult.ok).toBe(true)
    if (!parseResult.ok) return
    expect(parseResult.value.isDuplicateId).toBe(false)

    const committed = await commitParsedImport(parseResult.value, 'notDuplicate')
    expect(committed.id).toBe(original.id)
    expect(committed.title).toBe(original.title)
    expect(committed.kind).toBe('diary')
    expect(committed.fpsLevel).toBe(original.fpsLevel)
    expect(committed.frames.map(f => f.seq)).toEqual([0, 1, 2, 3])
    expect(committed.frames.map(f => f.capturedAt)).toEqual(capturedAts)

    for (let seq = 0; seq < 4; seq++) {
      const bytes = await getFrameBytes(committed.id, seq)
      expect(bytes).toEqual(fakeJpegBytes(seq))
    }
  })
})

describe('Cross-device iOS (AC3) — nhập fixture .bbsproj THẬT do iOS tạo', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'cay-dau-cua-bin.bbsproj')

  it('fixture nguồn: bbstopmotion-apple/fixtures/cay-dau-cua-bin.bbsproj (copy nguyên bản vào tests/fixtures/) — parse OK', async () => {
    const bytes = new Uint8Array(fs.readFileSync(fixturePath))
    const result = await parseBbsprojBytes(bytes, new Set())

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.project.id).toBe('proj-9f6c1e0a-3b7d-4a2e-9c11-8e5b2d4a7f10')
    expect(result.value.project.title).toBe('Cây đậu của Bin')
    expect(result.value.project.kind).toBe('diary')
    expect(result.value.project.fpsLevel).toBe('slow')
    expect(result.value.project.schemaVersion).toBe(1)
    expect(result.value.project.exportedAt).toBeUndefined() // fixture chưa từng export
    expect(result.value.project.frames).toHaveLength(5)
    expect(result.value.project.frames.map(f => f.seq)).toEqual([0, 1, 2, 3, 4])
    expect(result.value.project.frames.map(f => f.file)).toEqual([
      'frames/0001.jpg', 'frames/0002.jpg', 'frames/0003.jpg', 'frames/0004.jpg', 'frames/0005.jpg',
    ])
    expect(result.value.frameBytesBySeq.size).toBe(5)
  })

  it('[BYTE-CRITICAL] fixture xác nhận method STORE (0) — khớp yêu cầu iOS ZipReader', () => {
    const bytes = new Uint8Array(fs.readFileSync(fixturePath))
    const methods: number[] = []
    unzipSync(bytes, { filter(file) { methods.push(file.compression); return true } })
    expect(methods.every(m => m === 0)).toBe(true)
  })

  it('commit fixture vào IndexedDB → getProject đọc lại đúng, frame bytes khớp nguyên văn trong ZIP', async () => {
    const bytes = new Uint8Array(fs.readFileSync(fixturePath))
    const parsed = await parseBbsprojBytes(bytes, new Set())
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const committed = await commitParsedImport(parsed.value, 'notDuplicate')
    const reloaded = await getProject(committed.id)
    expect(reloaded?.frames).toHaveLength(5)

    const zipEntries = unzipSync(bytes)
    for (let seq = 0; seq < 5; seq++) {
      const dbBytes = await getFrameBytes(committed.id, seq)
      const zipBytes = zipEntries[frameFileName(seq)]
      expect(new Uint8Array(dbBytes!)).toEqual(zipBytes)
    }
  })
})

describe('Validator — TỪNG quy tắc importer [BINDING] (mirror BbsprojArchiveIOSTests)', () => {
  it('TS-XP-31 mirror: schemaVersion=2 (> mức hỗ trợ) → schemaVersionTooNew (từ chối thân thiện)', async () => {
    const zip = makeZip({
      schemaVersion: 2, id: 'proj-x', title: 'T', kind: 'animation', fpsLevel: 'normal', createdAt: 0, frames: [],
    })
    const result = await parseBbsprojBytes(zip, new Set())
    expect(result).toEqual({ ok: false, error: 'schemaVersionTooNew' })
  })

  it('TS-XP-32 mirror: thiếu field bắt buộc ("kind") → invalidProjectData (từ chối cả file)', async () => {
    const zip = makeZip({
      schemaVersion: 1, id: 'proj-x', title: 'T', fpsLevel: 'normal', createdAt: 0, frames: [],
    })
    const result = await parseBbsprojBytes(zip, new Set())
    expect(result).toEqual({ ok: false, error: 'invalidProjectData' })
  })

  it('frame trỏ file KHÔNG có trong ZIP → invalidProjectData', async () => {
    const zip = makeZip({
      schemaVersion: 1, id: 'proj-x', title: 'T', kind: 'animation', fpsLevel: 'normal', createdAt: 0,
      frames: [{ seq: 0, file: 'frames/0001.jpg', capturedAt: 0 }],
    }) // KHÔNG kèm frame thật
    const result = await parseBbsprojBytes(zip, new Set())
    expect(result).toEqual({ ok: false, error: 'invalidProjectData' })
  })

  it('seq KHÔNG liên tục từ 0 (thiếu seq=1) → invalidProjectData', async () => {
    const zip = makeZip(
      {
        schemaVersion: 1, id: 'proj-x', title: 'T', kind: 'animation', fpsLevel: 'normal', createdAt: 0,
        frames: [
          { seq: 0, file: 'frames/0001.jpg', capturedAt: 0 },
          { seq: 2, file: 'frames/0003.jpg', capturedAt: 0 },
        ],
      },
      { 'frames/0001.jpg': new Uint8Array(fakeJpegBytes(0)), 'frames/0003.jpg': new Uint8Array(fakeJpegBytes(2)) },
    )
    const result = await parseBbsprojBytes(zip, new Set())
    expect(result).toEqual({ ok: false, error: 'invalidProjectData' })
  })

  it('tên file SAI quy tắc %04d (seq 0 nhưng đặt tên frames/0002.jpg) → invalidProjectData', async () => {
    const zip = makeZip(
      {
        schemaVersion: 1, id: 'proj-x', title: 'T', kind: 'animation', fpsLevel: 'normal', createdAt: 0,
        frames: [{ seq: 0, file: 'frames/0002.jpg', capturedAt: 0 }],
      },
      { 'frames/0002.jpg': new Uint8Array(fakeJpegBytes(0)) },
    )
    const result = await parseBbsprojBytes(zip, new Set())
    expect(result).toEqual({ ok: false, error: 'invalidProjectData' })
  })

  it('JPEG KHÔNG giải mã được (createImageBitmap reject) → invalidProjectData', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed')))
    const zip = makeZip(
      {
        schemaVersion: 1, id: 'proj-x', title: 'T', kind: 'animation', fpsLevel: 'normal', createdAt: 0,
        frames: [{ seq: 0, file: 'frames/0001.jpg', capturedAt: 0 }],
      },
      { 'frames/0001.jpg': new Uint8Array([0x00, 0x01, 0x02]) },
    )
    const result = await parseBbsprojBytes(zip, new Set())
    expect(result).toEqual({ ok: false, error: 'invalidProjectData' })
  })

  it('§2.2 mirror: kind="timelapse" (enum lạ) → invalidProjectData (coi như thiếu field bắt buộc)', async () => {
    const zip = makeZip({
      schemaVersion: 1, id: 'proj-x', title: 'T', kind: 'timelapse', fpsLevel: 'normal', createdAt: 0, frames: [],
    })
    const result = await parseBbsprojBytes(zip, new Set())
    expect(result).toEqual({ ok: false, error: 'invalidProjectData' })
  })

  it('fpsLevel="turbo" (enum lạ) → invalidProjectData', async () => {
    const zip = makeZip({
      schemaVersion: 1, id: 'proj-x', title: 'T', kind: 'animation', fpsLevel: 'turbo', createdAt: 0, frames: [],
    })
    const result = await parseBbsprojBytes(zip, new Set())
    expect(result).toEqual({ ok: false, error: 'invalidProjectData' })
  })

  it('TS-XP-33 mirror: field lạ cấp top-level ("authorNote") → BỎ QUA, import OK', async () => {
    const zip = makeZip({
      schemaVersion: 1, id: 'proj-x', title: 'T', kind: 'animation', fpsLevel: 'normal', createdAt: 0, frames: [],
      authorNote: 'field lạ ngoài schema',
    })
    const result = await parseBbsprojBytes(zip, new Set())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.project.id).toBe('proj-x')
  })

  it('§2.1 mirror: title thiếu → tự đặt tên mặc định theo kind, KHÔNG từ chối', async () => {
    const zip = makeZip({
      schemaVersion: 1, id: 'proj-x', kind: 'diary', fpsLevel: 'slow', createdAt: 0, frames: [],
    })
    const result = await parseBbsprojBytes(zip, new Set())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.project.title.length).toBeGreaterThan(0)
  })

  it('title rỗng "" (chuỗi trắng) → coi như thiếu, tự đặt tên mặc định', async () => {
    const zip = makeZip({
      schemaVersion: 1, id: 'proj-x', title: '   ', kind: 'animation', fpsLevel: 'normal', createdAt: 0, frames: [],
    })
    const result = await parseBbsprojBytes(zip, new Set())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.project.title.trim().length).toBeGreaterThan(0)
  })

  it('frames: [] (dự án rỗng) → import OK', async () => {
    const zip = makeZip({
      schemaVersion: 1, id: 'proj-x', title: 'T', kind: 'animation', fpsLevel: 'normal', createdAt: 0, frames: [],
    })
    const result = await parseBbsprojBytes(zip, new Set())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.project.frames).toEqual([])
  })

  it('exportedAt THIẾU HẲN → coi là chưa export (project.exportedAt undefined), import OK', async () => {
    const zip = makeZip({
      schemaVersion: 1, id: 'proj-x', title: 'T', kind: 'animation', fpsLevel: 'normal', createdAt: 0, frames: [],
    })
    const result = await parseBbsprojBytes(zip, new Set())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.project.exportedAt).toBeUndefined()
  })

  it('lastCapturedAt THIẾU → suy từ max(frames[].capturedAt)', async () => {
    const zip = makeZip(
      {
        schemaVersion: 1, id: 'proj-x', title: 'T', kind: 'animation', fpsLevel: 'normal', createdAt: 0,
        frames: [
          { seq: 0, file: 'frames/0001.jpg', capturedAt: 100 },
          { seq: 1, file: 'frames/0002.jpg', capturedAt: 999 },
        ],
      },
      { 'frames/0001.jpg': new Uint8Array(fakeJpegBytes(0)), 'frames/0002.jpg': new Uint8Array(fakeJpegBytes(1)) },
    )
    const result = await parseBbsprojBytes(zip, new Set())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.project.lastCapturedAt).toBe(999)
  })

  it('DEFLATE (method 8, không phải STORE) → unsupportedCompression (từ chối an toàn)', async () => {
    // fflate mặc định DEFLATE khi KHÔNG set level:0 — mô phỏng đúng bug "quên set level" cảnh báo trong spec.
    const zipDeflate = zipSync(
      { 'project.json': new TextEncoder().encode(JSON.stringify({
        schemaVersion: 1, id: 'proj-x', title: 'T', kind: 'animation', fpsLevel: 'normal', createdAt: 0, frames: [],
      })) },
      {}, // KHÔNG set level:0 → DEFLATE mặc định
    )
    const result = await parseBbsprojBytes(zipDeflate, new Set())
    expect(result).toEqual({ ok: false, error: 'unsupportedCompression' })
  })

  it('không phải file ZIP hợp lệ (bytes rác) → invalidZip, KHÔNG throw/crash', async () => {
    const garbage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    await expect(parseBbsprojBytes(garbage, new Set())).resolves.toEqual({ ok: false, error: 'invalidZip' })
  })
})

describe('Zip-bomb (§6) — dùng limits injectable để test LOGIC ngưỡng không cần cấp phát trăm MB RAM', () => {
  it('MAX_FILE_BYTES thật (200MB) — file lớn hơn → fileTooLarge NGAY, không thử unzip', async () => {
    // Không cấp phát thật 200MB — dùng Object giả `byteLength` để test guard đầu hàm (kiểm TRƯỚC
    // khi đụng tới `unzipSync`, khớp đúng thứ tự iOS `parse(fileURL:)`).
    const fakeBigBytes = { byteLength: MAX_FILE_BYTES + 1 } as Uint8Array
    const result = await parseBbsprojBytes(fakeBigBytes, new Set())
    expect(result).toEqual({ ok: false, error: 'fileTooLarge' })
  })

  it('vượt maxFrames (limits injectable=2) → tooManyFrames', async () => {
    const zip = makeZip(
      {
        schemaVersion: 1, id: 'proj-x', title: 'T', kind: 'animation', fpsLevel: 'normal', createdAt: 0,
        frames: [
          { seq: 0, file: 'frames/0001.jpg', capturedAt: 0 },
          { seq: 1, file: 'frames/0002.jpg', capturedAt: 0 },
          { seq: 2, file: 'frames/0003.jpg', capturedAt: 0 },
        ],
      },
      {
        'frames/0001.jpg': new Uint8Array(fakeJpegBytes(0)),
        'frames/0002.jpg': new Uint8Array(fakeJpegBytes(1)),
        'frames/0003.jpg': new Uint8Array(fakeJpegBytes(2)),
      },
    )
    const result = await parseBbsprojBytes(zip, new Set(), { maxFrames: 2, maxFrameBytes: MAX_FRAME_BYTES, maxTotalBytes: 999999, maxCompressionRatio: 10 })
    expect(result).toEqual({ ok: false, error: 'tooManyFrames' })
  })

  it('1 frame vượt maxFrameBytes (limits injectable nhỏ) → frameFileTooLarge', async () => {
    const bigFrame = new Uint8Array(1000) // "lớn" so với limit test nhỏ bên dưới
    const zip = makeZip(
      {
        schemaVersion: 1, id: 'proj-x', title: 'T', kind: 'animation', fpsLevel: 'normal', createdAt: 0,
        frames: [{ seq: 0, file: 'frames/0001.jpg', capturedAt: 0 }],
      },
      { 'frames/0001.jpg': bigFrame },
    )
    const result = await parseBbsprojBytes(zip, new Set(), { maxFrames: 2000, maxFrameBytes: 500, maxTotalBytes: 999999, maxCompressionRatio: 10 })
    expect(result).toEqual({ ok: false, error: 'frameFileTooLarge' })
  })

  it('tổng bytes vượt maxTotalBytes (limits injectable nhỏ, dù từng frame riêng lẻ vẫn OK) → totalTooLarge', async () => {
    const zip = makeZip(
      {
        schemaVersion: 1, id: 'proj-x', title: 'T', kind: 'animation', fpsLevel: 'normal', createdAt: 0,
        frames: [
          { seq: 0, file: 'frames/0001.jpg', capturedAt: 0 },
          { seq: 1, file: 'frames/0002.jpg', capturedAt: 0 },
          { seq: 2, file: 'frames/0003.jpg', capturedAt: 0 },
        ],
      },
      {
        'frames/0001.jpg': new Uint8Array(400),
        'frames/0002.jpg': new Uint8Array(400),
        'frames/0003.jpg': new Uint8Array(400),
      },
    )
    // Mỗi frame 400 bytes < maxFrameBytes(500) riêng lẻ OK, nhưng tổng 1200+project.json > maxTotalBytes(1000).
    const result = await parseBbsprojBytes(zip, new Set(), { maxFrames: 2000, maxFrameBytes: 500, maxTotalBytes: 1000, maxCompressionRatio: 10 })
    expect(result).toEqual({ ok: false, error: 'totalTooLarge' })
  })

  it('ratio nén thật của ZIP STORE luôn = 1 (không bao giờ kích hoạt maxCompressionRatio trên file hợp lệ)', async () => {
    const zip = makeZip(
      {
        schemaVersion: 1, id: 'proj-x', title: 'T', kind: 'animation', fpsLevel: 'normal', createdAt: 0,
        frames: [{ seq: 0, file: 'frames/0001.jpg', capturedAt: 0 }],
      },
      { 'frames/0001.jpg': new Uint8Array(fakeJpegBytes(0)) },
    )
    // Ratio trần =1 (cực chặt) — STORE thật vẫn PASS vì original/compressed luôn đúng bằng 1.
    const result = await parseBbsprojBytes(zip, new Set(), { maxFrames: 2000, maxFrameBytes: MAX_FRAME_BYTES, maxTotalBytes: 999999, maxCompressionRatio: 1 })
    expect(result.ok).toBe(true)
  })
})

describe('Import trùng id (AC4 — hỏi Ghi đè/Nhân bản)', () => {
  it('isDuplicateId=true khi existingProjectIds chứa id trong file', async () => {
    const zip = makeZip({
      schemaVersion: 1, id: 'proj-existing', title: 'T', kind: 'animation', fpsLevel: 'normal', createdAt: 0, frames: [],
    })
    const result = await parseBbsprojBytes(zip, new Set(['proj-existing']))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.isDuplicateId).toBe(true)
  })

  it('commit resolution="overwrite" → GIỮ id cũ, THAY frame cũ bằng nội dung file nhập', async () => {
    const existing = await createProject('animation')
    await addFrame(existing.id, fakeJpegBytes(100), 1) // seq 0 CŨ — sẽ bị xoá
    await addFrame(existing.id, fakeJpegBytes(101), 2) // seq 1 CŨ — sẽ bị xoá
    await addFrame(existing.id, fakeJpegBytes(102), 3) // seq 2 CŨ — sẽ bị xoá

    const zip = makeZip(
      {
        schemaVersion: 1, id: existing.id, title: 'Đã ghi đè', kind: 'animation', fpsLevel: 'normal', createdAt: 0,
        frames: [{ seq: 0, file: 'frames/0001.jpg', capturedAt: 500 }],
      },
      { 'frames/0001.jpg': new Uint8Array(fakeJpegBytes(999)) },
    )
    const parsed = await parseBbsprojBytes(zip, new Set([existing.id]))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.isDuplicateId).toBe(true)

    const committed = await commitParsedImport(parsed.value, 'overwrite')
    expect(committed.id).toBe(existing.id)

    const frames = await getFrames(existing.id)
    expect(frames).toHaveLength(1) // 3 frame cũ đã bị xoá, chỉ còn đúng 1 frame file nhập
    const bytes = await getFrameBytes(existing.id, 0)
    expect(bytes).toEqual(fakeJpegBytes(999))
  })

  it('commit resolution="duplicate" → sinh id MỚI (proj- prefix), giữ NGUYÊN nội dung, dự án cũ vẫn còn', async () => {
    const existing = await createProject('animation')
    await addFrame(existing.id, fakeJpegBytes(1), 1)
    await addFrame(existing.id, fakeJpegBytes(2), 2)
    await addFrame(existing.id, fakeJpegBytes(3), 3)

    const exported = await exportProjectToBbsproj(existing.id)
    const zipBytes = new Uint8Array(await exported!.blob.arrayBuffer())

    const parsed = await parseBbsprojBytes(zipBytes, new Set([existing.id]))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const duplicated = await commitParsedImport(parsed.value, 'duplicate')
    expect(duplicated.id).not.toBe(existing.id)
    expect(duplicated.id.startsWith('proj-')).toBe(true)
    expect(duplicated.frames).toHaveLength(3)

    // Cả 2 dự án cùng tồn tại — dự án GỐC không bị đụng.
    const originalStill = await getProject(existing.id)
    expect(originalStill?.frames).toHaveLength(3)
    const dup = await getProject(duplicated.id)
    expect(dup?.frames).toHaveLength(3)
  })
})
