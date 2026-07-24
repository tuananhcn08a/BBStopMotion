import { useCallback, useEffect, useRef, useState } from 'react'
import { CapturedFrame } from '../types'
import {
  clampZoom, dismissBackgroundOpacity, dismissDragFraction, dismissImageScale,
  doubleTapZoomToggle, positionBadgeText, resolveDragEnd,
} from '../lib/project/photoViewerGesture'
import styles from './PhotoViewer.module.css'

interface Props {
  frames: CapturedFrame[]
  initialIndex: number
  onClose: () => void
}

/** Dưới ngưỡng này (px) coi là "chạm/click" (không kéo) — mirror phân biệt tap-vs-drag cần thiết
 *  để 1 gesture handler DUY NHẤT (`onPointer*`) vừa xử lý đóng-bằng-click-nền vừa xử lý vuốt/kéo,
 *  không cần thêm `onClick` riêng cạnh tranh sự kiện (đúng tinh thần `unifiedDrag` iOS — xem
 *  `photoViewerGesture.ts` doc-comment đầu file). */
const TAP_MOVE_THRESHOLD = 6

/**
 * T-XW14 — Photo Viewer: overlay toàn màn nền đen, mirror `PhotoViewerScreeniOS.swift`. Toàn bộ
 * vuốt-ngang-chuyển-ảnh / vuốt-xuống-đóng / pan-khi-zoom / tap-nền-để-đóng đi qua ĐÚNG 1 bộ
 * listener Pointer Events (`onPointerDown/Move/Up/Cancel`) gắn trên overlay — KHÔNG tách gesture
 * riêng cho từng hành vi (bài học 3 vòng fix thật T-XP42/49/55: nhiều gesture cùng tầng tranh
 * nhau). Double-tap/double-click zoom dùng `onDoubleClick` (ngữ nghĩa khác hẳn — sự kiện click kép
 * rời rạc, không phải 1 lần kéo liên tục — nên không xung đột với gesture kéo thống nhất ở trên).
 */
export default function PhotoViewer({ frames, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(() => Math.min(Math.max(initialIndex, 0), Math.max(frames.length - 1, 0)))
  const [zoom, setZoom] = useState(1)
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const sizeRef = useRef({ width: 0, height: 0 })
  const pointerStart = useRef<{ x: number; y: number; id: number } | null>(null)
  const ignoreGesture = useRef(false)

  const clampedIndex = frames.length > 0 ? Math.min(Math.max(index, 0), frames.length - 1) : 0
  const frame = frames[clampedIndex]

  // AC2 — "rời ảnh (đổi index) → ảnh vừa rời tự reset về 1× (không giữ zoom giữa các lần xem)".
  useEffect(() => { setZoom(1) }, [clampedIndex])

  const measure = useCallback(() => {
    if (overlayRef.current) {
      const rect = overlayRef.current.getBoundingClientRect()
      sizeRef.current = { width: rect.width, height: rect.height }
    }
  }, [])

  useEffect(() => { measure() }, [measure])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('[data-viewer-control]')) {
      ignoreGesture.current = true
      return
    }
    ignoreGesture.current = false
    measure()
    pointerStart.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    setDrag({ dx: 0, dy: 0 })
  }, [measure])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (ignoreGesture.current || !pointerStart.current) return
    setDrag({ dx: e.clientX - pointerStart.current.x, dy: e.clientY - pointerStart.current.y })
  }, [])

  const endGesture = useCallback((e: React.PointerEvent) => {
    if (ignoreGesture.current) {
      ignoreGesture.current = false
      return
    }
    const start = pointerStart.current
    pointerStart.current = null
    if (!start) {
      setDrag(null)
      return
    }
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    const isZoomed = zoom > 1.01

    if (Math.abs(dx) < TAP_MOVE_THRESHOLD && Math.abs(dy) < TAP_MOVE_THRESHOLD) {
      setDrag(null)
      // Chạm/click nhẹ (không kéo) — chỉ đóng khi đúng NỀN ĐEN (ngoài ảnh/nút), khớp AC2 "click
      // vào nền đen ngoài ảnh đóng". Chạm/click lên ảnh (không kéo) không làm gì (double-click mới
      // toggle zoom — xử lý riêng ở `onDoubleClick`).
      const target = e.target as HTMLElement
      if (target === overlayRef.current) onClose()
      return
    }

    const { width, height } = sizeRef.current
    const outcome = resolveDragEnd({
      dx, dy, currentIndex: clampedIndex, count: frames.length, screenWidth: width, screenHeight: height, isZoomed,
    })
    setDrag(null)
    if (outcome.type === 'dismiss') onClose()
    else if (outcome.type === 'page') setIndex(outcome.newIndex)
  }, [zoom, clampedIndex, frames.length, onClose])

  const handleDoubleClick = useCallback(() => {
    setZoom(z => clampZoom(doubleTapZoomToggle(z)))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIndex(i => Math.min(frames.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [frames.length, onClose])

  if (!frame) return null

  const isZoomed = zoom > 1.01
  const isVertDrag = !!drag && Math.abs(drag.dy) > Math.abs(drag.dx)
  const dismissFraction = drag && isVertDrag && !isZoomed
    ? dismissDragFraction(Math.max(0, drag.dy), sizeRef.current.height)
    : 0

  let transform = ''
  if (drag && isZoomed) {
    transform = `scale(${zoom})`
  } else if (drag && isVertDrag) {
    transform = `translateY(${Math.max(0, drag.dy)}px) scale(${dismissImageScale(dismissFraction)})`
  } else if (drag) {
    transform = `translateX(${drag.dx}px)`
  } else if (isZoomed) {
    transform = `scale(${zoom})`
  }
  const backdropOpacity = dismissFraction > 0 ? dismissBackgroundOpacity(dismissFraction) : 1

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      style={{ background: `rgba(0, 0, 0, ${backdropOpacity})` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      role="dialog"
      aria-modal="true"
      aria-label="Xem ảnh lớn"
      data-testid="photo-viewer"
    >
      <img
        src={frame.dataUrl}
        alt={`Ảnh ${clampedIndex + 1}`}
        className={`${styles.image} ${drag ? styles.imageDragging : ''}`}
        style={transform ? { transform } : undefined}
        onDoubleClick={handleDoubleClick}
        draggable={false}
        data-testid="photo-viewer-image"
      />

      <button
        type="button"
        className={styles.closeBtn}
        data-viewer-control="true"
        onClick={onClose}
        aria-label="Đóng ảnh xem lớn"
        data-testid="photo-viewer-close"
      >
        ✕
      </button>

      <span className={styles.badge} data-testid="photo-viewer-badge">
        {positionBadgeText(clampedIndex, frames.length)}
      </span>

      <span className={styles.hintMobile}>⌄ vuốt xuống để đóng</span>
      <div className={styles.hintDesktop}>
        <span className={styles.keyPill}>← → đổi ảnh</span>
        <span className={styles.keyPill}>ESC đóng</span>
        <span className={styles.keyPill}>Chạm nền đen đóng</span>
      </div>
    </div>
  )
}
