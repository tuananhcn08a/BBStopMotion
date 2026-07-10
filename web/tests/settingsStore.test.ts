/**
 * F8 — settings persist qua lần mở lại app (localStorage). BA Scenario: TS-BS-27:
 * đổi `soundEnabled=false`, `goalFrames=20` → đóng app/tab → mở lại → 2 setting vẫn giữ giá trị.
 *
 * Trước bản vá này, `settingsStore.ts` chỉ được nhắc tới bằng comment (không có assert thật)
 * — architect gate FAIL, T-BS12.
 *
 * Ghi chú môi trường: máy chạy test có Node 22+ với global `localStorage` thực nghiệm bị hỏng
 * (thiếu `--localstorage-file` hợp lệ → object rỗng, không có `getItem/setItem/clear`), đè lên
 * bản triển khai đầy đủ của jsdom. Test tự dựng 1 in-memory Storage polyfill và `vi.stubGlobal`
 * để round-trip qua đúng API `localStorage` mà `settingsStore.ts` dùng, không phụ thuộc quirk môi trường.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadSettings, saveSettings } from '../src/lib/settingsStore'
import { DEFAULT_SETTINGS } from '../src/types'

function createMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => { store.set(key, String(value)) },
    removeItem: (key: string) => { store.delete(key) },
    clear: () => { store.clear() },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size },
  } as Storage
}

let memoryStorage: Storage

beforeEach(() => {
  memoryStorage = createMemoryStorage()
  vi.stubGlobal('localStorage', memoryStorage)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('settingsStore — round-trip localStorage (F8, TS-BS-27)', () => {
  it('chưa lưu gì → loadSettings trả về DEFAULT_SETTINGS', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('TS-BS-27: saveSettings rồi loadSettings lại → giữ nguyên soundEnabled=false, goalFrames=20 (mô phỏng mở lại app)', () => {
    const changed = { ...DEFAULT_SETTINGS, soundEnabled: false, goalFrames: 20 }
    saveSettings(changed)

    // "Mở lại app" = gọi loadSettings() độc lập, không dùng lại biến `changed` trong bộ nhớ.
    const reloaded = loadSettings()
    expect(reloaded.soundEnabled).toBe(false)
    expect(reloaded.goalFrames).toBe(20)
    expect(reloaded).toEqual(changed)
  })

  it('load merge với DEFAULT_SETTINGS khi bản lưu cũ thiếu field mới (tương thích ngược)', () => {
    localStorage.setItem('bbstopmotion.settings.v1', JSON.stringify({ goalFrames: 50 }))
    const loaded = loadSettings()
    expect(loaded.goalFrames).toBe(50)
    // Field không có trong bản lưu cũ vẫn lấy default (không undefined/crash)
    expect(loaded.language).toBe(DEFAULT_SETTINGS.language)
    expect(loaded.defaultFpsLevel).toBe(DEFAULT_SETTINGS.defaultFpsLevel)
  })

  it('load bỏ qua JSON hỏng, trả về DEFAULT_SETTINGS thay vì crash', () => {
    localStorage.setItem('bbstopmotion.settings.v1', '{not-json')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})
