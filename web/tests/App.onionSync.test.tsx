/**
 * F3 — onionSkinOpacity mặc định 0.4; TS-BS-10: opacity=0% ở Settings → toggle Onion skin ở
 * 2a tự chuyển sang tắt (đồng bộ 2 control).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../src/hooks/useExport', () => ({
  useExport: () => ({
    exportVideo: vi.fn(),
    isExporting: false,
    progress: { stage: 'mp4', percent: 0 },
  }),
  uploadExportedFile: vi.fn(),
}))

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

vi.mock('../src/hooks/useCapture', () => ({
  useCapture: () => ({
    captureFrame: vi.fn(),
    deleteLastFrame: (frames: unknown[]) => frames.slice(0, -1),
    deleteFrameAt: (frames: unknown[], index: number) =>
      [...frames.slice(0, index), ...frames.slice(index + 1)],
    getOnionSkinFrame: () => null,
  }),
}))

beforeEach(() => {
  window.localStorage?.clear?.()
  vi.resetModules()
})

async function goToCapture() {
  const user = userEvent.setup()
  const startBtn = await screen.findByRole('button', { name: /Bắt đầu làm phim/i })
  await user.click(startBtn)
}

describe('App — onion opacity 0% đồng bộ tắt toggle (TS-BS-10)', () => {
  it('F3 mặc định: onionSkinOpacity=0.4 → toggle Onion skin bật (aria-pressed=true)', async () => {
    const { default: AppDynamic } = await import('../src/App')
    render(<AppDynamic />)
    await goToCapture()

    await waitFor(() => {
      expect(screen.getByTestId('onion-toggle')).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('TS-BS-10: đổi slider Settings về 0% → quay lại Capture, toggle Onion skin tự tắt', async () => {
    const { default: AppDynamic } = await import('../src/App')
    render(<AppDynamic />)
    await goToCapture()

    const user = userEvent.setup()
    await user.click(screen.getByTestId('nav-settings'))

    const slider = await screen.findByTestId('onion-opacity-slider') as HTMLInputElement
    // <input type="range"> không "gõ" được qua userEvent.type — set value qua native setter
    // rồi bắn 'input' (React onChange lắng nghe 'input', không phải 'change', cho range/text).
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    nativeSetter?.call(slider, '0')
    slider.dispatchEvent(new Event('input', { bubbles: true }))

    await user.click(screen.getByTestId('nav-capture'))

    await waitFor(() => {
      expect(screen.getByTestId('onion-toggle')).toHaveAttribute('aria-pressed', 'false')
    })
  })
})
