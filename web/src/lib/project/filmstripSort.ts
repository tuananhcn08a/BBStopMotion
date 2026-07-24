/**
 * T-XW14 — logic THUẦN (không DOM/React) cho chế độ "🔀 Sắp xếp" transactional của Filmstrip,
 * mirror `FilmstripiOS` sort mode + `Array.moveElement` (`CaptureFrameGrouping.swift`).
 *
 * `draftOrder` là mảng seq GỐC (lúc vừa vào chế độ Sắp xếp, snapshot RAM) theo ĐÚNG thứ tự hiển
 * thị hiện tại của bản nháp: index của mảng = vị trí hiển thị (0-based), giá trị = seq CŨ tương
 * ứng. Kéo-thả/chọn-xoá trong lúc nháp CHỈ đổi mảng này (RAM) — KHÔNG đụng IndexedDB cho tới khi
 * commit ("✕ Xong"/rời màn) gọi `db.commitFrameOrder(projectId, draftOrder)` (xem `db.ts`).
 */

/** `draftOrder` khởi tạo khi vừa vào chế độ Sắp xếp — mỗi seq đứng ĐÚNG vị trí gốc của nó. */
export function initialDraftOrder(frameCount: number): number[] {
  return Array.from({ length: frameCount }, (_, i) => i)
}

/**
 * Có thay đổi nào so với thứ tự/tập hợp gốc chưa? (số lượng khác HOẶC bất kỳ vị trí nào lệch seq
 * gốc của nó) — dùng để mờ/disable "↺ Huỷ" khi chưa có gì để huỷ.
 */
export function hasDraftChanges(originalCount: number, draftOrder: number[]): boolean {
  if (draftOrder.length !== originalCount) return true
  return draftOrder.some((seq, i) => seq !== i)
}

/**
 * Di chuyển 1 phần tử từ vị trí `from` sang vị trí `to`, giữ nguyên thứ tự tương đối của các phần
 * tử còn lại (mirror `Array.moveElement` iOS). Trả về mảng MỚI (không sửa `arr` gốc). Index ngoài
 * phạm vi hoặc `from === to` → trả về bản sao y hệt (no-op an toàn, không throw).
 */
export function moveElement<T>(arr: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= arr.length || to < 0 || to >= arr.length || from === to) {
    return arr.slice()
  }
  const next = arr.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item as T)
  return next
}

/** Loại các seq đã chọn khỏi `draftOrder` (xoá-nháp, chỉ đổi RAM — chưa ghi đĩa). */
export function removeSeqs(draftOrder: readonly number[], seqsToRemove: ReadonlySet<number>): number[] {
  return draftOrder.filter(seq => !seqsToRemove.has(seq))
}
