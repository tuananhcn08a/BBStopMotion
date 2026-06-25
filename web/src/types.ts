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
  uploadError?: string
}

export const MIN_FRAMES_TO_EXPORT = 5
