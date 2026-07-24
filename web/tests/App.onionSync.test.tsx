/**
 * F3 — onionSkinOpacity mặc định 0.4; TS-BS-10: opacity=0% ở Settings → toggle Onion skin ở
 * 2a tự chuyển sang tắt (đồng bộ 2 control).
 *
 * T-XW05 — routing đổi sang Hub-first: Capture giờ CHỈ tới được qua Hub (tạo/mở dự án), không
 * còn nav "Chụp phim" trực tiếp. Helper `goToCapture()` cập nhật đi qua đúng luồng mới (tạo 1 dự
 * án Hoạt hình từ sheet). Dùng `fake-indexeddb/auto` thật (không mock nội bộ) vì App giờ phụ
 * thuộc tầng data layer T-XW03 để vào được Capture.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DB_NAME, resetAppDbConnectionForTests } from '../src/lib/db/appDb'

/** Xoá sạch DB giữa các test trong file này — mỗi test tự tạo 1 dự án qua Hub, không dọn sẽ
 *  cộng dồn dự án cũ (T-XW03 pattern: đóng connection singleton TRƯỚC khi deleteDatabase, nếu
 *  không sẽ "blocked" vô thời hạn). */
async function resetProjectDb(): Promise<void> {
  await resetAppDbConnectionForTests()
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}

vi.mock('../src/hooks/useExport', () => ({
  useExport: () => ({
    exportVideo: vi.fn(),
    isExporting: false,
    progress: { stage: 'mp4', percent: 0 },
  }),
  uploadExportedFile: vi.fn(),
}))

vi.mock('../src/hooks/useCamera', () => ({
  useCamera: () => ({
    videoRef: { current: null },
    state: 'live' as const,
    stream: {} as MediaStream,
    devices: [],
    activeDeviceId: null,
    requestCamera: vi.fn().mockResolvedValue(undefined),
    switchCamera: vi.fn().mockResolvedValue(undefined),
    error: null,
  }),
}))

vi.mock('../src/hooks/useCapture', () => ({
  useCapture: () => ({
    captureFrame: vi.fn(),
    deleteLastFrame: (frames: unknown[]) => frames.slice(0, -1),
    deleteFrameAt: (frames: unknown[], index: number) =>
      [...frames.slice(0, index), ...frames.slice(index + 1)],
    getOnionSkinFrame: () => null,
  }),
}))

beforeEach(async () => {
  window.localStorage?.clear?.()
  vi.resetModules()
  await resetProjectDb()
})

/** Welcome → Hub → "+ Dự án mới" → CTA sheet (mặc định 🎭 Hoạt hình đã chọn sẵn) → vào Capture
 *  của dự án vừa tạo. Thay cho `nav-capture` cũ (đã bỏ — Capture chỉ tới được qua Hub, T-XW05). */
async function goToCapture() {
  const user = userEvent.setup()
  const startBtn = await screen.findByRole('button', { name: /Bắt đầu làm phim/i })
  await user.click(startBtn)

  await user.click(await screen.findByTestId('hub-new-project-card'))
  await user.click(await screen.findByTestId('new-project-cta'))
  await waitFor(() => expect(screen.getByTestId('camera-video')).toBeInTheDocument())
}

/** Từ Settings, quay lại Capture của dự án đang mở qua Hub (mở lại card duy nhất — resume). */
async function backToCaptureViaHub() {
  const user = userEvent.setup()
  await user.click(screen.getByTestId('nav-hub'))
  const projectCard = await screen.findByTestId(/^hub-project-proj-/)
  await user.click(projectCard)
  await waitFor(() => expect(screen.getByTestId('camera-video')).toBeInTheDocument())
}

describe('App — onion opacity 0% đồng bộ tắt toggle (TS-BS-10)', () => {
  it('F3 mặc định: onionSkinOpacity=0.4 → toggle Onion skin bật (aria-pressed=true)', async () => {
    const { default: AppDynamic } = await import('../src/App')
    render(<AppDynamic />)
    await goToCapture()

    await waitFor(() => {
      expect(screen.getByTestId('onion-toggle')).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('TS-BS-10: đổi slider Settings về 0% → quay lại Capture (qua Hub), toggle Onion skin tự tắt', async () => {
    const { default: AppDynamic } = await import('../src/App')
    render(<AppDynamic />)
    await goToCapture()

    const user = userEvent.setup()
    await user.click(screen.getByTestId('nav-settings'))

    const slider = await screen.findByTestId('onion-opacity-slider') as HTMLInputElement
    // <input type="range"> không "gõ" được qua userEvent.type — set value qua native setter
    // rồi bắn 'input' (React onChange lắng nghe 'input', không phải 'change', cho range/text).
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    nativeSetter?.call(slider, '0')
    slider.dispatchEvent(new Event('input', { bubbles: true }))

    await backToCaptureViaHub()

    await waitFor(() => {
      expect(screen.getByTestId('onion-toggle')).toHaveAttribute('aria-pressed', 'false')
    })
  })
})
