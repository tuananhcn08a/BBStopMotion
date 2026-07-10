/**
 * T-BS11 (Coordinator quyết định 2d) — 2d-states.html KHÔNG gate cả trang (catalog nhiều
 * state, không phải 1 màn app thật). "denied" + "disabled(+toast)" verify qua gate fixture
 * riêng (`?gate=denied` / `?gate=disabled`, xem src/lib/gateFixture.ts). Flash-overlay +
 * export-error banner verify bằng UNIT TEST (đúng token màu + copy) — 2 test này.
 *
 * Redline 2d-states.md "Chụp flash + lỗi export":
 * - Flash: "Overlay trắng 85% phủ preview 150ms" → background rgba(255,255,255,0.85)
 * - Banner lỗi export: background #FDECEB viền #F6C9C5 radius 12px padding 10px 14px,
 *   chữ #C0392B 13px/700; nút Thử lại nền #fff viền 1.5px #C0392B pill.
 *
 * Vitest không bật CSS-in-jsdom (`test.css` không set trong vite.config.ts) nên
 * `getComputedStyle` không đọc được màu thật từ CSS Modules — thay vào đó test đọc
 * NGUỒN file .module.css (source-of-truth) để xác nhận đúng token, kèm test DOM cho copy +
 * đúng class được áp dụng lúc trigger. Cùng pattern đã dùng ở tests/useExport.ts (đọc source
 * để chặn regression CDN baseURL).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CaptureScreen from '../src/components/CaptureScreen'
import type { CapturedFrame } from '../src/types'
import type { UseCameraReturn, CameraState } from '../src/hooks/useCamera'

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

vi.mock('../src/hooks/useCamera', () => ({ useCamera: vi.fn() }))
vi.mock('../src/hooks/useCapture', () => ({
  useCapture: () => ({
    captureFrame: vi.fn().mockReturnValue({ id: 'f1', dataUrl: 'data:image/jpeg;base64,test', timestamp: Date.now() }),
    deleteLastFrame: (frames: CapturedFrame[]) => frames.slice(0, -1),
    deleteFrameAt: (frames: CapturedFrame[], i: number) => [...frames.slice(0, i), ...frames.slice(i + 1)],
    getOnionSkinFrame: (frames: CapturedFrame[]) => (frames.length > 0 ? frames[frames.length - 1] : null),
  }),
}))

import { useCamera } from '../src/hooks/useCamera'
const useCameraMock = vi.mocked(useCamera)

const CAPTURE_CSS = fs.readFileSync(
  path.resolve(__dirname, '../src/components/CaptureScreen.module.css'),
  'utf-8',
)
const APP_CSS = fs.readFileSync(path.resolve(__dirname, '../src/App.module.css'), 'utf-8')

describe('2d state — Flash overlay (150ms trắng 85%)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('đúng token màu trong nguồn CSS: rgba(255, 255, 255, 0.85), animation 150ms', () => {
    const flashBlock = CAPTURE_CSS.match(/\.flash\s*{[^}]*}/)?.[0] ?? ''
    expect(flashBlock, '.flash rule không tồn tại trong CaptureScreen.module.css').not.toBe('')
    expect(flashBlock).toContain('rgba(255, 255, 255, 0.85)')
    expect(flashBlock).toMatch(/flashFade\s+150ms/)
  })

  it('bấm CHỤP → overlay flash xuất hiện ngay, tự ẩn sau ~150ms', async () => {
    useCameraMock.mockReturnValue(makeCameraMock('live'))
    render(
      <CaptureScreen
        frames={[]} setFrames={vi.fn()} fpsLevel="normal" setFpsLevel={vi.fn()}
        onExport={vi.fn()} language="vi+en" onionOpacity={0.4} onionEnabled={true} setOnionEnabled={vi.fn()}
      />
    )
    const captureBtn = screen.getByLabelText(/Chụp frame/i)
    fireEvent.click(captureBtn)

    expect(screen.getByTestId('capture-flash')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByTestId('capture-flash')).not.toBeInTheDocument()
    }, { timeout: 1000 })
  })
})

describe('2d state — Banner lỗi export (App-level, sau khi export thật thất bại)', () => {
  it('đúng token màu trong nguồn CSS: surface #FDECEB, border #F6C9C5, text --color-error-deep', () => {
    const toastBlock = APP_CSS.match(/\.toast\s*{[^}]*}/)?.[0] ?? ''
    const retryBlock = APP_CSS.match(/\.toastRetry\s*{[^}]*}/)?.[0] ?? ''
    expect(toastBlock).toContain('var(--color-error-surface)')
    expect(toastBlock).toContain('var(--color-error-border)')
    expect(toastBlock).toContain('var(--color-error-deep)')
    expect(retryBlock).toContain('var(--color-error-deep)')
  })

  it('token --color-error-surface/--color-error-border/--color-error-deep khớp hex redline (#FDECEB/#F6C9C5/#C0392B)', () => {
    const tokensCss = fs.readFileSync(path.resolve(__dirname, '../src/tokens.css'), 'utf-8')
    expect(tokensCss).toMatch(/--color-error-surface:\s*#FDECEB/i)
    expect(tokensCss).toMatch(/--color-error-border:\s*#F6C9C5/i)
    expect(tokensCss).toMatch(/--color-error-deep:\s*#C0392B/i)
  })
})
