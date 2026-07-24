/**
 * T-XW14 — `PhotoViewer.tsx`. Test jsdom: render, badge "Ảnh N/M", đóng qua nút ✕/ESC, chuyển
 * ảnh qua phím ←/→ (desktop), zoom qua double-click. Hành vi kéo/vuốt bằng toạ độ con trỏ THẬT
 * (dismiss/page bằng pointer drag) KHÔNG kiểm ở đây — jsdom không có `PointerEvent` gốc nên
 * `clientX/clientY` không truyền qua được synthetic event (đã probe thực nghiệm); logic quyết
 * định (`resolveDragEnd` etc) đã có unit test đầy đủ riêng ở `photoViewerGesture.test.ts`, còn
 * hành vi kéo/vuốt THẬT trên toạ độ trình duyệt được `e2e/photo-viewer-sort.test.mjs` xác nhận
 * bằng Chrome thật (mirror gate thật §B chính sách vận hành).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PhotoViewer from '../src/components/PhotoViewer'
import { CapturedFrame } from '../src/types'

function makeFrames(n: number): CapturedFrame[] {
  return Array.from({ length: n }, (_, i) => ({ id: `f${i}`, dataUrl: `data:image/jpeg;base64,frame${i}`, timestamp: i }))
}

describe('PhotoViewer — render + badge', () => {
  it('mở đúng ảnh initialIndex, badge "Ảnh N / M" đúng', () => {
    render(<PhotoViewer frames={makeFrames(5)} initialIndex={2} onClose={vi.fn()} />)
    expect(screen.getByTestId('photo-viewer-badge')).toHaveTextContent('Ảnh 3 / 5')
    expect(screen.getByTestId('photo-viewer-image')).toHaveAttribute('src', 'data:image/jpeg;base64,frame2')
  })

  it('initialIndex ngoài phạm vi → kẹp về biên hợp lệ (không crash)', () => {
    render(<PhotoViewer frames={makeFrames(3)} initialIndex={99} onClose={vi.fn()} />)
    expect(screen.getByTestId('photo-viewer-badge')).toHaveTextContent('Ảnh 3 / 3')
  })

  it('frames rỗng → không render gì (không crash)', () => {
    const { container } = render(<PhotoViewer frames={[]} initialIndex={0} onClose={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('PhotoViewer — đóng', () => {
  it('bấm ✕ gọi onClose', () => {
    const onClose = vi.fn()
    render(<PhotoViewer frames={makeFrames(3)} initialIndex={0} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('photo-viewer-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('phím ESC gọi onClose', () => {
    const onClose = vi.fn()
    render(<PhotoViewer frames={makeFrames(3)} initialIndex={0} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('PhotoViewer — desktop ←/→ đổi ảnh (AC2)', () => {
  it('phím → chuyển sang ảnh kế tiếp, badge cập nhật', () => {
    render(<PhotoViewer frames={makeFrames(5)} initialIndex={0} onClose={vi.fn()} />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByTestId('photo-viewer-badge')).toHaveTextContent('Ảnh 2 / 5')
  })

  it('phím ← chuyển về ảnh trước', () => {
    render(<PhotoViewer frames={makeFrames(5)} initialIndex={2} onClose={vi.fn()} />)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByTestId('photo-viewer-badge')).toHaveTextContent('Ảnh 2 / 5')
  })

  it('ở ảnh ĐẦU, phím ← → kẹp lại, không lỗi (không có ảnh -1)', () => {
    render(<PhotoViewer frames={makeFrames(3)} initialIndex={0} onClose={vi.fn()} />)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByTestId('photo-viewer-badge')).toHaveTextContent('Ảnh 1 / 3')
  })

  it('ở ảnh CUỐI, phím → kẹp lại', () => {
    render(<PhotoViewer frames={makeFrames(3)} initialIndex={2} onClose={vi.fn()} />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByTestId('photo-viewer-badge')).toHaveTextContent('Ảnh 3 / 3')
  })
})

describe('PhotoViewer — zoom double-click (AC2 desktop)', () => {
  it('double-click lần 1 → scale(2.5); double-click lần 2 → về 1× (bỏ transform)', () => {
    render(<PhotoViewer frames={makeFrames(3)} initialIndex={0} onClose={vi.fn()} />)
    const img = screen.getByTestId('photo-viewer-image')
    expect(img.style.transform).toBe('')

    fireEvent.doubleClick(img)
    expect(img.style.transform).toBe('scale(2.5)')

    fireEvent.doubleClick(img)
    expect(img.style.transform).toBe('')
  })

  it('đổi ảnh (←/→) tự reset zoom về 1× (AC2 — "rời ảnh tự reset")', () => {
    render(<PhotoViewer frames={makeFrames(3)} initialIndex={0} onClose={vi.fn()} />)
    const img = screen.getByTestId('photo-viewer-image')
    fireEvent.doubleClick(img)
    expect(img.style.transform).toBe('scale(2.5)')

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByTestId('photo-viewer-image').style.transform).toBe('')
  })
})

describe('PhotoViewer — desktop hint pills luôn hiện (AC2)', () => {
  it('gợi ý ←/→, ESC, "chạm nền đen" đều render trong DOM', () => {
    render(<PhotoViewer frames={makeFrames(3)} initialIndex={0} onClose={vi.fn()} />)
    expect(screen.getByText(/← → đổi ảnh/)).toBeInTheDocument()
    expect(screen.getByText(/ESC đóng/)).toBeInTheDocument()
    expect(screen.getByText(/Chạm nền đen đóng/)).toBeInTheDocument()
  })
})
