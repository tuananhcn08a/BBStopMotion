import { ProjectFrame, ProjectKind } from './types'

/**
 * T-XW10 — logic THUẦN (không UI, không IndexedDB) cho chế độ Nhật ký 🌱: streak khoan hồng, chip
 * Hub, "hôm nay đã chụp chưa", onion "hôm qua", dự phóng độ dài cuối tháng. Mirror 1-1
 * `Shared/Services/StreakCalculator.swift` + `ProjectHubPresenter.swift` + `FilmProjection.swift`
 * + `CaptureViewModel.diaryYesterdayOnionImage/diaryTodayCount`.
 *
 * MỌI hàm nhận `now` injectable (default `Date.now()`) — KHÔNG gọi `Date.now()` trực tiếp bên
 * trong logic — để unit test được nhiều ngày/ranh giới lịch mà không phải mock global Date.
 * Ngày lịch tính theo múi giờ MÁY (local `Date` getters), khớp `Calendar.current` iOS (múi giờ
 * thiết bị, không phải UTC).
 */

const MS_PER_DAY = 86400000

/** 00:00:00 giờ máy của ngày chứa `ms` — nền tảng cho mọi so sánh "cùng ngày lịch". */
export function startOfDayMs(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * T-XW14 B1 (architect T-XW12) — cộng/trừ N NGÀY LỊCH (không phải N×86 400 000ms) qua
 * `Date.setDate`, DST-safe: ngày chuyển giờ có thể chỉ dài 23h/25h thực, trừ đúng
 * `MS_PER_DAY` từ một mốc `startOfDayMs` có thể lệch sang SAI ngày lịch (vd nhảy lùi 2 ngày hoặc
 * đứng nguyên ngày cũ) ở các múi giờ có DST. Mirror `Calendar.date(byAdding: .day, value:, to:)`
 * iOS (`CaptureViewModel.diaryYesterdayOnionImage` dùng chính API này). Luôn trả mốc
 * `startOfDayMs` (00:00:00) vì call-site duy nhất cần "ngày lịch trước", không cần giữ giờ/phút gốc.
 */
export function addDaysMs(ms: number, days: number): number {
  const d = new Date(ms)
  d.setDate(d.getDate() + days)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Danh sách "ngày lịch có chụp" đã dedup + sort tăng dần (nhiều ảnh cùng ngày → 1 ngày). */
export function distinctCaptureDaysMs(capturedAtMs: number[]): number[] {
  const unique = new Set(capturedAtMs.map(startOfDayMs))
  return Array.from(unique).sort((a, b) => a - b)
}

/** TS-XP-03/BR-XP-9 — "hôm nay đã chụp chưa" (dùng cho chip `todo` + `diaryTodayCount`). */
export function hasCapturedToday(capturedAtMs: number[], now: number = Date.now()): boolean {
  const today = startOfDayMs(now)
  return capturedAtMs.some(ms => startOfDayMs(ms) === today)
}

/**
 * BR-XP-7/8 — streak khoan hồng: nghỉ ĐÚNG 1 ngày lịch (khoảng cách 2 ngày giữa 2 lần chụp) vẫn
 * +1 tiếp (KHÔNG reset); nghỉ ≥2 ngày liên tiếp (khoảng cách ≥3 ngày) → reset về 1 kể từ ngày đó.
 * Mirror `StreakCalculator.streak` — KHÔNG cần `now` (chỉ tính từ khoảng cách nội bộ giữa các
 * ngày đã chụp, không so với "hôm nay"; call-site `computeProjectChip` tự gate qua `hasCapturedToday`).
 */
export function computeStreak(capturedAtMs: number[]): number {
  const days = distinctCaptureDaysMs(capturedAtMs)
  if (days.length === 0) return 0

  let current = 1
  for (let i = 1; i < days.length; i++) {
    const gapDays = Math.round((days[i] - days[i - 1]) / MS_PER_DAY)
    current = gapDays <= 2 ? current + 1 : 1
  }
  return current
}

export type ProjectChipKind = 'todo' | 'streak' | 'done'

export interface ProjectChipResult {
  kind: ProjectChipKind
  /** Chỉ có khi `kind==='streak'`. */
  streakDays?: number
}

/**
 * Mirror `ProjectHubPresenter.chip` — ĐÚNG 1 chip/dự án, priority (diary): `todo` (chưa chụp hôm
 * nay) > `streak` (đã chụp hôm nay VÀ streak>0). Sau đó (MỌI kind): `exportedAt` có giá trị →
 * `done`. Không khớp gì → `null` (không hiện chip — khớp iOS: 🎭 chưa xuất KHÔNG có chip nào).
 */
export function computeProjectChip(
  kind: ProjectKind,
  exportedAt: number | undefined,
  capturedAtMs: number[],
  now: number = Date.now(),
): ProjectChipResult | null {
  if (kind === 'diary') {
    if (!hasCapturedToday(capturedAtMs, now)) return { kind: 'todo' }
    const streak = computeStreak(capturedAtMs)
    if (streak > 0) return { kind: 'streak', streakDays: streak }
  }
  if (exportedAt !== undefined) return { kind: 'done' }
  return null
}

/** TS-XP-15 — "Hôm nay: X ảnh", đếm theo ngày lịch (không theo phiên app). */
export function diaryTodayCount(capturedAtMs: number[], now: number = Date.now()): number {
  const today = startOfDayMs(now)
  return capturedAtMs.filter(ms => startOfDayMs(ms) === today).length
}

/**
 * BR-XP-5 — `seq` của ảnh MỚI NHẤT thuộc ngày lịch LIỀN TRƯỚC hôm nay (không phải frame liền
 * trước trong phiên). `null` = chưa có ảnh hôm qua (TS-XP-16 Empty — Ngày 1, chưa gì để căn theo).
 * Mirror `CaptureViewModel.diaryYesterdayOnionImage` (trả `seq` thay vì ảnh đã decode — call-site
 * tự `getFrameBytes(projectId, seq)` khi cần, tách biệt logic thuần khỏi IndexedDB).
 */
export function latestFrameSeqForYesterday(frames: ProjectFrame[], now: number = Date.now()): number | null {
  // T-XW14 B1 — `addDaysMs(now, -1)` (lịch, DST-safe) THAY `startOfDayMs(now) - MS_PER_DAY` (ms
  // cố định, có thể lệch ngày ở ranh giới DST). Xem doc-comment `addDaysMs`.
  const yesterday = addDaysMs(now, -1)

  let best: ProjectFrame | null = null
  for (const frame of frames) {
    if (startOfDayMs(frame.capturedAt) === yesterday) {
      if (!best || frame.capturedAt > best.capturedAt) best = frame
    }
  }
  return best ? best.seq : null
}

/**
 * T-XP13 `FilmProjection.endOfMonthDurationSeconds` — dự phóng độ dài phim cuối tháng từ nhịp
 * chụp trung bình/ngày × số ngày còn lại trong tháng. `null` khi chưa đủ dữ liệu (<2 ngày lịch
 * khác nhau đã chụp) — call-site hiện `neutralCard` thay vì suy diễn từ 1 điểm dữ liệu.
 */
export function endOfMonthDurationSeconds(
  capturedAtMs: number[],
  fps: number,
  now: number = Date.now(),
): number | null {
  if (fps <= 0 || capturedAtMs.length === 0) return null

  const days = distinctCaptureDaysMs(capturedAtMs)
  if (days.length < 2) return null

  const avgFramesPerDay = capturedAtMs.length / days.length
  const nowDate = new Date(now)
  const daysInMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0).getDate()
  const dayOfMonth = nowDate.getDate()
  const daysRemaining = Math.max(0, daysInMonth - dayOfMonth)

  const projectedFrames = capturedAtMs.length + avgFramesPerDay * daysRemaining
  return projectedFrames / fps
}

/** Số ngày lịch khác nhau đã có ít nhất 1 ảnh — dùng cho `draftMeta`/điều kiện thẻ dự phóng. */
export function capturedDaysCount(capturedAtMs: number[]): number {
  return distinctCaptureDaysMs(capturedAtMs).length
}

/**
 * T-XP39 — vị trí ảnh SẮP chụp (forward-looking = tổng hiện có + 1), dùng cho badge "🌱 Ảnh N/M"
 * lúc đang chụp (N luôn == M ở màn Chụp — xem `diaryStatusText` iOS, KHÔNG phải bug). Luôn có giá
 * trị (kể cả 0 frame → 1), khác `diaryPhotoPositionLast` (S4, chỉ có khi đã có ≥1 frame).
 */
export function diaryPhotoPositionNext(frameCount: number): number {
  return frameCount + 1
}

/** `diaryDayNumber` iOS (S4 header) — vị trí ảnh CUỐI đã có = tổng frame. `null` khi 0 frame. */
export function diaryPhotoPositionLast(frameCount: number): number | null {
  return frameCount > 0 ? frameCount : null
}

/**
 * Mirror `ProjectDay.number` — "Ngày N" THEO LỊCH kể từ `createdAt` (ngày tạo = Ngày 1), CHỈ dùng
 * ở Hub (badge góc thumbnail dự án 🌱) — KHÔNG dùng ở màn Chụp (dùng `diaryPhotoPositionNext` theo
 * vị trí, xem module doc). Không phụ thuộc số lần chụp trong ngày, chỉ phụ thuộc ngày lịch trôi
 * qua. Luôn ≥1 (không bao giờ về 0/âm dù `createdAt` tính sai lệch múi giờ biên).
 */
export function projectDayNumber(createdAtMs: number, now: number = Date.now()): number {
  const createdDay = startOfDayMs(createdAtMs)
  const referenceDay = startOfDayMs(now)
  const diffDays = Math.round((referenceDay - createdDay) / MS_PER_DAY)
  return Math.max(1, diffDays + 1)
}
