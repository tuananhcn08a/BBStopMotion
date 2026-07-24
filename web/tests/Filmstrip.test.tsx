/**
 * T-XW14 — `Filmstrip.tsx`: chế độ "🔀 Sắp xếp" transactional (THAY nút "×" xoá-ngay cũ, AC5) +
 * mở Photo Viewer qua chạm thumbnail (AC1). Component chỉ PHÁT sự kiện lên cha qua callback props
 * (`onReorder`/`onToggleSelect`/...) — state nháp thật (draftOrder/snapshot) sống ở CaptureScreen,
 * xem `CaptureScreen.sortMode.test.tsx` cho test tích hợp luồng transactional đầy đủ.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Filmstrip from '../src/components/Filmstrip'
import { CapturedFrame } from '../src/types'

function makeFrames(n: number): CapturedFrame[] {
  return Array.from({ length: n }, (_, i) => ({ id: `f${i}`, dataUrl: `data:image/jpeg;base64,${i}`, timestamp: i }))
}

function baseProps(overrides: Partial<React.ComponentProps<typeof Filmstrip>> = {}) {
  const frames = makeFrames(3)
  return {
    frames,
    selectedIndex: frames.length - 1,
    language: 'vi' as const,
    isSortMode: false,
    draftOrder: frames.map((_, i) => i),
    selectedSeqs: new Set<number>(),
    hasDraftChanges: false,
    onEnterSortMode: vi.fn(),
    onToggleSelect: vi.fn(),
    onReorder: vi.fn(),
    onRevertSort: vi.fn(),
    onFinishSort: vi.fn(),
    onDeleteSelected: vi.fn(),
    ...overrides,
  }
}

describe('Filmstrip — AC5: nút "×" xoá-ngay cũ đã BỎ HẲN', () => {
  it('không còn data-testid delete-frame-N nào trong DOM', () => {
    render(<Filmstrip {...baseProps()} />)
    expect(document.querySelector('[data-testid^="delete-frame-"]')).toBeNull()
  })
})

describe('Filmstrip — AC1: chạm thumbnail (NGOÀI sort mode) mở Photo Viewer', () => {
  it('click thumb gọi onOpenViewer(index) đúng', () => {
    const onOpenViewer = vi.fn()
    render(<Filmstrip {...baseProps({ onOpenViewer })} />)
    fireEvent.click(screen.getByTestId('thumb-1'))
    expect(onOpenViewer).toHaveBeenCalledWith(1)
  })

  it('không có onOpenViewer (vd đang preview) → click không throw, không gọi gì', () => {
    render(<Filmstrip {...baseProps({ onOpenViewer: undefined })} />)
    expect(() => fireEvent.click(screen.getByTestId('thumb-0'))).not.toThrow()
  })
})

describe('Filmstrip — nút "🔀 Sắp xếp" vào chế độ nháp', () => {
  it('bấm gọi onEnterSortMode', () => {
    const onEnterSortMode = vi.fn()
    render(<Filmstrip {...baseProps({ onEnterSortMode })} />)
    fireEvent.click(screen.getByTestId('sort-enter-btn'))
    expect(onEnterSortMode).toHaveBeenCalledTimes(1)
  })

  it('dải rỗng (0 frame) → nút "🔀 Sắp xếp" disabled', () => {
    render(<Filmstrip {...baseProps({ frames: [], draftOrder: [] })} />)
    expect(screen.getByTestId('sort-enter-btn')).toBeDisabled()
  })
})

describe('Filmstrip — trong chế độ Sắp xếp: toolbar Huỷ/Xong', () => {
  it('"↺ Huỷ" disabled khi hasDraftChanges=false', () => {
    render(<Filmstrip {...baseProps({ isSortMode: true, hasDraftChanges: false })} />)
    expect(screen.getByTestId('sort-undo-btn')).toBeDisabled()
  })

  it('"↺ Huỷ" active khi hasDraftChanges=true, bấm gọi onRevertSort', () => {
    const onRevertSort = vi.fn()
    render(<Filmstrip {...baseProps({ isSortMode: true, hasDraftChanges: true, onRevertSort })} />)
    const btn = screen.getByTestId('sort-undo-btn')
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(onRevertSort).toHaveBeenCalledTimes(1)
  })

  it('"✕ Xong" LUÔN active kể cả hasDraftChanges=false, bấm gọi onFinishSort', () => {
    const onFinishSort = vi.fn()
    render(<Filmstrip {...baseProps({ isSortMode: true, hasDraftChanges: false, onFinishSort })} />)
    const btn = screen.getByTestId('sort-done-btn')
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(onFinishSort).toHaveBeenCalledTimes(1)
  })

  it('không hiện nút "🔀 Sắp xếp" trong lúc đang ở chế độ Sắp xếp', () => {
    render(<Filmstrip {...baseProps({ isSortMode: true })} />)
    expect(screen.queryByTestId('sort-enter-btn')).toBeNull()
  })

  it('ẩn slot "+" (frame tiếp theo) trong chế độ Sắp xếp', () => {
    render(<Filmstrip {...baseProps({ isSortMode: true })} />)
    expect(screen.queryByLabelText('Slot frame tiếp theo')).toBeNull()
  })
})

describe('Filmstrip — chạm = chọn (tap, không kéo) trong chế độ Sắp xếp', () => {
  it('pointerdown rồi pointerup KHÔNG di chuyển → onToggleSelect(seq) đúng seq gốc', () => {
    const onToggleSelect = vi.fn()
    const draftOrder = [2, 0, 1] // seq gốc theo thứ tự hiển thị hiện tại
    render(<Filmstrip {...baseProps({ isSortMode: true, draftOrder, onToggleSelect })} />)
    const thumb1 = screen.getByTestId('thumb-1') // vị trí hiển thị 1 → seq gốc = draftOrder[1] = 0
    fireEvent.pointerDown(thumb1, { pointerId: 1 })
    fireEvent.pointerUp(thumb1, { pointerId: 1 })
    expect(onToggleSelect).toHaveBeenCalledWith(0)
  })

  it('chấm tick hiện ✓ khi seq đã trong selectedSeqs', () => {
    render(<Filmstrip {...baseProps({ isSortMode: true, selectedSeqs: new Set([1]) })} />)
    // draftOrder mặc định [0,1,2] → vị trí hiển thị 1 có seq=1 → đã chọn
    expect(screen.getByTestId('sel-dot-1')).toHaveTextContent('✓')
    expect(screen.getByTestId('sel-dot-0')).toHaveTextContent('')
  })
})

describe('Filmstrip — kéo (drag) trong chế độ Sắp xếp gọi onReorder', () => {
  it('pointerdown ở vị trí 0 rồi pointermove sang vị trí 2 → onReorder(0, 2)', () => {
    const onReorder = vi.fn()
    render(<Filmstrip {...baseProps({ isSortMode: true, onReorder })} />)
    const thumb0 = screen.getByTestId('thumb-0')
    const thumb2 = screen.getByTestId('thumb-2')
    fireEvent.pointerDown(thumb0, { pointerId: 1 })
    fireEvent.pointerMove(thumb2, { pointerId: 1 })
    expect(onReorder).toHaveBeenCalledWith(0, 2)
  })

  it('pointerup SAU khi đã kéo → KHÔNG gọi onToggleSelect (kéo khác chạm)', () => {
    const onToggleSelect = vi.fn()
    const onReorder = vi.fn()
    render(<Filmstrip {...baseProps({ isSortMode: true, onReorder, onToggleSelect })} />)
    const thumb0 = screen.getByTestId('thumb-0')
    const thumb1 = screen.getByTestId('thumb-1')
    fireEvent.pointerDown(thumb0, { pointerId: 1 })
    fireEvent.pointerMove(thumb1, { pointerId: 1 })
    fireEvent.pointerUp(thumb1, { pointerId: 1 })
    expect(onReorder).toHaveBeenCalledWith(0, 1)
    expect(onToggleSelect).not.toHaveBeenCalled()
  })
})

describe('Filmstrip — thanh chọn + "🗑 Xoá" (selectionBar)', () => {
  it('selectedSeqs rỗng → KHÔNG render selectionBar', () => {
    render(<Filmstrip {...baseProps({ isSortMode: true, selectedSeqs: new Set() })} />)
    expect(screen.queryByTestId('sort-selection-bar')).toBeNull()
  })

  it('có ảnh đã chọn → hiện "Đã chọn N ảnh" + nút xoá gọi onDeleteSelected', () => {
    const onDeleteSelected = vi.fn()
    render(<Filmstrip {...baseProps({ isSortMode: true, selectedSeqs: new Set([0, 2]), onDeleteSelected })} />)
    expect(screen.getByTestId('sort-selection-bar')).toHaveTextContent('Đã chọn 2 ảnh')
    fireEvent.click(screen.getByTestId('sort-delete-selected-btn'))
    expect(onDeleteSelected).toHaveBeenCalledTimes(1)
  })
})

describe('Filmstrip — T-XW17 AC2: slot "🖼️ Thêm" import ảnh', () => {
  it('không truyền onImportFiles (vd gate fixture) → KHÔNG render slot import', () => {
    render(<Filmstrip {...baseProps({ onImportFiles: undefined })} />)
    expect(screen.queryByTestId('import-slot-btn')).toBeNull()
  })

  it('có onImportFiles → hiện slot; bấm slot kích hoạt input file ẩn (mở picker OS)', () => {
    const onImportFiles = vi.fn()
    render(<Filmstrip {...baseProps({ onImportFiles })} />)
    const btn = screen.getByTestId('import-slot-btn')
    expect(btn).toBeInTheDocument()

    const input = screen.getByTestId('import-file-input') as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click')
    fireEvent.click(btn)
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('chọn file qua input → gọi onImportFiles(FileList) đúng', () => {
    const onImportFiles = vi.fn()
    render(<Filmstrip {...baseProps({ onImportFiles })} />)
    const input = screen.getByTestId('import-file-input') as HTMLInputElement
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    Object.defineProperty(input, 'files', { value: [file], writable: false, configurable: true })

    fireEvent.change(input)

    expect(onImportFiles).toHaveBeenCalledTimes(1)
    const passedFiles = onImportFiles.mock.calls[0][0] as FileList
    expect(passedFiles).toHaveLength(1)
    expect(passedFiles[0]).toBe(file)
  })

  it('chọn 0 file (Huỷ picker) → KHÔNG gọi onImportFiles', () => {
    const onImportFiles = vi.fn()
    render(<Filmstrip {...baseProps({ onImportFiles })} />)
    const input = screen.getByTestId('import-file-input') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [], writable: false, configurable: true })

    fireEvent.change(input)

    expect(onImportFiles).not.toHaveBeenCalled()
  })

  it('isImporting=true → nút disabled + hiện spinner (không icon/label bình thường)', () => {
    render(<Filmstrip {...baseProps({ onImportFiles: vi.fn(), isImporting: true })} />)
    const btn = screen.getByTestId('import-slot-btn')
    expect(btn).toBeDisabled()
    expect(screen.queryByText('Thêm')).toBeNull()
  })

  it('trong chế độ Sắp xếp → KHÔNG hiện slot import (1 lối sửa dải tại 1 thời điểm)', () => {
    render(<Filmstrip {...baseProps({ isSortMode: true, onImportFiles: vi.fn() })} />)
    expect(screen.queryByTestId('import-slot-btn')).toBeNull()
  })
})
