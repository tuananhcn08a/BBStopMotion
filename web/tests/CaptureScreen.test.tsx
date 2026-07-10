/**
 * Tests for CaptureScreen component
 *
 * BA Scenarios: TS-01, TS-02, TS-04, TS-05, TS-06, TS-07, TS-08, TS-09, TS-11, TS-13, TS-14, TS-15
 *
 * useCamera is mocked so these tests are pure UI/logic tests (no real getUserMedia).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CaptureScreen from '../src/components/CaptureScreen'
import { CapturedFrame, FpsLevel } from '../src/types'
import type { UseCameraReturn, CameraState } from '../src/hooks/useCamera'

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeCameraMock(state: CameraState, overrides: Partial<UseCameraReturn> = {}): UseCameraReturn {
  return {
    videoRef: { current: null },
    state,
    stream: state === 'live' ? ({} as MediaStream) : null,
    devices: [],
    activeDeviceId: null,
    requestCamera: vi.fn().mockResolvedValue(undefined),
    switchCamera: vi.fn().mockResolvedValue(undefined),
    error: null,
    ...overrides,
  }
}

vi.mock('../src/hooks/useCamera', () => ({
  useCamera: vi.fn(),
}))

vi.mock('../src/hooks/useCapture', () => ({
  useCapture: () => ({
    captureFrame: vi.fn().mockReturnValue({
      id: 'test-frame-1',
      dataUrl: 'data:image/jpeg;base64,test',
      timestamp: Date.now(),
    }),
    deleteLastFrame: (frames: CapturedFrame[]) => frames.slice(0, -1),
    deleteFrameAt: (frames: CapturedFrame[], index: number) =>
      [...frames.slice(0, index), ...frames.slice(index + 1)],
    getOnionSkinFrame: (frames: CapturedFrame[]) =>
      frames.length > 0 ? frames[frames.length - 1] : null,
  }),
}))

// ─── Import after mock setup ──────────────────────────────────────────────────
import { useCamera } from '../src/hooks/useCamera'
const useCameraMock = vi.mocked(useCamera)

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  const setOnionEnabled = vi.fn()
  const { rerender } = render(
    <CaptureScreen
      frames={frames}
      setFrames={setFrames}
      fpsLevel={fpsLevel}
      setFpsLevel={setFpsLevel}
      onExport={onExport}
      language="vi+en"
      onionOpacity={0.4}
      onionEnabled={true}
      setOnionEnabled={setOnionEnabled}
    />
  )
  return { setFrames, setFpsLevel, onExport, setOnionEnabled, rerender }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CaptureScreen — camera inline states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── AC4 / TS-01: state=requesting ────────────────────────────────────────

  it('TS-01/AC4: state=requesting → shows spinner + "Đang kết nối camera...", no video, capture disabled', () => {
    useCameraMock.mockReturnValue(makeCameraMock('requesting'))
    renderCaptureScreen()

    expect(screen.getByTestId('camera-requesting')).toBeInTheDocument()
    expect(screen.getByText(/Đang kết nối camera/i)).toBeInTheDocument()
    // video element hidden (still in DOM, but hidden class applied)
    const video = screen.getByTestId('camera-video')
    expect(video).toBeInTheDocument()
    // Capture button disabled
    expect(screen.getByLabelText(/Chụp frame/i)).toBeDisabled()
    // No LIVE badge
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument()
  })

  // ─── AC4 / TS-01: state=live ──────────────────────────────────────────────

  it('TS-01/AC4: state=live → shows video + LIVE badge, capture enabled', () => {
    useCameraMock.mockReturnValue(makeCameraMock('live'))
    renderCaptureScreen()

    expect(screen.queryByTestId('camera-requesting')).not.toBeInTheDocument()
    expect(screen.queryByTestId('camera-denied')).not.toBeInTheDocument()
    expect(screen.getByTestId('camera-video')).toBeInTheDocument()
    expect(screen.getByText('LIVE')).toBeInTheDocument()
    expect(screen.getByLabelText(/Chụp frame/i)).not.toBeDisabled()
  })

  // ─── AC4 / TS-06: state=denied ────────────────────────────────────────────

  it('TS-06/AC4: state=denied → icon + error text + "Thử lại" button, capture disabled', () => {
    const errorMsg = 'Con chưa cho app dùng camera.'
    useCameraMock.mockReturnValue(
      makeCameraMock('denied', { error: errorMsg }),
    )
    renderCaptureScreen()

    expect(screen.getByTestId('camera-denied')).toBeInTheDocument()
    expect(screen.getByText(errorMsg)).toBeInTheDocument()
    expect(screen.getByTestId('retry-button')).toBeInTheDocument()
    expect(screen.getByLabelText(/Chụp frame/i)).toBeDisabled()
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument()
  })

  it('TS-15/AC4: state=denied with timeout error shows tiếng Việt camera address hint', () => {
    const errorMsg = 'Trình duyệt chưa cho phép camera. Bấm vào biểu tượng camera trên thanh địa chỉ để cấp quyền.'
    useCameraMock.mockReturnValue(
      makeCameraMock('denied', { error: errorMsg }),
    )
    renderCaptureScreen()

    expect(screen.getByText(errorMsg)).toBeInTheDocument()
  })

  it('TS-06/AC5: state=denied with devices → dropdown "Chọn camera khác" visible', () => {
    const devices: MediaDeviceInfo[] = [
      { deviceId: 'cam-1', kind: 'videoinput', label: 'Webcam HD', groupId: '', toJSON: () => ({}) },
      { deviceId: 'cam-2', kind: 'videoinput', label: 'Camera USB', groupId: '', toJSON: () => ({}) },
    ]
    useCameraMock.mockReturnValue(
      makeCameraMock('denied', { devices, error: null }),
    )
    renderCaptureScreen()

    const select = screen.getByTestId('camera-select')
    expect(select).toBeInTheDocument()
    // 2 device options + 1 disabled placeholder
    const options = select.querySelectorAll('option:not([disabled])')
    expect(options.length).toBe(2)
    expect(options[0].textContent).toBe('Webcam HD')
    expect(options[1].textContent).toBe('Camera USB')
  })

  it('AC5: devices with empty labels → shows "Camera N" fallback', () => {
    const devices: MediaDeviceInfo[] = [
      { deviceId: 'cam-1', kind: 'videoinput', label: '', groupId: '', toJSON: () => ({}) },
      { deviceId: 'cam-2', kind: 'videoinput', label: '', groupId: '', toJSON: () => ({}) },
    ]
    useCameraMock.mockReturnValue(
      makeCameraMock('denied', { devices, error: null }),
    )
    renderCaptureScreen()

    const select = screen.getByTestId('camera-select')
    const options = select.querySelectorAll('option:not([disabled])')
    expect(options[0].textContent).toBe('Camera 1')
    expect(options[1].textContent).toBe('Camera 2')
  })

  // ─── AC4 / TS-15: state=no-device ────────────────────────────────────────

  it('TS-15/AC4: state=no-device → "Không tìm thấy camera" + "Thử lại", capture disabled', () => {
    useCameraMock.mockReturnValue(makeCameraMock('no-device'))
    renderCaptureScreen()

    expect(screen.getByTestId('camera-no-device')).toBeInTheDocument()
    expect(screen.getByText(/Không tìm thấy camera/i)).toBeInTheDocument()
    expect(screen.getByTestId('retry-button')).toBeInTheDocument()
    expect(screen.getByLabelText(/Chụp frame/i)).toBeDisabled()
  })

  // ─── Retry button calls requestCamera ────────────────────────────────────

  it('TS-06: clicking "Thử lại" calls requestCamera()', async () => {
    const requestCamera = vi.fn().mockResolvedValue(undefined)
    useCameraMock.mockReturnValue(
      makeCameraMock('denied', { requestCamera, error: null }),
    )
    renderCaptureScreen()

    await userEvent.click(screen.getByTestId('retry-button'))
    expect(requestCamera).toHaveBeenCalled()
  })

  // ─── TS-02: Capture button click → setFrames called (when live) ──────────

  it('TS-02: clicking CHỤP when live calls setFrames', async () => {
    useCameraMock.mockReturnValue(makeCameraMock('live'))
    const { setFrames } = renderCaptureScreen()
    const captureBtn = screen.getByLabelText(/Chụp frame/i)
    await userEvent.click(captureBtn)
    expect(setFrames).toHaveBeenCalled()
  })

  it('TS-02: Space key captures frame when live', async () => {
    useCameraMock.mockReturnValue(makeCameraMock('live'))
    const { setFrames } = renderCaptureScreen()
    fireEvent.keyDown(window, { code: 'Space' })
    expect(setFrames).toHaveBeenCalled()
  })

  // ─── TS-05: Export with < 5 frames ───────────────────────────────────────

  it('TS-05: export with 3 frames shows min-frames error, does not navigate', async () => {
    useCameraMock.mockReturnValue(makeCameraMock('live'))
    const frames = makeFrames(3)
    const onExport = vi.fn()
    renderCaptureScreen(frames, 'normal', onExport)
    fireEvent.keyDown(window, { code: 'Enter' })
    await waitFor(() => {
      expect(screen.getByTestId('export-error')).toHaveTextContent('5 frame')
    })
    expect(onExport).not.toHaveBeenCalled()
  })

  it('TS-05: export with 0 frames shows error, onExport not called', async () => {
    useCameraMock.mockReturnValue(makeCameraMock('live'))
    const onExport = vi.fn()
    renderCaptureScreen([], 'normal', onExport)
    const exportBtn = screen.getByLabelText(/Xuất phim/i)
    await userEvent.click(exportBtn)
    await waitFor(() => {
      expect(screen.getByTestId('export-error')).toBeInTheDocument()
    })
    expect(onExport).not.toHaveBeenCalled()
  })

  // ─── TS-07: Delete key removes last frame ─────────────────────────────────

  it('TS-07: Delete key calls setFrames to remove last frame', () => {
    useCameraMock.mockReturnValue(makeCameraMock('live'))
    const frames = makeFrames(3)
    const { setFrames } = renderCaptureScreen(frames)
    fireEvent.keyDown(window, { code: 'Delete' })
    expect(setFrames).toHaveBeenCalled()
  })

  // ─── TS-08: Buttons disabled when 0 frames ────────────────────────────────

  it('TS-08: delete and preview buttons are disabled when 0 frames', () => {
    useCameraMock.mockReturnValue(makeCameraMock('live'))
    renderCaptureScreen([])
    const deleteBtn = screen.getByLabelText(/Xoá frame cuối/i)
    const previewBtn = screen.getByLabelText(/Xem lại phim/i)
    expect(deleteBtn).toBeDisabled()
    expect(previewBtn).toBeDisabled()
  })

  it('TS-08: shows "Bấm Space" hint when 0 frames and camera is live', () => {
    useCameraMock.mockReturnValue(makeCameraMock('live'))
    renderCaptureScreen([])
    expect(screen.getByText(/Bấm Space để chụp frame đầu tiên/i)).toBeInTheDocument()
  })

  // ─── TS-09: FPS change ────────────────────────────────────────────────────

  it('TS-09: changing fps selector calls setFpsLevel', async () => {
    useCameraMock.mockReturnValue(makeCameraMock('live'))
    const frames = makeFrames(12)
    const { setFpsLevel } = renderCaptureScreen(frames, 'normal')
    const slowBtn = screen.getByLabelText(/Chậm/i)
    await userEvent.click(slowBtn)
    expect(setFpsLevel).toHaveBeenCalledWith('slow')
  })

  it('TS-09: key 1 sets fps to slow', () => {
    useCameraMock.mockReturnValue(makeCameraMock('live'))
    const { setFpsLevel } = renderCaptureScreen()
    fireEvent.keyDown(window, { code: 'Digit1', key: '1' })
    expect(setFpsLevel).toHaveBeenCalledWith('slow')
  })

  it('TS-09: key 2 sets fps to normal', () => {
    useCameraMock.mockReturnValue(makeCameraMock('live'))
    const { setFpsLevel } = renderCaptureScreen()
    fireEvent.keyDown(window, { code: 'Digit2', key: '2' })
    expect(setFpsLevel).toHaveBeenCalledWith('normal')
  })

  it('TS-09: key 3 sets fps to fast', () => {
    useCameraMock.mockReturnValue(makeCameraMock('live'))
    const { setFpsLevel } = renderCaptureScreen()
    fireEvent.keyDown(window, { code: 'Digit3', key: '3' })
    expect(setFpsLevel).toHaveBeenCalledWith('fast')
  })

  // ─── TS-11: Preview mode ──────────────────────────────────────────────────

  it('TS-11: P key enables preview mode when >= 2 frames, shows XEMPHIM badge', async () => {
    useCameraMock.mockReturnValue(makeCameraMock('live'))
    const frames = makeFrames(3)
    renderCaptureScreen(frames)
    fireEvent.keyDown(window, { code: 'KeyP' })
    await waitFor(() => {
      expect(screen.getByText('XEMPHIM')).toBeInTheDocument()
    })
  })

  it('TS-11: Esc exits preview mode, shows LIVE badge', async () => {
    useCameraMock.mockReturnValue(makeCameraMock('live'))
    const frames = makeFrames(3)
    renderCaptureScreen(frames)
    fireEvent.keyDown(window, { code: 'KeyP' })
    await waitFor(() => expect(screen.getByText('XEMPHIM')).toBeInTheDocument())
    fireEvent.keyDown(window, { code: 'Escape' })
    await waitFor(() => expect(screen.getByText('LIVE')).toBeInTheDocument())
  })

  // ─── TS-04: Export called when >= 5 frames ────────────────────────────────

  it('TS-04: onExport called with frames and fps when >= 5 frames', async () => {
    useCameraMock.mockReturnValue(makeCameraMock('live'))
    const frames = makeFrames(5)
    const onExport = vi.fn()
    renderCaptureScreen(frames, 'normal', onExport)
    const exportBtn = screen.getByLabelText(/Xuất phim/i)
    await userEvent.click(exportBtn)
    expect(onExport).toHaveBeenCalledWith(frames, 'normal')
  })

  // ─── TS-14: Keyboard accessibility ───────────────────────────────────────

  it('TS-14: CHỤP button is accessible via keyboard (has aria-label)', () => {
    useCameraMock.mockReturnValue(makeCameraMock('live'))
    renderCaptureScreen()
    const captureBtn = screen.getByLabelText(/Chụp frame/i)
    expect(captureBtn).toBeInTheDocument()
    captureBtn.focus()
    expect(captureBtn).toHaveFocus()
  })

  // ─── TS-13: 0 frames filmstrip ────────────────────────────────────────────

  it('TS-13: Filmstrip shows 0 frames initially (empty slot #1, no thumbs)', () => {
    useCameraMock.mockReturnValue(makeCameraMock('live'))
    renderCaptureScreen([])
    const filmstrip = screen.getByTestId('filmstrip')
    expect(filmstrip.querySelectorAll('[data-testid^="thumb-"]')).toHaveLength(0)
    expect(screen.getByLabelText('Slot frame tiếp theo')).toHaveTextContent('1')
  })
})
