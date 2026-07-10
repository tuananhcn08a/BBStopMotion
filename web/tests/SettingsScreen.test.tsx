/**
 * Tests for SettingsScreen — camera device dropdown (T-BS35, F8 điểm hở #2 architect-web-review.md).
 *
 * Trước bản vá: dropdown camera là 1 `<div>` tĩnh in chữ "Mặc định ▾", không nối enumerate
 * devices thật, không chọn/không persist được. Bản vá nối `useCameraDevices()` (KHÔNG mở stream
 * riêng) + đổi sang `<select>` thật gọi `onChange({ cameraDeviceId })` — App.tsx đã persist mọi
 * thay đổi settings qua `saveSettings()` (TS-BS-27), nên chỉ cần xác nhận SettingsScreen gọi đúng
 * callback với deviceId chọn.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsScreen from '../src/components/SettingsScreen'
import { DEFAULT_SETTINGS } from '../src/types'

function makeDevices(count: number): MediaDeviceInfo[] {
  return Array.from({ length: count }, (_, i) => ({
    deviceId: `cam-${i + 1}`,
    kind: 'videoinput',
    label: `Webcam ${i + 1}`,
    groupId: '',
    toJSON: () => ({}),
  } as MediaDeviceInfo))
}

describe('SettingsScreen — camera device dropdown (T-BS35 AC1)', () => {
  let enumerateDevicesMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    enumerateDevicesMock = vi.fn().mockResolvedValue(makeDevices(2))
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      writable: true,
      value: { enumerateDevices: enumerateDevicesMock },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('liệt kê thiết bị camera thật (không còn placeholder tĩnh "Mặc định ▾")', async () => {
    render(<SettingsScreen settings={DEFAULT_SETTINGS} onChange={vi.fn()} />)

    const select = await screen.findByTestId('camera-dropdown')
    expect(select.tagName).toBe('SELECT')

    // Option mặc định + 2 thiết bị thật
    await screen.findByText('Webcam 1')
    const options = select.querySelectorAll('option')
    expect(options).toHaveLength(3)
    expect(options[0].textContent).toBe('Mặc định')
    expect(options[1].textContent).toBe('Webcam 1')
    expect(options[2].textContent).toBe('Webcam 2')
  })

  it('chọn 1 camera → gọi onChange({ cameraDeviceId }) để App persist qua saveSettings (TS-BS-27)', async () => {
    const onChange = vi.fn()
    render(<SettingsScreen settings={DEFAULT_SETTINGS} onChange={onChange} />)

    const select = await screen.findByTestId('camera-dropdown') as HTMLSelectElement
    await screen.findByText('Webcam 2')

    await userEvent.selectOptions(select, 'cam-2')
    expect(onChange).toHaveBeenCalledWith({ cameraDeviceId: 'cam-2' })
  })

  it('settings.cameraDeviceId đã lưu trước đó → dropdown hiện đúng giá trị đang chọn', async () => {
    render(
      <SettingsScreen
        settings={{ ...DEFAULT_SETTINGS, cameraDeviceId: 'cam-2' }}
        onChange={vi.fn()}
      />,
    )
    const select = await screen.findByTestId('camera-dropdown') as HTMLSelectElement
    await screen.findByText('Webcam 2')
    expect(select.value).toBe('cam-2')
  })

  it('devices rỗng (không mock navigator.mediaDevices) → vẫn hiện option "Mặc định", không crash', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
    render(<SettingsScreen settings={DEFAULT_SETTINGS} onChange={vi.fn()} />)
    const select = await screen.findByTestId('camera-dropdown') as HTMLSelectElement
    await waitFor(() => expect(select.querySelectorAll('option')).toHaveLength(1))
    expect(select.value).toBe('')
  })
})
