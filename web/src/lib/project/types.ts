import { FpsLevel } from '../../types'

/**
 * T-XW03 — Type `Project`/`ProjectFrame` khớp BYTE-EXACT schema `.bbsproj` v1 (nguồn sự thật iOS:
 * `bbstopmotion-apple/Shared/Models/Project.swift`), để 2 nền mở file dự án của nhau (T-XW04 sau
 * này zip/unzip đúng cấu trúc này). KHÔNG thêm field ngoài schema ở đây.
 */
export type { FpsLevel }

/** `kind` quyết định fps mặc định + hành vi onion skin — khớp `ProjectKind` (Swift). */
export type ProjectKind = 'animation' | 'diary'

/** Schema v1 hiện hành — mọi dự án mới tạo trên máy đều ở version này. */
export const CURRENT_SCHEMA_VERSION = 1 as const

/** 1 frame trong dự án — đúng field bắt buộc (`seq`/`file`/`capturedAt`), KHÔNG chứa bytes ảnh. */
export interface ProjectFrame {
  /** Liên tục từ 0. */
  seq: number
  /** `"frames/%04d.jpg"` với `seq+1` pad 4 → `seq: 0` → `"frames/0001.jpg"`. */
  file: string
  /** epoch milliseconds [BINDING]. */
  capturedAt: number
}

/**
 * Toàn bộ nội dung tương ứng `project.json` phía iOS — field/kiểu PHẢI khớp schema tuyệt đối.
 * `lastCapturedAt`/`exportedAt` OMIT hẳn key khi không có giá trị (không ghi `undefined`/`0`) —
 * khớp `Codable` `encodeIfPresent` phía Swift (§10-Q1 bbsproj-format-v1.md).
 */
export interface Project {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION
  /** `"proj-" + uuidv4` (lowercase, có dấu gạch). */
  id: string
  title: string
  kind: ProjectKind
  fpsLevel: FpsLevel
  /** epoch ms — lúc tạo dự án. */
  createdAt: number
  /** epoch ms, optional — thiếu thì nền suy từ `max(frames[].capturedAt)`. */
  lastCapturedAt?: number
  /** epoch ms, optional — BỎ HẲN field khi chưa export. */
  exportedAt?: number
  frames: ProjectFrame[]
}

/**
 * Denorm cho Hub — load nhanh không cần đọc hết `frames` của mọi dự án (khớp `ProjectMeta` Swift).
 * `coverFrameSeq` (thay vì `coverFrameFile` bên Swift) vì web tra bytes qua `[projectId, seq]`.
 */
export interface ProjectMeta {
  id: string
  title: string
  kind: ProjectKind
  fpsLevel: FpsLevel
  frameCount: number
  coverFrameSeq?: number
  createdAt: number
  lastCapturedAt?: number
  exportedAt?: number
}

/** §1 [BINDING] — `frames/{seq+1 pad 4}.jpg`. `seq: 0` → `frames/0001.jpg`. */
export function frameFileName(seq: number): string {
  return `frames/${String(seq + 1).padStart(4, '0')}.jpg`
}

/** §2.1 — `id = "proj-" + UUIDv4` (lowercase, có dấu gạch). */
export function newProjectId(): string {
  return `proj-${crypto.randomUUID()}`.toLowerCase()
}

/** Tên gợi ý mặc định khi `title` rỗng/thiếu (fallback tối thiểu, khớp `resolvedTitle` Swift). */
export function defaultProjectTitle(kind: ProjectKind): string {
  return kind === 'animation' ? 'Phim hoạt hình mới' : 'Nhật ký mới'
}
