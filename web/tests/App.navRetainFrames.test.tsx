/**
 * F5 — chuyển screen giữ nguyên dữ liệu chụp dở. BA Scenario: TS-BS-14 (P0):
 * "Đang có 8 frame ở screen='capture' → Click nav Thư viện → click lại Chụp phim →
 *  frameCount vẫn = 8, filmstrip hiển thị đủ 8 frame như trước khi rời màn."
 *
 * Trước bản vá này (T-BS12 architect FAIL): không có test tự động nào phủ TS-BS-14.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CapturedFrame } from '../src/types'

vi.mock('../src/hooks/useExport', () => ({
  useExport: () => ({
    exportVideo: vi.fn(),
    isExporting: false,
    progress: { stage: 'mp4', percent: 0 },
  }),
  uploadExportedFile: vi.fn(),
}))

// Mock CaptureScreen tối giản — chỉ cần hiển thị frames.length + 1 nút thêm frame, để bài test
// mô phỏng "đang chụp dở N frame" mà không cần dựng camera/useCamera thật.
vi.mock('../src/components/CaptureScreen', () => ({
  default: ({ frames, setFrames }: {
    frames: CapturedFrame[]
    setFrames: (updater: (prev: CapturedFrame[]) => CapturedFrame[]) => void
  }) => (
    <div data-testid="capture-screen">
      <span data-testid="capture-frame-count">{frames.length}</span>
      <button
        data-testid="add-frame"
        onClick={() => setFrames(prev => [...prev, {
          id: `f${prev.length}`,
          dataUrl: 'data:image/jpeg;base64,test',
          timestamp: prev.length,
        }])}
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

beforeEach(() => {
  vi.resetModules()
})

describe('App — nav giữ nguyên frames đang chụp dở (F5/TS-BS-14)', () => {
  it('TS-BS-14: chụp 3 frame → chuyển sang Thư viện → quay lại Chụp phim → vẫn còn đủ 3 frame', async () => {
    const { default: AppDynamic } = await import('../src/App')
    render(<AppDynamic />)
    await dismissWelcome()

    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByTestId('capture-screen')).toBeInTheDocument())

    // "Chụp" 3 frame dở
    await user.click(screen.getByTestId('add-frame'))
    await user.click(screen.getByTestId('add-frame'))
    await user.click(screen.getByTestId('add-frame'))
    expect(screen.getByTestId('capture-frame-count')).toHaveTextContent('3')

    // Chuyển sang Thư viện
    await user.click(screen.getByTestId('nav-library'))
    await waitFor(() => expect(screen.getByTestId('library-screen-stub')).toBeInTheDocument())
    expect(screen.queryByTestId('capture-screen')).not.toBeInTheDocument()

    // Quay lại Chụp phim — frameCount phải vẫn = 3 (không bị reset)
    await user.click(screen.getByTestId('nav-capture'))
    await waitFor(() => expect(screen.getByTestId('capture-screen')).toBeInTheDocument())
    expect(screen.getByTestId('capture-frame-count')).toHaveTextContent('3')
  })
})
