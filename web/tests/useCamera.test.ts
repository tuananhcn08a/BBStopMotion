/**
 * Tests for useCamera hook — state machine
 *
 * BA Scenarios: TS-01, TS-06, TS-15, TS-16
 *
 * jsdom does not implement navigator.mediaDevices, so we mock it entirely.
 * Fake timers are used to test the 5-second timeout.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCamera } from '../src/hooks/useCamera'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMediaStream(deviceId = 'cam-1'): MediaStream {
  const track = {
    getSettings: () => ({ deviceId }),
    addEventListener: vi.fn(),
    stop: vi.fn(),
    kind: 'video',
  } as unknown as MediaStreamTrack
  return {
    getVideoTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream
}

function makeEnumerateResult(count = 1): MediaDeviceInfo[] {
  return Array.from({ length: count }, (_, i) => ({
    deviceId: `cam-${i + 1}`,
    kind: 'videoinput',
    label: `Camera ${i + 1}`,
    groupId: '',
    toJSON: () => ({}),
  } as MediaDeviceInfo))
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('useCamera state machine', () => {
  let getUserMediaMock: ReturnType<typeof vi.fn>
  let enumerateDevicesMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    getUserMediaMock = vi.fn()
    enumerateDevicesMock = vi.fn().mockResolvedValue(makeEnumerateResult(1))

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      writable: true,
      value: {
        getUserMedia: getUserMediaMock,
        enumerateDevices: enumerateDevicesMock,
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  // TS-01: Happy path — mount → requesting → live
  it('TS-01: mount → state=requesting then live when getUserMedia resolves', async () => {
    const stream = makeMediaStream()
    getUserMediaMock.mockResolvedValueOnce(stream)

    const { result } = renderHook(() => useCamera())

    // Initial state: requesting (set on mount before getUserMedia resolves)
    expect(result.current.state).toBe('requesting')

    // After getUserMedia resolves → live
    await waitFor(() => {
      expect(result.current.state).toBe('live')
    })
    expect(result.current.stream).toBe(stream)
    expect(result.current.error).toBeNull()
  })

  // TS-06: User denies camera → state=denied
  it('TS-06: getUserMedia rejects NotAllowedError → state=denied', async () => {
    const err = new DOMException('User denied', 'NotAllowedError')
    getUserMediaMock.mockRejectedValueOnce(err)

    const { result } = renderHook(() => useCamera())

    await waitFor(() => {
      expect(result.current.state).toBe('denied')
    })
    expect(result.current.stream).toBeNull()
    expect(result.current.error).toBeTruthy()
  })

  it('TS-06: getUserMedia rejects SecurityError → state=denied', async () => {
    const err = new DOMException('Insecure context', 'SecurityError')
    getUserMediaMock.mockRejectedValueOnce(err)

    const { result } = renderHook(() => useCamera())

    await waitFor(() => {
      expect(result.current.state).toBe('denied')
    })
  })

  // TS-15: No device found → state=no-device
  it('TS-15: getUserMedia rejects NotFoundError → state=no-device', async () => {
    const err = new DOMException('No camera', 'NotFoundError')
    getUserMediaMock.mockRejectedValueOnce(err)

    const { result } = renderHook(() => useCamera())

    await waitFor(() => {
      expect(result.current.state).toBe('no-device')
    })
    expect(result.current.error).toBeTruthy()
  })

  it('TS-15: getUserMedia rejects OverconstrainedError → state=no-device', async () => {
    const err = new DOMException('Overconstrained', 'OverconstrainedError')
    getUserMediaMock.mockRejectedValueOnce(err)

    const { result } = renderHook(() => useCamera())

    await waitFor(() => {
      expect(result.current.state).toBe('no-device')
    })
  })

  // TS-15: Timeout 5s → state=denied with Vietnamese error message
  it('TS-15: getUserMedia timeout 5s → state=denied + tiếng Việt error', async () => {
    vi.useFakeTimers()

    // getUserMedia never resolves during test
    getUserMediaMock.mockImplementation(
      () => new Promise(() => { /* never resolves */ }),
    )
    enumerateDevicesMock.mockResolvedValue(makeEnumerateResult(0))

    const { result } = renderHook(() => useCamera())

    // Initially requesting
    expect(result.current.state).toBe('requesting')

    // Advance past 5s timeout and let microtasks flush
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5001)
    })

    expect(result.current.state).toBe('denied')
    expect(result.current.error).toContain('camera trên thanh địa chỉ')
  }, 10000)

  // TS-16: switchCamera — new deviceId → state cycles requesting→live
  it('TS-16: switchCamera(newId) → requesting then live with new deviceId', async () => {
    const stream1 = makeMediaStream('cam-1')
    const stream2 = makeMediaStream('cam-2')
    getUserMediaMock
      .mockResolvedValueOnce(stream1)
      .mockResolvedValueOnce(stream2)

    const { result } = renderHook(() => useCamera())

    await waitFor(() => expect(result.current.state).toBe('live'))
    expect(result.current.activeDeviceId).toBe('cam-1')

    await act(async () => {
      await result.current.switchCamera('cam-2')
    })

    await waitFor(() => expect(result.current.state).toBe('live'))
    expect(result.current.activeDeviceId).toBe('cam-2')
    expect(result.current.stream).toBe(stream2)
  })

  // TS-16: enumerateDevices — devices list populated
  it('TS-16: enumerateDevices populates devices list', async () => {
    const stream = makeMediaStream()
    getUserMediaMock.mockResolvedValueOnce(stream)
    enumerateDevicesMock.mockResolvedValue(makeEnumerateResult(2))

    const { result } = renderHook(() => useCamera())

    await waitFor(() => {
      expect(result.current.state).toBe('live')
    })

    // After live, devices should be populated
    await waitFor(() => {
      expect(result.current.devices.length).toBe(2)
    })
    expect(result.current.devices[0].kind).toBe('videoinput')
  })

  // requestCamera() retry — called after denied → cycles back
  it('requestCamera() retry after denied → requesting then live', async () => {
    const err = new DOMException('User denied', 'NotAllowedError')
    const stream = makeMediaStream()
    getUserMediaMock
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce(stream)

    const { result } = renderHook(() => useCamera())

    await waitFor(() => expect(result.current.state).toBe('denied'))

    await act(async () => {
      await result.current.requestCamera()
    })

    await waitFor(() => expect(result.current.state).toBe('live'))
    expect(result.current.stream).toBe(stream)
  })

  // T-BS35 — SettingsScreen (F8) persist cameraDeviceId; useCamera phải xin đúng camera đã chọn
  // ngay lúc mount (CaptureScreen unmount/remount mỗi lần chuyển màn nên "áp lúc mount" là đủ).
  it('T-BS35: useCamera(preferredDeviceId) → mount xin đúng deviceId đã lưu ở Settings', async () => {
    const stream = makeMediaStream('cam-2')
    getUserMediaMock.mockResolvedValueOnce(stream)

    const { result } = renderHook(() => useCamera('cam-2'))

    await waitFor(() => expect(result.current.state).toBe('live'))
    expect(getUserMediaMock).toHaveBeenCalledWith(
      expect.objectContaining({ video: { deviceId: { exact: 'cam-2' } } }),
    )
    expect(result.current.activeDeviceId).toBe('cam-2')
  })

  it('T-BS35: useCamera(null) hoặc không truyền → mount dùng camera mặc định (không exact deviceId)', async () => {
    const stream = makeMediaStream('cam-1')
    getUserMediaMock.mockResolvedValueOnce(stream)

    const { result } = renderHook(() => useCamera(null))

    await waitFor(() => expect(result.current.state).toBe('live'))
    expect(getUserMediaMock).toHaveBeenCalledWith(
      expect.objectContaining({ video: true }),
    )
  })
})
