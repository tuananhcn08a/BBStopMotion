/**
 * F5 — chuyển screen giữ nguyên dữ liệu chụp dở. BA Scenario: TS-BS-14 (P0).
 *
 * T-XW05 — kiến trúc đổi: Capture không còn nav trực tiếp (chỉ tới qua Hub → mở/tạo dự án).
 * "Giữ nguyên frames khi rời màn" giờ do TẦNG PERSISTENCE đảm nhiệm (mỗi frame `addFrame` ghi
 * ngay xuống IndexedDB — T-XW03/T-XW05 AC3), KHÔNG còn dựa vào React state sống sót qua nav như
 * bản cũ. Test cập nhật đúng luồng mới: chụp 3 frame (mock CaptureScreen gọi CẢ `setFrames` LẪN
 * `onFrameCaptured` — mô phỏng đúng hành vi `CaptureScreen.tsx` thật) → sang Thư viện → về Hub →
 * MỞ LẠI card dự án (resume, đọc lại từ IndexedDB) → vẫn còn đủ 3 frame.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CapturedFrame } from '../src/types'
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
  useExport: () => ({
    exportVideo: vi.fn(),
    isExporting: false,
    progress: { stage: 'mp4', percent: 0 },
  }),
  uploadExportedFile: vi.fn(),
}))

// Mock CaptureScreen tối giản — hiển thị frames.length + 1 nút thêm frame, GỌI CẢ `setFrames`
// (state UI) lẫn `onFrameCaptured` (persistence — đúng hành vi `CaptureScreen.tsx` thật ở
// `handleCapture`), để bài test mô phỏng "đang chụp dở N frame" mà không cần dựng camera thật.
vi.mock('../src/components/CaptureScreen', () => ({
  default: ({ frames, setFrames, onFrameCaptured }: {
    frames: CapturedFrame[]
    setFrames: (updater: (prev: CapturedFrame[]) => CapturedFrame[]) => void
    onFrameCaptured?: (frame: CapturedFrame) => void
  }) => (
    <div data-testid="capture-screen">
      <span data-testid="capture-frame-count">{frames.length}</span>
      <button
        data-testid="add-frame"
        onClick={() => {
          const frame: CapturedFrame = {
            id: `f${frames.length}`,
            dataUrl: 'data:image/jpeg;base64,test',
            timestamp: frames.length,
          }
          setFrames(prev => [...prev, frame])
          onFrameCaptured?.(frame)
        }}
      >
        Add frame
      </button>
    </div>
  ),
}))

vi.mock('../src/components/LibraryScreen', () => ({
  default: () => <div data-testid="library-screen-stub">LIBRARY</div>,
}))

async function dismissWelcome() {
  const user = userEvent.setup()
  const startBtn = await screen.findByRole('button', { name: /Bắt đầu làm phim/i })
  await user.click(startBtn)
}

async function createProjectFromHub() {
  const user = userEvent.setup()
  await user.click(await screen.findByTestId('hub-new-project-card'))
  await user.click(await screen.findByTestId('new-project-cta'))
}

beforeEach(async () => {
  vi.resetModules()
  await resetProjectDb()
})

describe('App — resume giữ nguyên frames đang chụp dở qua persistence (F5/TS-BS-14, T-XW05 AC3)', () => {
  it('chụp 3 frame → sang Thư viện → về Hub → mở lại dự án (resume) → vẫn còn đủ 3 frame', async () => {
    const { default: AppDynamic } = await import('../src/App')
    render(<AppDynamic />)
    await dismissWelcome()
    await createProjectFromHub()

    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByTestId('capture-screen')).toBeInTheDocument())

    // "Chụp" 3 frame dở — mock gọi onFrameCaptured nên đã ghi xuống IndexedDB (autosave thật).
    await user.click(screen.getByTestId('add-frame'))
    await user.click(screen.getByTestId('add-frame'))
    await user.click(screen.getByTestId('add-frame'))
    expect(screen.getByTestId('capture-frame-count')).toHaveTextContent('3')

    // Chuyển sang Thư viện
    await user.click(screen.getByTestId('nav-library'))
    await waitFor(() => expect(screen.getByTestId('library-screen-stub')).toBeInTheDocument())
    expect(screen.queryByTestId('capture-screen')).not.toBeInTheDocument()

    // Về Hub — card dự án vẫn còn (chưa xoá/export), mở lại (resume) qua IndexedDB.
    await user.click(screen.getByTestId('nav-hub'))
    const projectCard = await screen.findByTestId(/^hub-project-proj-/)
    await user.click(projectCard)

    // frameCount phải vẫn = 3 sau khi resume — đọc lại TỪ IndexedDB, không phải React state cũ.
    await waitFor(() => expect(screen.getByTestId('capture-screen')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByTestId('capture-frame-count')).toHaveTextContent('3'))
  })
})
