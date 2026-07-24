/**
 * T-XW14 — logic thuần chế độ "🔀 Sắp xếp" transactional (`filmstripSort.ts`): khởi tạo
 * draftOrder, phát hiện thay đổi (hasDraftChanges — quyết định mờ/disable "↺ Huỷ"), di chuyển
 * phần tử (kéo-thả), loại bỏ seq đã chọn (xoá-nháp).
 */
import { describe, it, expect } from 'vitest'
import { hasDraftChanges, initialDraftOrder, moveElement, removeSeqs } from '../src/lib/project/filmstripSort'

describe('initialDraftOrder', () => {
  it('trả về [0..n-1] — mỗi seq đứng đúng vị trí gốc', () => {
    expect(initialDraftOrder(4)).toEqual([0, 1, 2, 3])
  })
  it('0 frame → mảng rỗng', () => {
    expect(initialDraftOrder(0)).toEqual([])
  })
})

describe('hasDraftChanges — quyết định mờ/disable "↺ Huỷ"', () => {
  it('draftOrder y hệt gốc → false (chưa có gì để huỷ)', () => {
    expect(hasDraftChanges(4, [0, 1, 2, 3])).toBe(false)
  })
  it('đổi thứ tự (hoán vị) → true', () => {
    expect(hasDraftChanges(4, [0, 1, 3, 2])).toBe(true)
  })
  it('xoá bớt (số lượng giảm) → true dù phần còn lại vẫn đúng thứ tự tương đối', () => {
    expect(hasDraftChanges(4, [0, 1, 3])).toBe(true)
  })
  it('rỗng ban đầu (0 frame) → false', () => {
    expect(hasDraftChanges(0, [])).toBe(false)
  })
})

describe('moveElement — kéo-thả đổi vị trí (mirror Array.moveElement iOS)', () => {
  it('kéo phần tử đầu xuống cuối', () => {
    expect(moveElement(['a', 'b', 'c', 'd'], 0, 3)).toEqual(['b', 'c', 'd', 'a'])
  })
  it('kéo phần tử cuối lên đầu', () => {
    expect(moveElement(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c'])
  })
  it('kéo giữa dải (2 vị trí liền kề)', () => {
    expect(moveElement([0, 1, 2, 3, 4], 1, 2)).toEqual([0, 2, 1, 3, 4])
  })
  it('from === to → mảng y hệt (bản sao mới, không sửa gốc)', () => {
    const arr = [1, 2, 3]
    const result = moveElement(arr, 1, 1)
    expect(result).toEqual([1, 2, 3])
    expect(result).not.toBe(arr) // bản sao mới, không phải cùng reference
  })
  it('index ngoài phạm vi → no-op an toàn (bản sao, không throw)', () => {
    expect(moveElement([1, 2, 3], -1, 2)).toEqual([1, 2, 3])
    expect(moveElement([1, 2, 3], 0, 9)).toEqual([1, 2, 3])
  })
  it('KHÔNG sửa mảng gốc (immutable)', () => {
    const arr = [1, 2, 3, 4]
    moveElement(arr, 0, 3)
    expect(arr).toEqual([1, 2, 3, 4])
  })
})

describe('removeSeqs — xoá-nháp (chỉ RAM, chưa ghi đĩa)', () => {
  it('loại đúng các seq đã chọn, giữ nguyên thứ tự phần còn lại', () => {
    expect(removeSeqs([3, 0, 2, 1], new Set([0, 2]))).toEqual([3, 1])
  })
  it('tập rỗng → giữ nguyên toàn bộ', () => {
    expect(removeSeqs([2, 1, 0], new Set())).toEqual([2, 1, 0])
  })
  it('xoá hết → mảng rỗng', () => {
    expect(removeSeqs([0, 1], new Set([0, 1]))).toEqual([])
  })
})
