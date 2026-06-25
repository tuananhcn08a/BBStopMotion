import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CaptureScreen from '../src/components/CaptureScreen'
import { CapturedFrame, FpsLevel } from '../src/types'

// Mock useCamera to avoid real getUserMedia
vi.mock('../src/hooks/useCamera', () => ({
  useCamera: () => ({
    videoRef: { current: null },
    status: 'active',
    requestCamera: vi.fn().mockResolvedValue(undefined),
    stream: null,
  }),
}))

// Mock useCapture
vi.mock('../src/hooks/useCapture', () => ({
  useCapture: () => ({
    captureFrame: vi.fn().mockReturnValue({
      id: 'test-frame-1',
      dataUrl: 'data:image/jpeg;base64,test',
      timestamp: Date.now(),
    }),
    deleteLastFrame: (frames: CapturedFrame[]) => frames.slice(0, -1),
    getOnionSkinFrame: (frames: CapturedFrame[]) => frames.length > 0 ? frames[frames.length - 1] : null,
  }),
}))

function makeFrames(count: number): CapturedFrame[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `frame-${i}`,
    dataUrl: `data:image/jpeg;base64,test${i}`,
    timestamp: i,
  }))
}

function renderCaptureScreen(
  frames: CapturedFrame[] = [],
  fpsLevel: FpsLevel = 'normal',
  onExport = vi.fn(),
) {
  const setFrames = vi.fn()
  const setFpsLevel = vi.fn()
  const { rerender } = render(
    <CaptureScreen
      frames={frames}
      setFrames={setFrames}
      fpsLevel={fpsLevel}
      setFpsLevel={setFpsLevel}
      onExport={onExport}
    />
  )
  return { setFrames, setFpsLevel, onExport, rerender }
}

describe('CaptureScreen', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // TS-01: Camera granted → capture screen shows
  it('TS-01: renders live preview area and CHỤP button', () => {
    renderCaptureScreen()
    expect(screen.getByLabelText(/Chụp frame/i)).toBeInTheDocument()
    expect(screen.getByText('LIVE')).toBeInTheDocument()
  })

  // TS-02: Capture button click → setFrames called
  it('TS-02: clicking CHỤP button calls setFrames', async () => {
    const { setFrames } = renderCaptureScreen()
    const captureBtn = screen.getByLabelText(/Chụp frame/i)
    await userEvent.click(captureBtn)
    expect(setFrames).toHaveBeenCalled()
  })

  // TS-02: Space key captures frame
  it('TS-02: Space key calls setFrames', async () => {
    const { setFrames } = renderCaptureScreen()
    fireEvent.keyDown(window, { code: 'Space' })
    expect(setFrames).toHaveBeenCalled()
  })

  // TS-05: Export with < 5 frames shows error message
  it('TS-05: export with 3 frames shows min-frames error, does not navigate', async () => {
    const frames = makeFrames(3)
    const onExport = vi.fn()
    renderCaptureScreen(frames, 'normal', onExport)
    fireEvent.keyDown(window, { code: 'Enter' })
    await waitFor(() => {
      expect(screen.getByTestId('export-error')).toHaveTextContent('5 frame')
    })
    expect(onExport).not.toHaveBeenCalled()
  })

  // TS-05: Export button with 0 frames
  it('TS-05: export with 0 frames shows error, onExport not called', async () => {
    const onExport = vi.fn()
    renderCaptureScreen([], 'normal', onExport)
    const exportBtn = screen.getByLabelText(/Xuất phim/i)
    await userEvent.click(exportBtn)
    await waitFor(() => {
      expect(screen.getByTestId('export-error')).toBeInTheDocument()
    })
    expect(onExport).not.toHaveBeenCalled()
  })

  // TS-07: Delete key removes last frame
  it('TS-07: Delete key calls setFrames to remove last frame', () => {
    const frames = makeFrames(3)
    const { setFrames } = renderCaptureScreen(frames)
    fireEvent.keyDown(window, { code: 'Delete' })
    expect(setFrames).toHaveBeenCalled()
  })

  // TS-08: Delete/Preview buttons disabled when 0 frames
  it('TS-08: delete and preview buttons are disabled when 0 frames', () => {
    renderCaptureScreen([])
    const deleteBtn = screen.getByLabelText(/Xoá frame cuối/i)
    const previewBtn = screen.getByLabelText(/Xem lại phim/i)
    expect(deleteBtn).toBeDisabled()
    expect(previewBtn).toBeDisabled()
  })

  // TS-08: 0 frames shows hint
  it('TS-08: shows "Bấm Space" hint when 0 frames', () => {
    renderCaptureScreen([])
    expect(screen.getByText(/Bấm Space để chụp frame đầu tiên/i)).toBeInTheDocument()
  })

  // TS-09: FPS change affects duration display
  it('TS-09: changing fps selector calls setFpsLevel', async () => {
    const frames = makeFrames(12)
    const { setFpsLevel } = renderCaptureScreen(frames, 'normal')
    const slowBtn = screen.getByLabelText(/Chậm/i)
    await userEvent.click(slowBtn)
    expect(setFpsLevel).toHaveBeenCalledWith('slow')
  })

  // TS-09: FPS key shortcuts
  it('TS-09: key 1 sets fps to slow', () => {
    const { setFpsLevel } = renderCaptureScreen()
    fireEvent.keyDown(window, { code: 'Digit1', key: '1' })
    expect(setFpsLevel).toHaveBeenCalledWith('slow')
  })

  it('TS-09: key 2 sets fps to normal', () => {
    const { setFpsLevel } = renderCaptureScreen()
    fireEvent.keyDown(window, { code: 'Digit2', key: '2' })
    expect(setFpsLevel).toHaveBeenCalledWith('normal')
  })

  it('TS-09: key 3 sets fps to fast', () => {
    const { setFpsLevel } = renderCaptureScreen()
    fireEvent.keyDown(window, { code: 'Digit3', key: '3' })
    expect(setFpsLevel).toHaveBeenCalledWith('fast')
  })

  // TS-11: Preview mode toggle
  it('TS-11: P key enables preview mode when >= 2 frames, shows XEMPHIM badge', async () => {
    const frames = makeFrames(3)
    renderCaptureScreen(frames)
    fireEvent.keyDown(window, { code: 'KeyP' })
    await waitFor(() => {
      expect(screen.getByText('XEMPHIM')).toBeInTheDocument()
    })
  })

  // TS-11: Esc exits preview mode
  it('TS-11: Esc exits preview mode, shows LIVE badge', async () => {
    const frames = makeFrames(3)
    renderCaptureScreen(frames)
    fireEvent.keyDown(window, { code: 'KeyP' })
    await waitFor(() => expect(screen.getByText('XEMPHIM')).toBeInTheDocument())
    fireEvent.keyDown(window, { code: 'Escape' })
    await waitFor(() => expect(screen.getByText('LIVE')).toBeInTheDocument())
  })

  // TS-04: Export called when >= 5 frames
  it('TS-04: onExport called with frames and fps when >= 5 frames', async () => {
    const frames = makeFrames(5)
    const onExport = vi.fn()
    renderCaptureScreen(frames, 'normal', onExport)
    const exportBtn = screen.getByLabelText(/Xuất phim/i)
    await userEvent.click(exportBtn)
    expect(onExport).toHaveBeenCalledWith(frames, 'normal')
  })

  // TS-14: Keyboard navigation — focus ring via focus-visible CSS (structural test)
  it('TS-14: CHỤP button is accessible via keyboard (has aria-label)', () => {
    renderCaptureScreen()
    const captureBtn = screen.getByLabelText(/Chụp frame/i)
    expect(captureBtn).toBeInTheDocument()
    captureBtn.focus()
    expect(captureBtn).toHaveFocus()
  })

  // TS-13: New film reset (tested via App state)
  it('TS-13: Filmstrip shows 0 frames initially', () => {
    renderCaptureScreen([])
    expect(screen.getByText('0 frame')).toBeInTheDocument()
  })
})
