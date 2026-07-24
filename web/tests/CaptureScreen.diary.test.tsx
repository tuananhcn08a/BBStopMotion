/**
 * T-XW10 — CaptureScreen chế độ Nhật ký 🌱: AC1 (HUD 3 dải, band top/bottom sibling — verify qua
 * cấu trúc/testid), AC2 (onion "hôm qua" = ảnh mới nhất NGÀY LỊCH liền trước, không phải frame
 * cuối), AC3 (dải trên "🌱 Ảnh N/M" + todayLine "Hôm nay: X ảnh · Phim ~Ys"), AC5 (OnionInline chỉ
 * xuất hiện ở 🌱, không phải công tắc cũ).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CaptureScreen from '../src/components/CaptureScreen'
import { CapturedFrame } from '../src/types'
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
    captureFrame: vi.fn(),
    deleteLastFrame: (frames: CapturedFrame[]) => frames.slice(0, -1),
    deleteFrameAt: (frames: CapturedFrame[], index: number) =>
      [...frames.slice(0, index), ...frames.slice(index + 1)],
    // Diary KHÔNG dùng getOnionSkinFrame (chỉ 🎭) — trả frame cuối để phát hiện NGAY nếu code lỡ
    // dùng nhầm nguồn onion cho diary (test AC2 sẽ FAIL rõ ràng thay vì false-positive).
    getOnionSkinFrame: (frames: CapturedFrame[]) => (frames.length > 0 ? frames[frames.length - 1] : null),
  }),
}))

import { useCamera } from '../src/hooks/useCamera'
const useCameraMock = vi.mocked(useCamera)

const DAY_MS = 86400000

function frameAt(id: string, daysAgo: number, hourOffset = 0): CapturedFrame {
  const now = Date.now()
  const ts = now - daysAgo * DAY_MS + hourOffset
  return { id, dataUrl: `data:image/jpeg;base64,${id}`, timestamp: ts }
}

function renderDiary(frames: CapturedFrame[] = [], extraProps: Record<string, unknown> = {}) {
  useCameraMock.mockReturnValue(makeCameraMock('live'))
  return render(
    <CaptureScreen
      frames={frames}
      setFrames={vi.fn()}
      fpsLevel="slow"
      setFpsLevel={vi.fn()}
      onExport={vi.fn()}
      language="vi+en"
      onionOpacity={0.4}
      onionEnabled={true}
      setOnionEnabled={vi.fn()}
      projectKind="diary"
      onionLastOpacity={0.4}
      onOnionOpacityChange={vi.fn()}
      {...extraProps}
    />
  )
}

describe('CaptureScreen diary — AC3 dải trên "Ảnh N/M" + todayLine', () => {
  it('0 frame (dự án mới) → "Ảnh 1 / 1" (forward-looking, luôn có giá trị)', () => {
    renderDiary([])
    expect(screen.getByTestId('diary-status-text')).toHaveTextContent('Ảnh 1 / 1')
  })

  it('14 frame đã có → dải trên "Ảnh 15 / 15" (vị trí ảnh SẮP chụp = count+1)', () => {
    renderDiary(Array.from({ length: 14 }, (_, i) => frameAt(`f${i}`, 5)))
    expect(screen.getByTestId('diary-status-text')).toHaveTextContent('Ảnh 15 / 15')
  })

  it('todayLine hiện đúng "Hôm nay: X ảnh" — đếm frame có timestamp HÔM NAY', () => {
    const frames = [frameAt('yesterday', 1), frameAt('today-1', 0), frameAt('today-2', 0, 1000)]
    renderDiary(frames)
    expect(screen.getByTestId('diary-today-line')).toHaveTextContent('2')
    expect(screen.getByTestId('diary-today-line')).toHaveTextContent('ảnh')
  })

  it('🎭 animation KHÔNG hiện todayLine/diary-status-text', () => {
    useCameraMock.mockReturnValue(makeCameraMock('live'))
    render(
      <CaptureScreen
        frames={[]}
        setFrames={vi.fn()}
        fpsLevel="normal"
        setFpsLevel={vi.fn()}
        onExport={vi.fn()}
        language="vi+en"
        onionOpacity={0.4}
        onionEnabled={true}
        setOnionEnabled={vi.fn()}
        projectKind="animation"
      />
    )
    expect(screen.queryByTestId('diary-today-line')).not.toBeInTheDocument()
    expect(screen.queryByTestId('diary-status-text')).not.toBeInTheDocument()
  })
})

describe('CaptureScreen diary — AC2 onion "hôm qua" (ngày lịch liền trước, KHÔNG phải frame cuối)', () => {
  it('có nhiều frame hôm qua → hint "🧅 Căn cho khớp với ảnh hôm qua" hiện (có ảnh để căn)', () => {
    const frames = [frameAt('twoDaysAgo', 2), frameAt('yesterdayEarly', 1), frameAt('yesterdayLate', 1, 3600_000)]
    renderDiary(frames)
    expect(screen.getByTestId('diary-hint-text')).toHaveTextContent('Căn cho khớp với ảnh hôm qua')
  })

  it('KHÔNG có ảnh hôm qua (chỉ có 2 ngày trước) → hint "📍 Đây là ảnh đầu tiên!" (TS-XP-16)', () => {
    renderDiary([frameAt('twoDaysAgo', 2)])
    expect(screen.getByTestId('diary-hint-text')).toHaveTextContent('Đây là ảnh đầu tiên')
  })

  it('dự án mới 0 frame → hint "📍 Đây là ảnh đầu tiên!" (không phải "căn khớp")', () => {
    renderDiary([])
    expect(screen.getByTestId('diary-hint-text')).toHaveTextContent('Đây là ảnh đầu tiên')
  })
})

describe('CaptureScreen diary — AC5 OnionInline THAY công tắc đơn giản cũ', () => {
  it('🌱 KHÔNG hiện công tắc onion-toggle cũ (đã thay bằng OnionInline trong dải dưới)', () => {
    renderDiary([frameAt('f0', 1)])
    expect(screen.queryByTestId('onion-toggle')).not.toBeInTheDocument()
  })

  it('🌱 hiện OnionInline (opacity>0 → dạng gọn "👻 N%")', () => {
    renderDiary([frameAt('f0', 1)])
    expect(screen.getByTestId('onion-inline-compact')).toHaveTextContent('40%')
  })

  it('🎭 VẪN hiện công tắc onion-toggle cũ (zero-regression)', () => {
    useCameraMock.mockReturnValue(makeCameraMock('live'))
    render(
      <CaptureScreen
        frames={[]}
        setFrames={vi.fn()}
        fpsLevel="normal"
        setFpsLevel={vi.fn()}
        onExport={vi.fn()}
        language="vi+en"
        onionOpacity={0.4}
        onionEnabled={true}
        setOnionEnabled={vi.fn()}
        projectKind="animation"
      />
    )
    expect(screen.getByTestId('onion-toggle')).toBeInTheDocument()
    expect(screen.queryByTestId('onion-inline-compact')).not.toBeInTheDocument()
  })
})

describe('CaptureScreen diary — AC1 HUD 3 dải: khung live sạch, band là sibling', () => {
  it('data-landmark="camera-preview" + data-landmark="frame-counter" vẫn tồn tại (khớp e2e cũ)', () => {
    renderDiary([frameAt('f0', 1)])
    expect(document.querySelector('[data-landmark="camera-preview"]')).toBeInTheDocument()
    const counter = document.querySelector('[data-landmark="frame-counter"]')
    expect(counter).toBeInTheDocument()
    expect(counter?.textContent?.trim().startsWith('1')).toBe(true)
  })
})
