/**
 * Tests for useCameraDevices hook (T-BS35 — Settings camera dropdown → device list thật).
 *
 * BA follow-up F8 (điểm hở #2, architect-web-review.md): SettingsScreen phải enumerate thiết bị
 * camera thật thay vì placeholder tĩnh "Mặc định ▾". Hook này KHÔNG gọi getUserMedia (không mở
 * stream riêng) — chỉ liệt kê + theo dõi `devicechange`.
 *
 * jsdom không implement navigator.mediaDevices mặc định — mock thủ công như useCamera.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useCameraDevices, listVideoInputDevices } from '../src/hooks/useCameraDevices'

function makeDevices(count: number): MediaDeviceInfo[] {
  return Array.from({ length: count }, (_, i) => ({
    deviceId: `cam-${i + 1}`,
    kind: 'videoinput',
    label: `Camera ${i + 1}`,
    groupId: '',
    toJSON: () => ({}),
  } as MediaDeviceInfo))
}

describe('listVideoInputDevices', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('trả về [] khi navigator.mediaDevices không tồn tại (không throw)', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: undefined,
    })
    await expect(listVideoInputDevices()).resolves.toEqual([])
  })

  it('lọc chỉ videoinput, bỏ audioinput/audiooutput', async () => {
    const enumerateDevicesMock = vi.fn().mockResolvedValue([
      { deviceId: 'a1', kind: 'audioinput', label: '', groupId: '', toJSON: () => ({}) },
      ...makeDevices(2),
      { deviceId: 'o1', kind: 'audiooutput', label: '', groupId: '', toJSON: () => ({}) },
    ])
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { enumerateDevices: enumerateDevicesMock },
    })
    const result = await listVideoInputDevices()
    expect(result).toHaveLength(2)
    expect(result.every(d => d.kind === 'videoinput')).toBe(true)
  })
})

describe('useCameraDevices hook', () => {
  let enumerateDevicesMock: ReturnType<typeof vi.fn>
  let addEventListenerMock: ReturnType<typeof vi.fn>
  let removeEventListenerMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    enumerateDevicesMock = vi.fn().mockResolvedValue(makeDevices(2))
    addEventListenerMock = vi.fn()
    removeEventListenerMock = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      writable: true,
      value: {
        enumerateDevices: enumerateDevicesMock,
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mount → enumerate thiết bị thật, devices populated', async () => {
    const { result } = renderHook(() => useCameraDevices())
    expect(result.current.devices).toEqual([])
    await waitFor(() => {
      expect(result.current.devices).toHaveLength(2)
    })
    expect(result.current.devices[0].label).toBe('Camera 1')
  })

  it('đăng ký lắng nghe devicechange lúc mount, gỡ lúc unmount', () => {
    const { unmount } = renderHook(() => useCameraDevices())
    expect(addEventListenerMock).toHaveBeenCalledWith('devicechange', expect.any(Function))
    unmount()
    expect(removeEventListenerMock).toHaveBeenCalledWith('devicechange', expect.any(Function))
  })

  it('refresh() gọi lại enumerateDevices, cập nhật devices mới', async () => {
    const { result } = renderHook(() => useCameraDevices())
    await waitFor(() => expect(result.current.devices).toHaveLength(2))

    enumerateDevicesMock.mockResolvedValue(makeDevices(3))
    await act(async () => {
      await result.current.refresh()
    })
    await waitFor(() => expect(result.current.devices).toHaveLength(3))
  })
})
