/**
 * T-XW21 (S5) — App.tsx orchestration: nudge TỰ ĐỘNG ngay sau khi tạo dự án 🌱 Nhật ký (điểm vào
 * (a)), dự án 🎭 Hoạt hình KHÔNG kích hoạt nudge, Cài đặt (điểm vào (b)) luôn mở lại được, "Để sau"
 * đóng gọn không throw.
 *
 * LƯU Ý MÔI TRƯỜNG: jsdom (vitest) KHÔNG implement `localStorage.setItem/getItem/clear` (verify
 * thực nghiệm: `typeof localStorage.setItem === 'undefined'` trong jsdom hiện tại) — App.tsx đã
 * bọc try/catch quanh MỌI truy cập (`readAppIntroSeen`/`writeAppIntroSeen`, cùng quy ước
 * `readWelcomeSeen`/`writeWelcomeSeen` T-XW05) nên KHÔNG crash, nhưng persist THẬT xuyên
 * remount/phiên KHÔNG verify được ở tầng jsdom — cùng giới hạn đã biết với `welcomeSeen` (F6),
 * vốn cũng chỉ verify persist thật qua e2e Chrome thật (`project-resume.test.mjs`
 * "D0-welcome-not-shown-again-after-reload"). Persist thật của app-intro-seen được verify tương tự
 * ở `e2e/bbsproj-transfer.test.mjs`.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DB_NAME, resetAppDbConnectionForTests } from '../src/lib/db/appDb'

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
  useExport: () => ({ exportVideo: vi.fn(), isExporting: false, progress: { stage: 'mp4', percent: 0 } }),
  uploadExportedFile: vi.fn(),
}))

vi.mock('../src/components/CaptureScreen', () => ({
  default: () => <div data-testid="capture-screen">CAPTURE</div>,
}))

async function dismissWelcome() {
  const user = userEvent.setup()
  const startBtn = await screen.findByRole('button', { name: /Bắt đầu làm phim/i })
  await user.click(startBtn)
}

/** Tạo dự án qua sheet S2 — chọn đúng `kind` trước khi bấm CTA (mặc định sheet chọn sẵn animation). */
async function createProjectFromHub(kind: 'animation' | 'diary') {
  const user = userEvent.setup()
  await user.click(await screen.findByTestId('hub-new-project-card'))
  if (kind === 'diary') {
    await user.click(await screen.findByTestId('new-project-type-diary'))
  }
  await user.click(await screen.findByTestId('new-project-cta'))
}

beforeEach(async () => {
  vi.resetModules()
  await resetProjectDb()
})

describe('App — S5 nudge tự động sau khi tạo dự án 🌱 Nhật ký', () => {
  it('tạo dự án Nhật ký ĐẦU (chưa từng "Để sau") → AppIntroScreen tự hiện', async () => {
    const { default: AppDynamic } = await import('../src/App')
    render(<AppDynamic />)
    await dismissWelcome()
    await createProjectFromHub('diary')

    await waitFor(() => expect(screen.getByTestId('capture-screen')).toBeInTheDocument())
    expect(screen.getByTestId('app-intro-screen')).toBeInTheDocument()
  })

  it('tạo dự án 🎭 Hoạt hình → KHÔNG tự hiện AppIntroScreen', async () => {
    const { default: AppDynamic } = await import('../src/App')
    render(<AppDynamic />)
    await dismissWelcome()
    await createProjectFromHub('animation')

    await waitFor(() => expect(screen.getByTestId('capture-screen')).toBeInTheDocument())
    expect(screen.queryByTestId('app-intro-screen')).toBeNull()
  })

  it('bấm "Để sau" → đóng gọn, không throw (dù localStorage.setItem có thể không khả dụng trong jsdom)', async () => {
    const { default: AppDynamic } = await import('../src/App')
    render(<AppDynamic />)
    await dismissWelcome()
    await createProjectFromHub('diary')
    await waitFor(() => expect(screen.getByTestId('app-intro-screen')).toBeInTheDocument())

    const user = userEvent.setup()
    await user.click(screen.getByTestId('app-intro-later-btn'))
    expect(screen.queryByTestId('app-intro-screen')).toBeNull()
  })

  it('click backdrop (đóng thường, không phải "Để sau") → đóng gọn, không throw', async () => {
    const { default: AppDynamic } = await import('../src/App')
    render(<AppDynamic />)
    await dismissWelcome()
    await createProjectFromHub('diary')
    await waitFor(() => expect(screen.getByTestId('app-intro-screen')).toBeInTheDocument())

    const user = userEvent.setup()
    await user.click(screen.getByTestId('app-intro-backdrop'))
    expect(screen.queryByTestId('app-intro-screen')).toBeNull()
  })
})

describe('App — S5 điểm vào (b): Cài đặt LUÔN mở lại được, không phụ thuộc cờ persist', () => {
  it('vào Cài đặt bấm hàng "Giới thiệu app iPhone" → mở được (không gate theo cờ "đã xem")', async () => {
    const { default: AppDynamic } = await import('../src/App')
    render(<AppDynamic />)
    await dismissWelcome()

    const user = userEvent.setup()
    await user.click(screen.getByTestId('nav-settings'))
    await waitFor(() => expect(screen.getByTestId('settings-app-intro-row')).toBeInTheDocument())
    await user.click(screen.getByTestId('settings-app-intro-row'))

    expect(screen.getByTestId('app-intro-screen')).toBeInTheDocument()
  })
})
