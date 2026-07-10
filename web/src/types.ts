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

/** Top-level nav destination — F5. */
export type Screen = 'capture' | 'library' | 'settings'

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
  language: Language
  soundEnabled: boolean
  autoUpload: boolean
  defaultFpsLevel: FpsLevel
  cameraDeviceId: string | null
}

export const DEFAULT_SETTINGS: AppSettings = {
  goalFrames: DEFAULT_GOAL_FRAMES,
  onionSkinOpacity: DEFAULT_ONION_OPACITY,
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
}
