/**
 * Tests for App component — error handling path (T-W06)
 *
 * BA Scenarios: TS-04 (export error path), T-W06 AC (catch block shows Vietnamese error)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CapturedFrame, FpsLevel } from '../src/types'

// ─── Mock useExport ───────────────────────────────────────────────────────────
// We need to control whether exportVideo resolves or rejects.
const mockExportVideo = vi.fn()

vi.mock('../src/hooks/useExport', () => ({
  useExport: () => ({
    exportVideo: mockExportVideo,
    progressMessage: '',
  }),
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
    getOnionSkinFrame: (frames: CapturedFrame[]) =>
      frames.length > 0 ? frames[frames.length - 1] : null,
  }),
}))

// ─── Mock SuccessScreen + ExportProgress (not under test here) ───────────────
vi.mock('../src/components/SuccessScreen', () => ({
  default: () => <div data-testid="success-screen">SUCCESS</div>,
}))
vi.mock('../src/components/ExportProgress', () => ({
  default: ({ message }: { message: string }) => (
    <div data-testid="export-progress">{message}</div>
  ),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Inject frames into App state by directly mounting with pre-loaded frames.
 *  We can't easily set state from outside, so we simulate clicking Export
 *  after mocking captureFrame to fill frames indirectly.
 *  Instead, we expose a test helper via the CaptureScreen onExport prop
 *  by relying on the fact that App passes onExport to CaptureScreen,
 *  which the real CaptureScreen calls when user triggers export.
 *
 *  Simpler approach: we mock CaptureScreen to expose a direct export trigger.
 */

// ─── Tests ────────────────────────────────────────────────────────────────────

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

    const user = userEvent.setup()
    const triggerBtn = screen.getByTestId('trigger-export')
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

    const user = userEvent.setup()
    await user.click(screen.getByTestId('trigger-export'))

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
