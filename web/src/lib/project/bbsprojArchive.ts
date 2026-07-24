/**
 * T-XW21 — Writer/Reader/Validator `.bbsproj` v1, CHUẨN BINDING:
 * `docs/02-architecture/bbsproj-format-v1.md` (ops repo) — nguồn sự thật iOS đã ship:
 * `bbstopmotion-apple/Shared/Services/{BbsprojArchive,ZipWriter,ZipReader}.swift`.
 *
 * Đây là CẦU CHUYỂN MÁY iOS↔web — mọi quyết định byte-level ở đây PHẢI khớp iOS tuyệt đối, nếu
 * không 2 nền không mở được file của nhau:
 *   - ZIP method **STORE (0) BẮT BUỘC** (fflate `zipSync(files, { level: 0 })`) — iOS `ZipReader`
 *     từ chối MỌI method khác 0 (kể cả DEFLATE mặc định của fflate nếu quên set level).
 *   - `project.json`: `schemaVersion` int, `id` string, `kind`/`fpsLevel` enum ĐÚNG (giá trị lạ =
 *     từ chối cả file, KHÔNG coi là "field lạ bỏ qua" — §2.2 bbsproj-format-v1.md), timestamp
 *     epoch **ms**, `lastCapturedAt`/`exportedAt` **OMIT hẳn key** khi không có giá trị (KHÔNG ghi
 *     `0`/`null`) — khớp Swift `encodeIfPresent`.
 *   - `frames/{seq+1 pad 4}.jpg` — seq liên tục từ 0, tên phải khớp đúng công thức.
 *   - Giới hạn chống zip-bomb (§6): 2000 frame · 10MB/frame · 500MB tổng · 200MB file · tỉ lệ nén ≤10.
 *
 * Field lạ ở cấp `project.json` (vd `"authorNote"`) → BỎ QUA tự nhiên (chỉ đọc key mình biết,
 * không lỗi khi có key thừa) — khớp quy tắc importer 2.
 */
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import { FpsLevel } from '../../types'
import { getFrameBytes, getProject, writeImportedProject } from './db'
import {
  CURRENT_SCHEMA_VERSION, Project, ProjectKind, defaultProjectTitle, frameFileName, newProjectId,
} from './types'

// ---------- Giới hạn chống ZIP bomb (§6 bbsproj-format-v1.md) — khớp CHÍNH XÁC iOS BbsprojArchive ----------
export const MAX_FRAMES = 2000
export const MAX_FRAME_BYTES = 10 * 1024 * 1024
export const MAX_TOTAL_BYTES = 500 * 1024 * 1024
export const MAX_FILE_BYTES = 200 * 1024 * 1024
export const MAX_COMPRESSION_RATIO = 10

export type ImportErrorCode =
  | 'fileTooLarge'
  | 'invalidZip'
  | 'unsupportedCompression'
  | 'schemaVersionTooNew'
  | 'invalidProjectData'
  | 'tooManyFrames'
  | 'frameFileTooLarge'
  | 'totalTooLarge'

/** Kết quả `parseBbsproj*` — validate XONG nhưng CHƯA ghi đĩa (mirror iOS `ParsedImport`), để
 *  call-site (UI) hỏi Ghi đè/Nhân bản TRƯỚC khi gọi `commitParsedImport`. */
export interface ParsedImport {
  project: Project
  /** Bytes JPEG thô mỗi frame, khoá theo `seq` — TÁCH khỏi `project.frames` (chỉ metadata) để
   *  khớp shape lưu trữ IndexedDB (`STORE_FRAMES`, xem `db.ts`). */
  frameBytesBySeq: Map<number, ArrayBuffer>
  isDuplicateId: boolean
}

export type DuplicateResolution = 'notDuplicate' | 'overwrite' | 'duplicate'

export type ParseResult =
  | { ok: true; value: ParsedImport }
  | { ok: false; error: ImportErrorCode }

/** Giới hạn injectable — mặc định LUÔN đúng hằng số §6 thật (production/call-site thật KHÔNG bao
 *  giờ truyền override). Chỉ test dùng override (số nhỏ) để verify LOGIC ngưỡng mà không cần cấp
 *  phát hàng trăm MB RAM trong unit test — hằng số byte-critical thật (`MAX_TOTAL_BYTES` 500MB...)
 *  không đổi, vẫn là nguồn duy nhất dùng khi không truyền `limits`. */
export interface ZipBombLimits {
  maxFrames: number
  maxFrameBytes: number
  maxTotalBytes: number
  maxCompressionRatio: number
}

const DEFAULT_LIMITS: ZipBombLimits = {
  maxFrames: MAX_FRAMES,
  maxFrameBytes: MAX_FRAME_BYTES,
  maxTotalBytes: MAX_TOTAL_BYTES,
  maxCompressionRatio: MAX_COMPRESSION_RATIO,
}

// ---------- Export (AC1) ----------

/** `CharacterSet.alphanumerics ∪ {" ", "-", "_"}` phía Swift bao gồm CHỮ CÓ DẤU (Unicode Letter),
 *  không chỉ ASCII — `\p{L}\p{N}` khớp đúng phạm vi đó (giữ "Cây đậu của Bin" nguyên vẹn, chỉ thay
 *  ký tự thật sự lạ như `/`, `:`, emoji bằng `_`). Mirror `BbsprojArchive.sanitizedFileName`. */
const ALLOWED_FILENAME_CHARS = /[\p{L}\p{N} _-]/u

function sanitizedFileName(title: string): string {
  let cleaned = ''
  for (const ch of title) cleaned += ALLOWED_FILENAME_CHARS.test(ch) ? ch : '_'
  const result = cleaned.trim()
  return result.length > 0 ? result : 'du-an'
}

/**
 * Zip 1 dự án thành `.bbsproj` — `project.json` (JSON.stringify tự OMIT key `undefined`, khớp
 * `encodeIfPresent` Swift vì `getProject()` đã `stripUndefined` sẵn ở tầng data layer) + mọi frame
 * lấy THẲNG bytes IndexedDB (đã normalize 1280×720 q0.85 từ lúc chụp/import — KHÔNG re-encode,
 * giữ round-trip byte-exact). `null` khi dự án không tồn tại hoặc frame bytes bị thiếu (dữ liệu
 * nội bộ hỏng — an toàn hơn xuất file thiếu frame).
 */
export async function exportProjectToBbsproj(projectId: string): Promise<{ blob: Blob; fileName: string } | null> {
  const project = await getProject(projectId)
  if (!project) return null

  const files: Record<string, Uint8Array> = {}
  files['project.json'] = strToU8(JSON.stringify(project))

  for (const frame of project.frames) {
    const bytes = await getFrameBytes(projectId, frame.seq)
    if (!bytes) return null
    files[frame.file] = new Uint8Array(bytes)
  }

  // [BINDING] level:0 → STORE (KHÔNG DEFLATE) — iOS ZipReader từ chối mọi method khác 0.
  const zipped = zipSync(files, { level: 0 })
  const fileName = `${sanitizedFileName(project.title)}.bbsproj`
  return { blob: new Blob([zipped as BlobPart], { type: 'application/zip' }), fileName }
}

// ---------- Import — parse (validate, KHÔNG ghi đĩa) ----------

interface RawProjectFrame {
  seq?: unknown
  file?: unknown
  capturedAt?: unknown
}

interface RawProjectJson {
  schemaVersion?: unknown
  id?: unknown
  title?: unknown
  kind?: unknown
  fpsLevel?: unknown
  createdAt?: unknown
  lastCapturedAt?: unknown
  exportedAt?: unknown
  frames?: unknown
}

const VALID_KINDS: readonly ProjectKind[] = ['animation', 'diary']
const VALID_FPS_LEVELS: readonly FpsLevel[] = ['slow', 'normal', 'fast']

function isValidFrameShape(f: unknown): f is { seq: number; file: string; capturedAt: number } {
  if (typeof f !== 'object' || f === null) return false
  const r = f as RawProjectFrame
  return typeof r.seq === 'number' && Number.isFinite(r.seq)
    && typeof r.file === 'string'
    && typeof r.capturedAt === 'number' && Number.isFinite(r.capturedAt)
}

/** Thử decode THẬT bằng `createImageBitmap` (không chỉ kiểm magic byte) — khớp iOS
 *  `ImageNormalizer.pixelSize(of:)` (ImageIO decode thật). Đóng bitmap ngay, chỉ dùng để validate —
 *  bytes lưu xuống IndexedDB là bytes GỐC trong ZIP (không re-encode). */
async function isDecodableJpeg(bytes: Uint8Array): Promise<boolean> {
  try {
    const blob = new Blob([bytes as BlobPart], { type: 'image/jpeg' })
    const bitmap = await createImageBitmap(blob)
    bitmap.close?.()
    return true
  } catch {
    return false
  }
}

/**
 * Validate `.bbsproj` bytes ĐÃ ĐỌC (từ `File`/fetch/fixture test) → áp ĐỦ quy tắc importer
 * [BINDING] §3 bbsproj-format-v1.md. Trả `ok:false` với mã lỗi cụ thể ở BƯỚC ĐẦU TIÊN vi phạm —
 * KHÔNG cố sửa/nhập một phần (tất-cả-hoặc-không).
 */
export async function parseBbsprojBytes(
  bytes: Uint8Array,
  existingProjectIds: ReadonlySet<string>,
  limits: ZipBombLimits = DEFAULT_LIMITS,
): Promise<ParseResult> {
  if (bytes.byteLength > MAX_FILE_BYTES) return { ok: false, error: 'fileTooLarge' }

  // §6 — áp giới hạn TRƯỚC KHI giải nén toàn bộ: `filter` của fflate nhận thông tin central
  // directory (size nén/gốc/method) cho TỪNG entry TRƯỚC khi entry đó bị inflate — đúng điểm hook
  // "đọc central directory lấy uncompressed size" spec yêu cầu. Vi phạm → đánh dấu `rejected` +
  // `return false` (bỏ qua giải nén entry đó), rồi từ chối CẢ file ngay sau khi `unzipSync` xong.
  let rejected: ImportErrorCode | null = null
  let totalOriginal = 0
  let unzipped: Record<string, Uint8Array>
  try {
    unzipped = unzipSync(bytes, {
      filter(file) {
        if (rejected) return false
        if (file.compression !== 0) {
          rejected = 'unsupportedCompression'
          return false
        }
        if (file.originalSize > limits.maxFrameBytes) {
          rejected = 'frameFileTooLarge'
          return false
        }
        const ratio = file.size === 0 ? (file.originalSize > 0 ? Infinity : 0) : file.originalSize / file.size
        if (ratio > limits.maxCompressionRatio) {
          rejected = 'invalidZip'
          return false
        }
        totalOriginal += file.originalSize
        if (totalOriginal > limits.maxTotalBytes) {
          rejected = 'totalTooLarge'
          return false
        }
        return true
      },
    })
  } catch {
    return { ok: false, error: 'invalidZip' }
  }
  if (rejected) return { ok: false, error: rejected }

  const projectBytes = unzipped['project.json']
  if (!projectBytes) return { ok: false, error: 'invalidProjectData' }

  let raw: RawProjectJson
  try {
    raw = JSON.parse(strFromU8(projectBytes)) as RawProjectJson
  } catch {
    return { ok: false, error: 'invalidProjectData' }
  }
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'invalidProjectData' }

  // Quy tắc 1 — schemaVersion > mức hỗ trợ → từ chối thân thiện (KHÔNG crash).
  if (typeof raw.schemaVersion !== 'number') return { ok: false, error: 'invalidProjectData' }
  if (raw.schemaVersion > CURRENT_SCHEMA_VERSION) return { ok: false, error: 'schemaVersionTooNew' }

  // Quy tắc 3 — thiếu field bắt buộc / enum lạ (§2.2) → từ chối cả file.
  if (typeof raw.id !== 'string' || raw.id.length === 0) return { ok: false, error: 'invalidProjectData' }
  if (typeof raw.kind !== 'string' || !VALID_KINDS.includes(raw.kind as ProjectKind)) {
    return { ok: false, error: 'invalidProjectData' }
  }
  if (typeof raw.fpsLevel !== 'string' || !VALID_FPS_LEVELS.includes(raw.fpsLevel as FpsLevel)) {
    return { ok: false, error: 'invalidProjectData' }
  }
  if (typeof raw.createdAt !== 'number' || !Number.isFinite(raw.createdAt)) {
    return { ok: false, error: 'invalidProjectData' }
  }
  if (!Array.isArray(raw.frames)) return { ok: false, error: 'invalidProjectData' }
  if (raw.frames.length > limits.maxFrames) return { ok: false, error: 'tooManyFrames' }
  for (const f of raw.frames) {
    if (!isValidFrameShape(f)) return { ok: false, error: 'invalidProjectData' }
  }

  const kind = raw.kind as ProjectKind
  const fpsLevel = raw.fpsLevel as FpsLevel
  const framesShape = raw.frames as { seq: number; file: string; capturedAt: number }[]
  const sortedFrames = framesShape.slice().sort((a, b) => a.seq - b.seq)

  // [ARCH] bổ sung quy tắc 3 — seq LIÊN TỤC từ 0 (không trùng/không nhảy cóc).
  const seqContiguous = sortedFrames.every((f, i) => f.seq === i)
  if (!seqContiguous) return { ok: false, error: 'invalidProjectData' }

  const frameBytesBySeq = new Map<number, ArrayBuffer>()
  for (const f of sortedFrames) {
    // Tên file PHẢI khớp đúng công thức `%04d`=seq+1 — không tin tưởng string tuỳ ý trong JSON.
    if (f.file !== frameFileName(f.seq)) return { ok: false, error: 'invalidProjectData' }
    const data = unzipped[f.file]
    if (!data) return { ok: false, error: 'invalidProjectData' } // frame trỏ file KHÔNG có trong ZIP
    // Tuần tự (không Promise.all) để failure sớm dừng NGAY, tránh decode thừa các frame còn lại.
    if (!(await isDecodableJpeg(data))) return { ok: false, error: 'invalidProjectData' }
    const copy = data.slice() // bản sao ĐỘC LẬP (buffer riêng, không tham chiếu view lớn hơn của fflate)
    frameBytesBySeq.set(f.seq, copy.buffer)
  }

  // §2.1 — title thiếu/rỗng → tự đặt tên mặc định, KHÔNG từ chối (importer khoan hồng).
  const rawTitle = typeof raw.title === 'string' ? raw.title.trim() : ''
  const resolvedTitle = rawTitle.length > 0 ? rawTitle : defaultProjectTitle(kind)

  // `lastCapturedAt` thiếu → suy từ max(frames[].capturedAt); dự án rỗng → để trống hẳn (omit).
  const lastCapturedAt = typeof raw.lastCapturedAt === 'number' && Number.isFinite(raw.lastCapturedAt)
    ? raw.lastCapturedAt
    : (sortedFrames.length > 0 ? Math.max(...sortedFrames.map(f => f.capturedAt)) : undefined)

  const project: Project = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: raw.id,
    title: resolvedTitle,
    kind,
    fpsLevel,
    createdAt: raw.createdAt,
    frames: sortedFrames.map(f => ({ seq: f.seq, file: f.file, capturedAt: f.capturedAt })),
  }
  if (lastCapturedAt !== undefined) project.lastCapturedAt = lastCapturedAt
  if (typeof raw.exportedAt === 'number' && Number.isFinite(raw.exportedAt)) project.exportedAt = raw.exportedAt

  return {
    ok: true,
    value: { project, frameBytesBySeq, isDuplicateId: existingProjectIds.has(raw.id) },
  }
}

/** Entry point THẬT từ `<input type=file>` — kiểm `file.size` (rẻ, không cần đọc bytes) TRƯỚC,
 *  khớp iOS `parse(fileURL:)` kiểm `attrs[.size]` trước khi `Data(contentsOf:)`. */
export async function parseBbsprojFile(
  file: File,
  existingProjectIds: ReadonlySet<string>,
  limits: ZipBombLimits = DEFAULT_LIMITS,
): Promise<ParseResult> {
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: 'fileTooLarge' }
  let buf: ArrayBuffer
  try {
    buf = await file.arrayBuffer()
  } catch {
    return { ok: false, error: 'invalidZip' }
  }
  return parseBbsprojBytes(new Uint8Array(buf), existingProjectIds, limits)
}

// ---------- Import — commit (ghi đĩa, sau khi call-site đã quyết trùng id nếu có) ----------

/**
 * Ghi `ParsedImport` xuống IndexedDB (mirror iOS `BbsprojArchive.commit`). `resolution='duplicate'`
 * → sinh `id` mới TRƯỚC khi ghi (giữ nguyên nội dung); `'overwrite'` → ghi đè đúng `id` cũ (xoá
 * frame cũ, thay bằng nội dung file nhập — xem `writeImportedProject`); `'notDuplicate'` → ghi
 * thẳng (không có gì để xoá).
 */
export async function commitParsedImport(parsed: ParsedImport, resolution: DuplicateResolution): Promise<Project> {
  const project: Project = resolution === 'duplicate'
    ? { ...parsed.project, id: newProjectId() }
    : parsed.project

  await writeImportedProject(project, parsed.frameBytesBySeq)
  return project
}
