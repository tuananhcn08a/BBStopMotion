/**
 * T-XW05 AC6 — Export KHÔNG đóng dự án: sau export thành công, dự án VẪN còn trong Hub
 * (`exportedAt` set, chip đổi "Đang làm" → "Đã xuất phim"), KHÔNG bị xoá/reset khỏi danh sách.
 * Mirror iOS `ProjectStore.markExported` (T-XP13 quyết định #10).
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CapturedFrame, FpsLevel } from '../src/types'
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

const mockExportVideo = vi.fn()
vi.mock('../src/hooks/useExport', () => ({
  useExport: () => ({
    exportVideo: mockExportVideo,
    isExporting: false,
    progress: { stage: 'mp4', percent: 0 },
  }),
  uploadExportedFile: vi.fn(),
}))

vi.mock('../src/components/SuccessScreen', () => ({
  default: ({ onNewFilm }: { onNewFilm: () => void }) => (
    <div data-testid="success-screen">
      <button data-testid="success-back-to-hub" onClick={onNewFilm}>Làm phim mới</button>
    </div>
  ),
}))

vi.mock('../src/components/CaptureScreen', () => ({
  default: ({ onExport }: { onExport: (f: CapturedFrame[], fps: FpsLevel) => void }) => (
    <div data-testid="capture-screen">
      <button
        data-testid="trigger-export"
        onClick={() => onExport(
          Array.from({ length: 5 }, (_, i) => ({ id: `f${i}`, dataUrl: 'data:image/jpeg;base64,test', timestamp: i })),
          'normal',
        )}
      >
        Export
      </button>
    </div>
  ),
}))

beforeEach(async () => {
  vi.clearAllMocks()
  vi.resetModules()
  await resetProjectDb()
})

async function dismissWelcomeAndCreateProject() {
  const user = userEvent.setup()
  const startBtn = await screen.findByRole('button', { name: /Bắt đầu làm phim/i })
  await user.click(startBtn)
  await user.click(await screen.findByTestId('hub-new-project-card'))
  await user.click(await screen.findByTestId('new-project-cta'))
}

describe('App — export không đóng dự án (AC6)', () => {
  it('export thành công → SuccessScreen "Làm phim mới" → về Hub → dự án CÒN, chip "Đã xuất phim"', async () => {
    mockExportVideo.mockResolvedValue({
      blob: new Blob(['fake'], { type: 'video/mp4' }),
      filename: 'phim-cua-con-test.mp4',
    })

    const { default: AppDynamic } = await import('../src/App')
    render(<AppDynamic />)
    await dismissWelcomeAndCreateProject()

    const user = userEvent.setup()
    await user.click(await screen.findByTestId('trigger-export'))

    await waitFor(() => expect(screen.getByTestId('success-screen')).toBeInTheDocument())

    // T-XW05: "Làm phim mới" khi có dự án bind → về Hub (KHÔNG xoá dữ liệu đã persist — xem
    // App.tsx handleNewFilm). Gate fixture/luồng cũ (không dự án) vẫn reset-tại-chỗ như trước.
    await user.click(screen.getByTestId('success-back-to-hub'))

    await waitFor(() => {
      expect(document.querySelector('[data-landmark="hub-screen"]')).toBeInTheDocument()
    })
    const projectCard = await screen.findByTestId(/^hub-project-proj-/)
    expect(projectCard).toBeInTheDocument()
    expect(projectCard).toHaveTextContent('Đã xuất phim')
    expect(projectCard).not.toHaveTextContent('Đang làm')
  })
})
