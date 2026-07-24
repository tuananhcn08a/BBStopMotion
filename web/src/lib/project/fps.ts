import { FpsLevel } from '../../types'
import { ProjectKind } from './types'

/**
 * T-XW03 — Bảng fps chuẩn `(kind, fpsLevel) → fps số`, nguồn chân lý DUY NHẤT cho mọi dự án
 * (Hoạt hình lẫn Nhật ký). Khớp `FpsTable` phía iOS (`bbsproj-format-v1.md` §4 [BINDING] toàn bộ
 * 6 ô):
 *   - animation: slow=1 / normal=6 / fast=12 (zero-regression — khớp `FPS_VALUES` cũ toàn hệ).
 *   - diary: slow=3 (MỚI, override riêng) / normal=6 / fast=12 (kế thừa animation).
 *
 * `FPS_VALUES` cũ trong `src/types.ts` GIỮ NGUYÊN (tương thích code hiện có ở CaptureScreen/
 * FpsSelector/useExport — tất cả đang implicit dùng bảng `animation`) — `fpsFor('animation', l)`
 * === `FPS_VALUES[l]` cho mọi `l`.
 */
const FPS_TABLE: Record<ProjectKind, Record<FpsLevel, number>> = {
  animation: { slow: 1, normal: 6, fast: 12 },
  diary: { slow: 3, normal: 6, fast: 12 },
}

export function fpsFor(kind: ProjectKind, level: FpsLevel): number {
  return FPS_TABLE[kind][level]
}

/** fpsLevel mặc định theo kind [BINDING]: `animation → normal` · `diary → slow`. */
export function defaultFpsLevel(kind: ProjectKind): FpsLevel {
  return kind === 'animation' ? 'normal' : 'slow'
}
