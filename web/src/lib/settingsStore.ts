import { AppSettings, DEFAULT_SETTINGS } from '../types'

const STORAGE_KEY = 'bbstopmotion.settings.v1'

/** Đọc settings đã lưu từ localStorage — F2/F3/F4/F8 persist qua session (TS-BS-27). */
export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/** Ghi settings vào localStorage — gọi mỗi khi 1 field đổi. */
export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // localStorage không khả dụng (vd chế độ riêng tư) — bỏ qua, không crash app
  }
}
