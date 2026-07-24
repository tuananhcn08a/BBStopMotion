/**
 * T-XW14 AC3/AC4 — chế độ "🔀 Sắp xếp" transactional tích hợp trong CaptureScreen: kéo-thả/xoá
 * chỉ đổi RAM (KHÔNG gọi `onFrameDeleted`/`onCommitFrameOrder` cho tới khi commit); "↺ Huỷ" revert
 * KHÔNG ghi đĩa; "✕ Xong" commit 1 phát đúng danh sách seq mới; rời màn (unmount) giữa lúc còn thay
 * đổi dở dang → auto-commit. Test dùng wrapper `useState` THẬT (không phải `vi.fn()` tĩnh) để
 * `setFrames` cập nhật lại DOM thật — cần thiết để verify thứ tự HIỂN THỊ sau commit/revert.
 */
import { useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CaptureScreen from '../src/components/CaptureScreen'
import { CapturedFrame, FpsLevel } from '../src/types'
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
    getOnionSkinFrame: () => null,
  }),
}))

import { useCamera } from '../src/hooks/useCamera'
const useCameraMock = vi.mocked(useCamera)

function makeFrames(n: number): CapturedFrame[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `frame-${i}`, dataUrl: `data:image/jpeg;base64,test${i}`, timestamp: i,
  }))
}

function thumbSrcs(): string[] {
  return Array.from(document.querySelectorAll('[data-testid="filmstrip"] img')).map(img => (img as HTMLImageElement).src)
}

/** Wrapper `useState` THẬT — `onCommitFrameOrder`/`onFrameDeleted` là spy riêng để assert số lần
 *  gọi + tham số, tách biệt khỏi việc `setFrames` có thật sự cập nhật DOM hay không. `mounted`
 *  điều khiển unmount CaptureScreen (giả lập "rời màn Chụp") để test auto-commit. */
function Harness({
  initialFrames, onCommitFrameOrder = vi.fn(), onFrameDeleted = vi.fn(), mounted = true,
}: {
  initialFrames: CapturedFrame[]
  onCommitFrameOrder?: (seqs: number[]) => void
  onFrameDeleted?: (seq: number) => void
  mounted?: boolean
}) {
  const [frames, setFrames] = useState(initialFrames)
  const [fpsLevel, setFpsLevel] = useState<FpsLevel>('normal')
  if (!mounted) return null
  return (
    <CaptureScreen
      frames={frames}
      setFrames={setFrames}
      fpsLevel={fpsLevel}
      setFpsLevel={setFpsLevel}
      onExport={vi.fn()}
      language="vi"
      onionOpacity={0.4}
      onionEnabled={false}
      setOnionEnabled={vi.fn()}
      onFrameDeleted={onFrameDeleted}
      onCommitFrameOrder={onCommitFrameOrder}
    />
  )
}

beforeEach(() => {
  useCameraMock.mockReturnValue(makeCameraMock('live'))
})

describe('Sắp xếp — vào/ra chế độ nháp', () => {
  it('bấm "🔀 Sắp xếp" → hiện toolbar Huỷ/Xong, ẩn nút Sắp xếp', () => {
    render(<Harness initialFrames={makeFrames(3)} />)
    fireEvent.click(screen.getByTestId('sort-enter-btn'))
    expect(screen.getByTestId('sort-undo-btn')).toBeInTheDocument()
    expect(screen.getByTestId('sort-done-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('sort-enter-btn')).toBeNull()
  })
})

describe('Sắp xếp — kéo-thả + xoá chỉ đổi RAM (AC3)', () => {
  it('kéo-thả nháp KHÔNG gọi onCommitFrameOrder/onFrameDeleted (chưa ghi đĩa)', () => {
    const onCommitFrameOrder = vi.fn()
    const onFrameDeleted = vi.fn()
    render(<Harness initialFrames={makeFrames(3)} onCommitFrameOrder={onCommitFrameOrder} onFrameDeleted={onFrameDeleted} />)
    fireEvent.click(screen.getByTestId('sort-enter-btn'))

    // Kéo thumb 0 sang vị trí 2 (chỉ đổi draftOrder RAM).
    fireEvent.pointerDown(screen.getByTestId('thumb-0'), { pointerId: 1 })
    fireEvent.pointerMove(screen.getByTestId('thumb-2'), { pointerId: 1 })
    fireEvent.pointerUp(screen.getByTestId('thumb-2'), { pointerId: 1 })

    expect(onCommitFrameOrder).not.toHaveBeenCalled()
    expect(onFrameDeleted).not.toHaveBeenCalled()
    // "↺ Huỷ" đã active vì có thay đổi nháp.
    expect(screen.getByTestId('sort-undo-btn')).not.toBeDisabled()
  })

  it('chọn + "🗑 Xoá" (confirm accept) chỉ đổi RAM — KHÔNG gọi onFrameDeleted/onCommitFrameOrder', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onCommitFrameOrder = vi.fn()
    const onFrameDeleted = vi.fn()
    render(<Harness initialFrames={makeFrames(3)} onCommitFrameOrder={onCommitFrameOrder} onFrameDeleted={onFrameDeleted} />)
    fireEvent.click(screen.getByTestId('sort-enter-btn'))

    fireEvent.pointerDown(screen.getByTestId('thumb-1'), { pointerId: 1 })
    fireEvent.pointerUp(screen.getByTestId('thumb-1'), { pointerId: 1 }) // tap = chọn seq 1
    expect(screen.getByTestId('sort-selection-bar')).toHaveTextContent('Đã chọn 1 ảnh')

    fireEvent.click(screen.getByTestId('sort-delete-selected-btn'))
    expect(confirmSpy).toHaveBeenCalled()
    expect(onFrameDeleted).not.toHaveBeenCalled()
    expect(onCommitFrameOrder).not.toHaveBeenCalled()
    // Item đã "xoá" khỏi bản nháp hiển thị (còn 2 thumb).
    expect(document.querySelectorAll('[data-testid^="thumb-"]')).toHaveLength(2)

    confirmSpy.mockRestore()
  })

  it('confirm bị TỪ CHỐI (Cancel) → KHÔNG xoá gì khỏi bản nháp', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<Harness initialFrames={makeFrames(3)} />)
    fireEvent.click(screen.getByTestId('sort-enter-btn'))
    fireEvent.pointerDown(screen.getByTestId('thumb-0'), { pointerId: 1 })
    fireEvent.pointerUp(screen.getByTestId('thumb-0'), { pointerId: 1 })
    fireEvent.click(screen.getByTestId('sort-delete-selected-btn'))
    expect(document.querySelectorAll('[data-testid^="thumb-"]')).toHaveLength(3)
    confirmSpy.mockRestore()
  })
})

describe('Sắp xếp — "↺ Huỷ" revert KHÔNG ghi đĩa (AC4)', () => {
  it('kéo-thả rồi Huỷ → thứ tự CŨ trở lại, không gọi onCommitFrameOrder', () => {
    const onCommitFrameOrder = vi.fn()
    render(<Harness initialFrames={makeFrames(3)} onCommitFrameOrder={onCommitFrameOrder} />)
    const originalSrcs = thumbSrcs()

    fireEvent.click(screen.getByTestId('sort-enter-btn'))
    fireEvent.pointerDown(screen.getByTestId('thumb-0'), { pointerId: 1 })
    fireEvent.pointerMove(screen.getByTestId('thumb-2'), { pointerId: 1 })
    fireEvent.pointerUp(screen.getByTestId('thumb-2'), { pointerId: 1 })
    expect(thumbSrcs()).not.toEqual(originalSrcs) // đã đổi trong nháp

    fireEvent.click(screen.getByTestId('sort-undo-btn'))
    expect(thumbSrcs()).toEqual(originalSrcs) // về lại đúng thứ tự gốc
    expect(onCommitFrameOrder).not.toHaveBeenCalled()
    expect(screen.getByTestId('sort-undo-btn')).toBeDisabled() // hết thay đổi sau khi huỷ
  })
})

describe('Sắp xếp — "✕ Xong" commit 1 phát (AC4)', () => {
  it('kéo-thả rồi Xong → gọi onCommitFrameOrder ĐÚNG danh sách seq mới, DOM cập nhật thứ tự mới, thoát chế độ', () => {
    const onCommitFrameOrder = vi.fn()
    render(<Harness initialFrames={makeFrames(3)} onCommitFrameOrder={onCommitFrameOrder} />)

    fireEvent.click(screen.getByTestId('sort-enter-btn'))
    // Kéo seq 0 (vị trí 0) ra cuối (vị trí 2) → thứ tự mới mong đợi seq [1, 2, 0].
    fireEvent.pointerDown(screen.getByTestId('thumb-0'), { pointerId: 1 })
    fireEvent.pointerMove(screen.getByTestId('thumb-2'), { pointerId: 1 })
    fireEvent.pointerUp(screen.getByTestId('thumb-2'), { pointerId: 1 })

    fireEvent.click(screen.getByTestId('sort-done-btn'))

    expect(onCommitFrameOrder).toHaveBeenCalledTimes(1)
    expect(onCommitFrameOrder).toHaveBeenCalledWith([1, 2, 0])
    expect(thumbSrcs()).toEqual([
      'data:image/jpeg;base64,test1', 'data:image/jpeg;base64,test2', 'data:image/jpeg;base64,test0',
    ])
    // Thoát hẳn chế độ Sắp xếp — nút "🔀 Sắp xếp" trở lại.
    expect(screen.getByTestId('sort-enter-btn')).toBeInTheDocument()
  })

  it('"Xong" khi KHÔNG có thay đổi gì → KHÔNG gọi onCommitFrameOrder (tránh ghi thừa)', () => {
    const onCommitFrameOrder = vi.fn()
    render(<Harness initialFrames={makeFrames(3)} onCommitFrameOrder={onCommitFrameOrder} />)
    fireEvent.click(screen.getByTestId('sort-enter-btn'))
    fireEvent.click(screen.getByTestId('sort-done-btn'))
    expect(onCommitFrameOrder).not.toHaveBeenCalled()
  })

  it('xoá 1 ảnh rồi Xong → commit đúng danh sách seq còn lại (renumber ngầm ở tầng data layer)', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onCommitFrameOrder = vi.fn()
    render(<Harness initialFrames={makeFrames(3)} onCommitFrameOrder={onCommitFrameOrder} />)

    fireEvent.click(screen.getByTestId('sort-enter-btn'))
    fireEvent.pointerDown(screen.getByTestId('thumb-1'), { pointerId: 1 })
    fireEvent.pointerUp(screen.getByTestId('thumb-1'), { pointerId: 1 })
    fireEvent.click(screen.getByTestId('sort-delete-selected-btn'))
    fireEvent.click(screen.getByTestId('sort-done-btn'))

    expect(onCommitFrameOrder).toHaveBeenCalledWith([0, 2])
    expect(thumbSrcs()).toEqual(['data:image/jpeg;base64,test0', 'data:image/jpeg;base64,test2'])
    confirmSpy.mockRestore()
  })
})

describe('Sắp xếp — rời màn Chụp giữa lúc còn thay đổi dở dang → AUTO-COMMIT (mockup §2)', () => {
  it('unmount CaptureScreen lúc CÓ thay đổi nháp → gọi onCommitFrameOrder đúng seq (không hỏi lại)', () => {
    const onCommitFrameOrder = vi.fn()

    function Toggle() {
      const [mounted, setMounted] = useState(true)
      return (
        <>
          <button data-testid="leave-screen" onClick={() => setMounted(false)}>Rời màn</button>
          <Harness initialFrames={makeFrames(3)} onCommitFrameOrder={onCommitFrameOrder} mounted={mounted} />
        </>
      )
    }
    render(<Toggle />)

    fireEvent.click(screen.getByTestId('sort-enter-btn'))
    fireEvent.pointerDown(screen.getByTestId('thumb-0'), { pointerId: 1 })
    fireEvent.pointerMove(screen.getByTestId('thumb-2'), { pointerId: 1 })
    fireEvent.pointerUp(screen.getByTestId('thumb-2'), { pointerId: 1 })
    expect(onCommitFrameOrder).not.toHaveBeenCalled() // vẫn chỉ RAM cho tới lúc rời màn

    fireEvent.click(screen.getByTestId('leave-screen'))
    expect(onCommitFrameOrder).toHaveBeenCalledTimes(1)
    expect(onCommitFrameOrder).toHaveBeenCalledWith([1, 2, 0])
  })

  it('unmount CaptureScreen lúc KHÔNG có thay đổi nháp (chỉ mới bấm vào chế độ) → KHÔNG gọi onCommitFrameOrder', () => {
    const onCommitFrameOrder = vi.fn()
    function Toggle() {
      const [mounted, setMounted] = useState(true)
      return (
        <>
          <button data-testid="leave-screen" onClick={() => setMounted(false)}>Rời màn</button>
          <Harness initialFrames={makeFrames(3)} onCommitFrameOrder={onCommitFrameOrder} mounted={mounted} />
        </>
      )
    }
    render(<Toggle />)
    fireEvent.click(screen.getByTestId('sort-enter-btn'))
    fireEvent.click(screen.getByTestId('leave-screen'))
    expect(onCommitFrameOrder).not.toHaveBeenCalled()
  })

  it('unmount lúc KHÔNG ở chế độ Sắp xếp → KHÔNG gọi onCommitFrameOrder (regression bình thường)', () => {
    const onCommitFrameOrder = vi.fn()
    function Toggle() {
      const [mounted, setMounted] = useState(true)
      return (
        <>
          <button data-testid="leave-screen" onClick={() => setMounted(false)}>Rời màn</button>
          <Harness initialFrames={makeFrames(3)} onCommitFrameOrder={onCommitFrameOrder} mounted={mounted} />
        </>
      )
    }
    render(<Toggle />)
    fireEvent.click(screen.getByTestId('leave-screen'))
    expect(onCommitFrameOrder).not.toHaveBeenCalled()
  })
})

describe('Sắp xếp — khoá chụp/xoá-nhanh trong lúc đang nháp (1 lối sửa tại 1 thời điểm)', () => {
  it('phím Space (chụp) không thêm frame khi đang ở chế độ Sắp xếp', () => {
    render(<Harness initialFrames={makeFrames(3)} />)
    fireEvent.click(screen.getByTestId('sort-enter-btn'))
    expect(document.querySelectorAll('[data-testid^="thumb-"]')).toHaveLength(3)
    fireEvent.keyDown(window, { code: 'Space' })
    // captureFrame mock trả undefined (không setup) — vào nhánh return sớm do isSortMode, không throw.
    expect(document.querySelectorAll('[data-testid^="thumb-"]')).toHaveLength(3)
  })
})

describe('Photo Viewer — AC1: chạm thumbnail (ngoài chế độ Sắp xếp) mở ảnh to', () => {
  it('click thumb-1 mở Photo Viewer đúng ảnh, badge "Ảnh 2 / 3"; bấm ✕ đóng lại', () => {
    render(<Harness initialFrames={makeFrames(3)} />)
    expect(screen.queryByTestId('photo-viewer')).toBeNull()

    fireEvent.click(screen.getByTestId('thumb-1'))
    expect(screen.getByTestId('photo-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('photo-viewer-badge')).toHaveTextContent('Ảnh 2 / 3')
    expect(screen.getByTestId('photo-viewer-image')).toHaveAttribute('src', 'data:image/jpeg;base64,test1')

    fireEvent.click(screen.getByTestId('photo-viewer-close'))
    expect(screen.queryByTestId('photo-viewer')).toBeNull()
  })

  it('trong chế độ Sắp xếp, chạm thumbnail KHÔNG mở Photo Viewer (chạm = chọn)', () => {
    render(<Harness initialFrames={makeFrames(3)} />)
    fireEvent.click(screen.getByTestId('sort-enter-btn'))
    fireEvent.pointerDown(screen.getByTestId('thumb-0'), { pointerId: 1 })
    fireEvent.pointerUp(screen.getByTestId('thumb-0'), { pointerId: 1 })
    expect(screen.queryByTestId('photo-viewer')).toBeNull()
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})
