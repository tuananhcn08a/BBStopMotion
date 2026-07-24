/**
 * T-XW14 — logic THUẦN (không DOM/React) cho Photo Viewer, port 1:1 từ iOS
 * `iOS/Views/PhotoViewerScreeniOS.swift` `enum PhotoViewerGesture` (đã qua 3 vòng fix thật trên
 * device T-XP42/49/55 — xem doc-comment gốc trong file Swift để hiểu TẠI SAO chỉ được dùng ĐÚNG 1
 * gesture handler thống nhất, không tách pan/dismiss/page thành nhiều gesture riêng).
 *
 * Web port: 1 pointer-drag handler duy nhất (`PhotoViewer.tsx`) gọi `resolveDragEnd` khi buông tay
 * — không tách listener riêng cho swipe-ngang/vuốt-xuống/pan-khi-zoom, tránh lặp lại đúng lớp bug
 * iOS đã gặp (nhiều gesture cùng loại tranh nhau, "con" luôn thắng "cha").
 */

export function clampZoom(scale: number): number {
  return Math.min(Math.max(scale, 1), 4)
}

/** Double-tap/double-click toggle 1× ↔ 2.5×. */
export function doubleTapZoomToggle(current: number): number {
  return current > 1.01 ? 1 : 2.5
}

/** Badge "Ảnh N / M" — `index` 0-based, hiển thị 1-based (khớp iOS, chỉ tiếng Việt, không cặp song ngữ). */
export function positionBadgeText(index: number, total: number): string {
  return `Ảnh ${index + 1} / ${total}`
}

export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0
  return Math.min(Math.max(index, 0), count - 1)
}

/** Ngưỡng đóng khi vuốt xuống: >120px HOẶC >25% chiều cao màn. */
export function shouldDismiss(dragHeight: number, screenHeight: number): boolean {
  return dragHeight > 120 || (screenHeight > 0 && dragHeight > screenHeight * 0.25)
}

/** 0..1 — bao nhiêu % hành trình đóng đã kéo được. */
export function dismissDragFraction(dragHeight: number, screenHeight: number): number {
  if (screenHeight <= 0 || dragHeight <= 0) return 0
  return Math.min(dragHeight / screenHeight, 1)
}

/** Ảnh co nhỏ dần khi vuốt xuống (tối đa co 18% ở fraction=1). */
export function dismissImageScale(fraction: number): number {
  return 1 - Math.min(Math.max(fraction, 0), 1) * 0.18
}

/** Nền mờ dần theo % khoảng kéo, dừng ở 0.35 (không mờ hẳn về 0). */
export function dismissBackgroundOpacity(fraction: number): number {
  return Math.max(1 - Math.min(Math.max(fraction, 0), 1) * 0.65, 0.35)
}

/** Chỉ coi là kéo-để-đóng khi phương thẳng đứng CHIẾM ƯU THẾ hơn ngang. */
export function isVerticalDominant(dx: number, dy: number): boolean {
  return Math.abs(dy) > Math.abs(dx)
}

/** Ngưỡng chuyển trang khi vuốt ngang: >60px HOẶC >20% chiều rộng màn. */
export function shouldPageAdvance(dragWidth: number, screenWidth: number): boolean {
  return Math.abs(dragWidth) > 60 || (screenWidth > 0 && Math.abs(dragWidth) > screenWidth * 0.2)
}

/**
 * Trang đích khi kết thúc vuốt ngang — vuốt sang trái (`dragWidth<0`) → ảnh kế tiếp, vuốt sang
 * phải → ảnh trước. Chưa đạt ngưỡng hoặc đã ở biên (đầu/cuối dự án) → giữ nguyên trang hiện tại.
 */
export function resolvedPageIndex(currentIndex: number, dragWidth: number, screenWidth: number, count: number): number {
  if (!shouldPageAdvance(dragWidth, screenWidth)) return currentIndex
  const delta = dragWidth < 0 ? 1 : -1
  return clampIndex(currentIndex + delta, count)
}

/** Offset ngang SỐNG của khung trang đang hiện trong lúc kéo (trước khi buông tay). */
export function pageContainerOffset(currentIndex: number, dragWidth: number, screenWidth: number): number {
  return -currentIndex * screenWidth + dragWidth
}

export type DragOutcome =
  | { type: 'page'; newIndex: number }
  | { type: 'dismiss' }
  | { type: 'cancel' }

/**
 * Kết quả khi buông ngón tay/chuột từ gesture DUY NHẤT — quyết cả 3 khả năng theo hướng trội
 * (`isVerticalDominant`) + trạng thái zoom.
 */
export function resolveDragEnd(params: {
  dx: number
  dy: number
  currentIndex: number
  count: number
  screenWidth: number
  screenHeight: number
  isZoomed: boolean
}): DragOutcome {
  const { dx, dy, currentIndex, count, screenWidth, screenHeight, isZoomed } = params
  if (isZoomed) return { type: 'cancel' }

  if (isVerticalDominant(dx, dy)) {
    const dragHeight = Math.max(0, dy)
    return shouldDismiss(dragHeight, screenHeight) ? { type: 'dismiss' } : { type: 'cancel' }
  }
  const newIndex = resolvedPageIndex(currentIndex, dx, screenWidth, count)
  return newIndex === currentIndex ? { type: 'cancel' } : { type: 'page', newIndex }
}
