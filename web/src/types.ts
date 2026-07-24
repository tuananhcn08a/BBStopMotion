export type AppState = 'CAPTURING' | 'EXPORTING' | 'SUCCESS'

export type FpsLevel = 'slow' | 'normal' | 'fast'
export const FPS_VALUES: Record<FpsLevel, number> = {
  slow: 1,
  normal: 6,
  fast: 12,
}
export const FPS_LABELS: Record<FpsLevel, string> = {
  slow: 'Chậm',
  normal: 'Thường',
  fast: 'Nhanh',
}
export const FPS_ICONS: Record<FpsLevel, string> = {
  slow: '🐢',
  normal: '🐇',
  fast: '⚡',
}
export const FPS_KEYS: Record<string, FpsLevel> = {
  '1': 'slow',
  '2': 'normal',
  '3': 'fast',
}

export interface CapturedFrame {
  id: string
  dataUrl: string
  timestamp: number
}

export interface ExportResult {
  blob: Blob
  filename: string
  uploadUrl?: string
  expiresAt?: string   // ISO-8601, from NAS upload response
  uploadError?: string
}

export const MIN_FRAMES_TO_EXPORT = 5

// ---------- Bright Studio redesign (T-BS10) ----------

/** Top-level nav destination — F5. T-XW05: `'hub'` = Xưởng phim (màn chính khi mở app, danh sách
 *  dự án); `'capture'` giờ CHỈ tới được từ Hub (mở/tạo dự án), không còn là màn mặc định. */
export type Screen = 'hub' | 'capture' | 'library' | 'settings'

/** Bilingual display mode — F4. */
export type Language = 'vi+en' | 'vi' | 'en'

/** Settings dropdown options for goalFrames — F2 (Q3 default chốt bởi Coordinator). */
export const GOAL_FRAMES_OPTIONS = [10, 20, 30, 50, 75, 100] as const
export type GoalFramesOption = (typeof GOAL_FRAMES_OPTIONS)[number]
export const DEFAULT_GOAL_FRAMES: GoalFramesOption = 30

/** Onion skin opacity default — F3 (Bright Studio handoff overrides old 0.30/0.35). */
export const DEFAULT_ONION_OPACITY = 0.4

export interface AppSettings {
  goalFrames: number
  onionSkinOpacity: number // 0..1
  /** T-XW10 (T-XP58 iOS) — nhớ opacity trước khi tắt (0), để bật lại đúng mức cũ thay vì luôn về
   *  mặc định. Chỉ cập nhật khi `onionSkinOpacity` đổi sang giá trị >0 (xem `App.tsx updateSettings`). */
  onionSkinLastOpacity: number
  language: Language
  soundEnabled: boolean
  autoUpload: boolean
  defaultFpsLevel: FpsLevel
  cameraDeviceId: string | null
}

export const DEFAULT_SETTINGS: AppSettings = {
  goalFrames: DEFAULT_GOAL_FRAMES,
  onionSkinOpacity: DEFAULT_ONION_OPACITY,
  onionSkinLastOpacity: DEFAULT_ONION_OPACITY,
  language: 'vi+en',
  soundEnabled: true,
  autoUpload: false, // F8/Q6b default chốt: auto-upload OFF trên web (xem T-BS10 card)
  defaultFpsLevel: 'normal',
  cameraDeviceId: null,
}

/** Library entry (metadata only — F7, Web storage = IndexedDB per Q6a). */
export interface LibraryEntry {
  id: string
  title: string
  thumbnailDataUrl: string
  frameCount: number
  durationSeconds: number
  createdAt: number // epoch ms
  uploadUrl?: string
  expiresAt?: string // ISO-8601
  /** Tên bé — redline 1g meta "{Tên bé} · {N} frame · {N}s · {giờ}". Web hiện chưa thu thập
   *  tên bé ở luồng thật (ngoài phạm vi F7 hiện có) nên optional; chỉ gate fixture set giá trị này. */
  childName?: string
  /** T-XW17 AC1 — poster JPEG THẬT trích từ MP4 (~0.1s, mirror `LibraryStore.generatePoster` iOS),
   *  sinh ASYNC sau khi export xong (không chặn Success screen) — `undefined` lúc entry mới tạo,
   *  cập nhật khi gen xong. Ưu tiên hiển thị hơn `thumbnailDataUrl` (frame cuối) khi có. Phim CŨ
   *  (trước T-XW17, `posterDataUrl` mãi mãi `undefined`) → UI tự fallback `thumbnailDataUrl`, KHÔNG
   *  backfill hàng loạt (đúng AC1). */
  posterDataUrl?: string
}
