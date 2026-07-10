/**
 * Tests for App component — error handling path (T-W06) + Welcome gate (F6)
 *
 * BA Scenarios: TS-04 (export error path), T-W06 AC (catch block shows Vietnamese error),
 * TS-BS-17 (Welcome hiện đầu phiên → bấm Bắt đầu vào Capture)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CapturedFrame, FpsLevel, LibraryEntry } from '../src/types'

// ─── Mock useExport ───────────────────────────────────────────────────────────
// We need to control whether exportVideo resolves or rejects.
const mockExportVideo = vi.fn()

vi.mock('../src/hooks/useExport', () => ({
  useExport: () => ({
    exportVideo: mockExportVideo,
    isExporting: false,
    progress: { stage: 'mp4', percent: 0 },
  }),
  uploadExportedFile: vi.fn(),
}))

// ─── Mock useCamera so CaptureScreen renders without real getUserMedia ────────
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

// ─── Mock useCapture ──────────────────────────────────────────────────────────
vi.mock('../src/hooks/useCapture', () => ({
  useCapture: () => ({
    captureFrame: vi.fn().mockReturnValue({
      id: 'f1',
      dataUrl: 'data:image/jpeg;base64,test',
      timestamp: 0,
    }),
    deleteLastFrame: (frames: CapturedFrame[]) => frames.slice(0, -1),
    deleteFrameAt: (frames: CapturedFrame[], index: number) =>
      [...frames.slice(0, index), ...frames.slice(index + 1)],
    getOnionSkinFrame: (frames: CapturedFrame[]) =>
      frames.length > 0 ? frames[frames.length - 1] : null,
  }),
}))

// ─── Mock SuccessScreen + ExportProgress (not under test here) ───────────────
vi.mock('../src/components/SuccessScreen', () => ({
  default: () => <div data-testid="success-screen">SUCCESS</div>,
}))
vi.mock('../src/components/ExportProgress', () => ({
  default: () => <div data-testid="export-progress">EXPORTING</div>,
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Bấm qua màn Welcome (F6 — luôn hiện đầu phiên, welcomeSeen không persist) để vào Capture. */
async function dismissWelcome() {
  const user = userEvent.setup()
  const startBtn = await screen.findByRole('button', { name: /Bắt đầu làm phim/i })
  await user.click(startBtn)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// Module graph phải reset trước MỖI test — dynamic import('../src/App') sau vi.doMock() chỉ
// tôn trọng mock mới nếu cache module đã được xoá; nếu không, 1 test import App "thật" (không
// doMock) sẽ làm các test sau vẫn thấy CaptureScreen thật đã cache thay vì bản doMock.
beforeEach(() => {
  vi.resetModules()
})

describe('App — Welcome gate (F6/TS-BS-17)', () => {
  it('TS-BS-17: shows Welcome first; clicking Bắt đầu navigates to Capture (screen=capture)', async () => {
    const { default: AppDynamic } = await import('../src/App')
    render(<AppDynamic />)

    expect(screen.getByRole('button', { name: /Bắt đầu làm phim/i })).toBeTruthy()
    await dismissWelcome()

    await waitFor(() => {
      expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    })
  })
})

describe('App — handleExport error path (T-W06)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('T-W06/AC: when exportVideo rejects, shows Vietnamese error message + Thử lại button', async () => {
    // Arrange: exportVideo will reject
    mockExportVideo.mockRejectedValue(new Error('ffmpeg worker load failed'))

    // We need to trigger the export path. The easiest way without re-implementing
    // App internals is to mock CaptureScreen to call onExport directly on mount.
    vi.doMock('../src/components/CaptureScreen', () => ({
      default: ({ onExport }: {
        onExport: (f: CapturedFrame[], fps: FpsLevel) => void
      }) => (
        <div data-testid="capture-screen">
          <button
            data-testid="trigger-export"
            onClick={() => onExport(
              Array.from({ length: 5 }, (_, i) => ({
                id: `f${i}`,
                dataUrl: 'data:image/jpeg;base64,test',
                timestamp: i,
              })),
              'normal'
            )}
          >
            Export
          </button>
        </div>
      ),
    }))

    // Dynamic import after doMock
    const { default: AppDynamic } = await import('../src/App')

    const { unmount } = render(<AppDynamic />)
    await dismissWelcome()

    const user = userEvent.setup()
    const triggerBtn = await screen.findByTestId('trigger-export')
    await user.click(triggerBtn)

    // Assert: error message in Vietnamese appears
    await waitFor(() => {
      expect(screen.getByTestId('app-export-error')).toBeInTheDocument()
    })
    expect(screen.getByTestId('app-export-error')).toHaveTextContent('Ôi, ghép phim bị lỗi rồi')
    expect(screen.getByTestId('app-export-error')).toHaveTextContent('Con thử lại nhé')

    // Assert: Thử lại button present
    expect(screen.getByTestId('app-retry-export')).toBeInTheDocument()

    // Assert: clicking Thử lại clears the error
    await user.click(screen.getByTestId('app-retry-export'))
    await waitFor(() => {
      expect(screen.queryByTestId('app-export-error')).not.toBeInTheDocument()
    })

    unmount()
    vi.resetModules()
  })

  it('T-W06/AC: when exportVideo resolves, no error message shown', async () => {
    mockExportVideo.mockResolvedValue({
      blob: new Blob(['fake'], { type: 'video/mp4' }),
      filename: 'phim-cua-con-test.mp4',
    })

    vi.doMock('../src/components/CaptureScreen', () => ({
      default: ({ onExport }: {
        onExport: (f: CapturedFrame[], fps: FpsLevel) => void
      }) => (
        <div data-testid="capture-screen">
          <button
            data-testid="trigger-export"
            onClick={() => onExport(
              Array.from({ length: 5 }, (_, i) => ({
                id: `f${i}`,
                dataUrl: 'data:image/jpeg;base64,test',
                timestamp: i,
              })),
              'normal'
            )}
          >
            Export
          </button>
        </div>
      ),
    }))

    const { default: AppDynamic } = await import('../src/App')
    const { unmount } = render(<AppDynamic />)
    await dismissWelcome()

    const user = userEvent.setup()
    await user.click(await screen.findByTestId('trigger-export'))

    // No error overlay
    await waitFor(() => {
      expect(screen.queryByTestId('app-export-error')).not.toBeInTheDocument()
    })

    // Success screen shown
    await waitFor(() => {
      expect(screen.getByTestId('success-screen')).toBeInTheDocument()
    })

    unmount()
    vi.resetModules()
  })
})

// ─── T-BS35 (xác nhận) — handleLibraryUpload reload-blob message (đã thêm round-4, architect
// review "Library reload mất blob điểm hở #1") — Library metadata sống trong IndexedDB (Q6a) mà
// KHÔNG lưu MP4/GIF gốc; nếu tab đóng/reload rồi bấm "Tải lên" 1 phim cũ, blob không còn trong
// bộ nhớ (blobCacheRef chỉ tồn tại trong phiên App hiện tại) → phải báo bé bằng thông báo tiếng
// Việt thay vì im lặng. Trước round-4 đây là no-op (bug, xem architect-web-review.md).
describe('App — handleLibraryUpload blob-expired notice (T-BS35 xác nhận round-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('bấm Tải lên 1 phim không còn blob trong bộ nhớ (mô phỏng reload) → hiện thông báo tiếng Việt, bấm Đóng thì tắt', async () => {
    const goneEntry: LibraryEntry = {
      id: 'gone-1',
      title: 'Phim của con · 1/1/2026',
      thumbnailDataUrl: '',
      frameCount: 12,
      durationSeconds: 2,
      createdAt: Date.now(),
    }

    vi.doMock('../src/components/LibraryScreen', () => ({
      default: ({ onUpload }: { onUpload: (entry: LibraryEntry) => void }) => (
        <div data-testid="library-screen">
          <button data-testid="trigger-library-upload" onClick={() => onUpload(goneEntry)}>
            Tải lên
          </button>
        </div>
      ),
    }))

    const { default: AppDynamic } = await import('../src/App')
    const { unmount } = render(<AppDynamic />)
    await dismissWelcome()

    const user = userEvent.setup()
    await user.click(await screen.findByTestId('nav-library'))
    await user.click(await screen.findByTestId('trigger-library-upload'))

    await waitFor(() => {
      expect(screen.getByTestId('app-library-notice')).toBeInTheDocument()
    })
    expect(screen.getByTestId('app-library-notice')).toHaveTextContent(
      'File phim này đã hết trên máy',
    )

    await user.click(screen.getByTestId('app-library-notice-dismiss'))
    await waitFor(() => {
      expect(screen.queryByTestId('app-library-notice')).not.toBeInTheDocument()
    })

    unmount()
    vi.resetModules()
  })
})
