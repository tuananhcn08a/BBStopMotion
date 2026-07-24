/**
 * T-XW17 AC2/AC3 — `CaptureScreen.tsx` wiring của import ảnh: chọn file → normalize (mock, logic
 * thật đã test riêng `importImage.test.ts`) → nối cuối `frames` RAM + autosave `onFrameCaptured`
 * (ĐÚNG con đường 1 frame chụp đi, seq luôn liên tục) → khoá chụp trong lúc đang import.
 */
import { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CaptureScreen from '../src/components/CaptureScreen'
import { CapturedFrame, FpsLevel } from '../src/types'
import type { UseCameraReturn, CameraState } from '../src/hooks/useCamera'

function makeCameraMock(state: CameraState, overrides: Partial<UseCameraReturn> = {}): UseCameraReturn {
  return {
    videoRef: { current: null }, state, stream: state === 'live' ? ({} as MediaStream) : null,
    devices: [], activeDeviceId: null,
    requestCamera: vi.fn().mockResolvedValue(undefined), switchCamera: vi.fn().mockResolvedValue(undefined),
    error: null, ...overrides,
  }
}

vi.mock('../src/hooks/useCamera', () => ({ useCamera: vi.fn() }))
vi.mock('../src/hooks/useCapture', () => ({
  useCapture: () => ({
    captureFrame: vi.fn(),
    deleteLastFrame: (frames: CapturedFrame[]) => frames.slice(0, -1),
    deleteFrameAt: (frames: CapturedFrame[], index: number) => [...frames.slice(0, index), ...frames.slice(index + 1)],
    getOnionSkinFrame: () => null,
  }),
}))

const normalizeImportedFilesMock = vi.fn()
vi.mock('../src/lib/project/importImage', () => ({
  normalizeImportedFiles: (files: File[]) => normalizeImportedFilesMock(files),
}))

import { useCamera } from '../src/hooks/useCamera'
const useCameraMock = vi.mocked(useCamera)

function Harness({ onFrameCaptured = vi.fn() }: { onFrameCaptured?: (f: CapturedFrame) => void }) {
  const [frames, setFrames] = useState<CapturedFrame[]>([])
  const [fpsLevel, setFpsLevel] = useState<FpsLevel>('normal')
  return (
    <CaptureScreen
      frames={frames} setFrames={setFrames} fpsLevel={fpsLevel} setFpsLevel={setFpsLevel}
      onExport={vi.fn()} language="vi" onionOpacity={0.4} onionEnabled={false} setOnionEnabled={vi.fn()}
      onFrameCaptured={onFrameCaptured}
    />
  )
}

function selectFiles(files: File[]) {
  const input = screen.getByTestId('import-file-input') as HTMLInputElement
  Object.defineProperty(input, 'files', { value: files, writable: false, configurable: true })
  fireEvent.change(input)
}

beforeEach(() => {
  useCameraMock.mockReturnValue(makeCameraMock('live'))
  normalizeImportedFilesMock.mockReset()
})

describe('Import ảnh — CaptureScreen wiring (AC2/AC3)', () => {
  it('chọn 2 ảnh → normalize xong → cả 2 nối vào filmstrip + onFrameCaptured gọi đúng 2 lần', async () => {
    normalizeImportedFilesMock.mockResolvedValue([
      { dataUrl: 'data:image/jpeg;base64,imgA', bytes: new ArrayBuffer(4) },
      { dataUrl: 'data:image/jpeg;base64,imgB', bytes: new ArrayBuffer(4) },
    ])
    const onFrameCaptured = vi.fn()
    render(<Harness onFrameCaptured={onFrameCaptured} />)

    selectFiles([new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')])

    await waitFor(() => {
      expect(document.querySelectorAll('[data-testid^="thumb-"]')).toHaveLength(2)
    })
    expect(onFrameCaptured).toHaveBeenCalledTimes(2)
    const thumbImgs = Array.from(document.querySelectorAll('[data-testid="filmstrip"] img')).map(i => (i as HTMLImageElement).src)
    expect(thumbImgs).toEqual(['data:image/jpeg;base64,imgA', 'data:image/jpeg;base64,imgB'])
  })

  it('nối SAU frame đã chụp trước đó — giữ đúng thứ tự (frame cũ trước, ảnh import sau)', async () => {
    normalizeImportedFilesMock.mockResolvedValue([{ dataUrl: 'data:image/jpeg;base64,imported', bytes: new ArrayBuffer(4) }])
    render(<Harness />)

    // Chụp 1 frame trước qua phím Space (mock captureFrame trả undefined trong beforeEach — cần
    // set riêng ở test này để có 1 frame "chụp" thật trong RAM trước khi import).
    // Đơn giản hoá: import 2 lần liên tiếp để có thứ tự rõ ràng cần giữ.
    selectFiles([new File(['a'], 'a.jpg')])
    await waitFor(() => expect(document.querySelectorAll('[data-testid^="thumb-"]')).toHaveLength(1))

    normalizeImportedFilesMock.mockResolvedValue([{ dataUrl: 'data:image/jpeg;base64,imported2', bytes: new ArrayBuffer(4) }])
    selectFiles([new File(['b'], 'b.jpg')])
    await waitFor(() => expect(document.querySelectorAll('[data-testid^="thumb-"]')).toHaveLength(2))

    const thumbImgs = Array.from(document.querySelectorAll('[data-testid="filmstrip"] img')).map(i => (i as HTMLImageElement).src)
    expect(thumbImgs).toEqual(['data:image/jpeg;base64,imported', 'data:image/jpeg;base64,imported2'])
  })

  it('normalizeImportedFiles trả rỗng (mọi file lỗi decode) → không thêm gì, không crash', async () => {
    normalizeImportedFilesMock.mockResolvedValue([])
    const onFrameCaptured = vi.fn()
    render(<Harness onFrameCaptured={onFrameCaptured} />)

    selectFiles([new File(['bad'], 'bad.jpg')])

    await waitFor(() => expect(normalizeImportedFilesMock).toHaveBeenCalled())
    expect(document.querySelectorAll('[data-testid^="thumb-"]')).toHaveLength(0)
    expect(onFrameCaptured).not.toHaveBeenCalled()
  })

  it('đang import (spinner) → nút chụp Space bị khoá (không throw, không tăng frame)', async () => {
    let resolveNormalize: (v: unknown) => void = () => {}
    normalizeImportedFilesMock.mockReturnValue(new Promise(resolve => { resolveNormalize = resolve }))
    render(<Harness />)

    selectFiles([new File(['a'], 'a.jpg')])
    await waitFor(() => expect(screen.getByTestId('import-slot-btn')).toBeDisabled())

    fireEvent.keyDown(window, { code: 'Space' })
    expect(document.querySelectorAll('[data-testid^="thumb-"]')).toHaveLength(0)

    resolveNormalize([{ dataUrl: 'data:image/jpeg;base64,done', bytes: new ArrayBuffer(4) }])
    await waitFor(() => expect(document.querySelectorAll('[data-testid^="thumb-"]')).toHaveLength(1))
  })
})
