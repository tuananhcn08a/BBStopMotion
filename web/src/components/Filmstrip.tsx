import { useCallback, useRef } from 'react'
import { CapturedFrame, Language } from '../types'
import { label } from '../i18n'
import styles from './Filmstrip.module.css'

interface Props {
  frames: CapturedFrame[]
  selectedIndex: number
  language: Language
  disabled?: boolean
  /** T-XW14 — chạm thumbnail NGOÀI chế độ Sắp xếp → mở Photo Viewer xem to. */
  onOpenViewer?: (index: number) => void

  // ---------- T-XW14 — chế độ "🔀 Sắp xếp" transactional (THAY nút "×" xoá-ngay cũ) ----------
  /** Đang ở chế độ Sắp xếp hay không — false thì `frames` hiển thị y hệt filmstrip thường (cũ). */
  isSortMode: boolean
  /** seq GỐC song song 1-1 với `frames` hiện tại (đổi vị trí theo `frames` khi kéo-thả nháp). */
  draftOrder: number[]
  /** Tập seq đang được TICK CHỌN để xoá (nháp — chưa ghi đĩa). */
  selectedSeqs: ReadonlySet<number>
  /** "↺ Huỷ" chỉ active khi có thay đổi (mờ/disable khi false). */
  hasDraftChanges: boolean
  onEnterSortMode: () => void
  onToggleSelect: (seq: number) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onRevertSort: () => void
  onFinishSort: () => void
  onDeleteSelected: () => void
}

const DRAG_MOVE_THRESHOLD = 8

export default function Filmstrip({
  frames, selectedIndex, language, disabled = false, onOpenViewer,
  isSortMode, draftOrder, selectedSeqs, hasDraftChanges,
  onEnterSortMode, onToggleSelect, onReorder, onRevertSort, onFinishSort, onDeleteSelected,
}: Props) {
  const title = label(language, 'filmstrip.title')
  const hint = label(language, 'filmstrip.hint')

  // ---------- Kéo-thả (Sắp xếp) — 1 bộ Pointer Events DUY NHẤT/thumb, tự phân biệt chạm=chọn vs
  // giữ+kéo=đổi thứ tự bằng ngưỡng di chuyển (khớp tinh thần "1 gesture handler thống nhất" của
  // Photo Viewer — không tách listener click riêng cạnh tranh sự kiện). ----------
  const dragState = useRef<{ startX: number; startY: number; fromIndex: number; dragging: boolean } | null>(null)

  const handleThumbPointerDown = useCallback((e: React.PointerEvent, index: number) => {
    if (!isSortMode) return
    dragState.current = { startX: e.clientX, startY: e.clientY, fromIndex: index, dragging: false }
  }, [isSortMode])

  const handleThumbPointerMove = useCallback((e: React.PointerEvent, hoverIndex: number) => {
    const st = dragState.current
    if (!st) return
    const dx = e.clientX - st.startX
    const dy = e.clientY - st.startY
    if (!st.dragging) {
      if (Math.abs(dx) < DRAG_MOVE_THRESHOLD && Math.abs(dy) < DRAG_MOVE_THRESHOLD) return
      st.dragging = true
    }
    if (hoverIndex !== st.fromIndex) {
      onReorder(st.fromIndex, hoverIndex)
      st.fromIndex = hoverIndex
    }
  }, [onReorder])

  const handleThumbPointerUp = useCallback((seq: number) => {
    const st = dragState.current
    dragState.current = null
    if (!st || !st.dragging) {
      // Chạm nhẹ (không kéo) trong chế độ Sắp xếp → toggle chọn để xoá.
      onToggleSelect(seq)
    }
  }, [onToggleSelect])

  const selectedCount = selectedSeqs.size
  const canSort = frames.length > 0

  return (
    <div className={styles.wrap} data-landmark="filmstrip">
      <div className={styles.header}>
        {isSortMode ? (
          <>
            <span className={styles.title}>{label(language, 'filmstrip.sortHint').main}</span>
            <div className={styles.sortActions}>
              <button
                type="button"
                className={styles.undoPill}
                onClick={onRevertSort}
                disabled={!hasDraftChanges}
                aria-disabled={!hasDraftChanges}
                data-testid="sort-undo-btn"
              >
                ↺ {label(language, 'filmstrip.sortUndo').main}
              </button>
              <button
                type="button"
                className={styles.donePill}
                onClick={onFinishSort}
                data-testid="sort-done-btn"
              >
                ✕ {label(language, 'filmstrip.sortDone').main}
              </button>
            </div>
          </>
        ) : (
          <>
            <span className={styles.title}>
              {title.main}
              {title.sub ? ` · ${title.sub}` : ''}
            </span>
            <span className={styles.hint}>
              <span className={styles.hintDesktop}>{hint.main}</span>
              <span className={styles.hintMobile}>{label(language, 'filmstrip.hintMobile').main}</span>
            </span>
            {!disabled && (
              <button
                type="button"
                className={styles.sortPill}
                onClick={onEnterSortMode}
                disabled={!canSort}
                aria-disabled={!canSort}
                data-testid="sort-enter-btn"
              >
                🔀 {label(language, 'filmstrip.sortEnter').main}
              </button>
            )}
          </>
        )}
      </div>

      <div
        className={styles.filmstrip}
        role="listbox"
        aria-label="Danh sách frame đã chụp"
        data-testid="filmstrip"
      >
        {frames.map((frame, i) => {
          const seq = draftOrder[i]
          const isSelected = isSortMode ? selectedSeqs.has(seq) : i === selectedIndex
          const isLatest = !isSortMode && i === frames.length - 1
          return (
            <div
              key={frame.id}
              className={[
                styles.thumb,
                isLatest ? styles.selected : '',
                isSortMode ? styles.sortable : '',
                isSortMode && isSelected ? styles.dimmed : '',
              ].filter(Boolean).join(' ')}
              role="option"
              aria-selected={isSortMode ? isSelected : i === selectedIndex}
              aria-label={`Frame ${i + 1}`}
              tabIndex={0}
              data-testid={`thumb-${i}`}
              data-seq={seq}
              onPointerDown={isSortMode ? (e) => handleThumbPointerDown(e, i) : undefined}
              onPointerMove={isSortMode ? (e) => handleThumbPointerMove(e, i) : undefined}
              onPointerUp={isSortMode ? () => handleThumbPointerUp(seq) : undefined}
              onPointerCancel={isSortMode ? () => { dragState.current = null } : undefined}
              onClick={!isSortMode && onOpenViewer ? () => onOpenViewer(i) : undefined}
            >
              {/* `draggable={false}` — CHẶN native HTML5 image drag: <img> mặc định draggable=true
                  trong Chrome, mousedown+move trên ảnh sẽ bị trình duyệt "nuốt" thành thao tác kéo
                  ảnh gốc (dragstart/dragover) thay vì tiếp tục phát Pointer Events cho gesture kéo-
                  thả tự viết ở trên — CHẶN NGAY từ đầu để chỉ 1 gesture handler (Pointer Events)
                  hoạt động, khớp bài học "unifiedDrag" của Photo Viewer (đừng để 2 cơ chế kéo tranh
                  nhau). Phát hiện qua e2e drag thật (Chrome) — jsdom không có native DnD nên unit
                  test không bắt được lớp bug này. */}
              <img src={frame.dataUrl} alt={`Frame ${i + 1}`} className={styles.thumbImg} draggable={false} />
              {/* T-XW10 AC4 — badge vị trí "N{số}" (khớp iOS DiaryFilmstripiOS/FilmstripiOS
                  positionLabel) — filmstrip vốn ĐÃ phẳng (không nhóm ngày), chỉ đổi format nhãn. */}
              <span className={styles.thumbNum}>N{i + 1}</span>
              {isSortMode && (
                <span
                  className={`${styles.selDot} ${isSelected ? styles.selDotChecked : ''}`}
                  aria-hidden="true"
                  data-testid={`sel-dot-${i}`}
                >
                  {isSelected ? '✓' : ''}
                </span>
              )}
            </div>
          )
        })}
        {/* Next slot (empty) — ẩn trong chế độ Sắp xếp (không có gì để "chụp tiếp" khi đang sửa). */}
        {!isSortMode && (
          <div className={styles.emptySlot} aria-label="Slot frame tiếp theo">
            <span className={styles.emptyPlus}>+</span>
            <span className={styles.emptyNum}>{frames.length + 1}</span>
          </div>
        )}
      </div>

      {isSortMode && selectedCount > 0 && (
        <div className={styles.selectionBar} data-testid="sort-selection-bar">
          <span className={styles.selectionBarText}>
            {language === 'en' ? `Selected ${selectedCount} photos` : `Đã chọn ${selectedCount} ảnh`}
          </span>
          <button
            type="button"
            className={styles.deleteChip}
            onClick={onDeleteSelected}
            data-testid="sort-delete-selected-btn"
          >
            🗑 {label(language, 'filmstrip.sortDeleteChip').main}
          </button>
        </div>
      )}
    </div>
  )
}
