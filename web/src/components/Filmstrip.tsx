import { CapturedFrame, Language } from '../types'
import { label } from '../i18n'
import styles from './Filmstrip.module.css'

interface Props {
  frames: CapturedFrame[]
  selectedIndex: number
  language: Language
  /** F1 — xoá frame bất kỳ. Ẩn/vô hiệu khi đang ở chế độ xem lại (P). */
  onDeleteFrame: (index: number) => void
  disabled?: boolean
}

export default function Filmstrip({ frames, selectedIndex, language, onDeleteFrame, disabled = false }: Props) {
  const title = label(language, 'filmstrip.title')
  const hint = label(language, 'filmstrip.hint')

  return (
    <div className={styles.wrap} data-landmark="filmstrip">
      <div className={styles.header}>
        <span className={styles.title}>
          {title.main}
          {title.sub ? ` · ${title.sub}` : ''}
        </span>
        <span className={styles.hint}>
          <span className={styles.hintDesktop}>{hint.main}</span>
          <span className={styles.hintMobile}>{label(language, 'filmstrip.hintMobile').main}</span>
        </span>
      </div>
      <div
        className={styles.filmstrip}
        role="listbox"
        aria-label="Danh sách frame đã chụp"
        data-testid="filmstrip"
      >
        {frames.map((frame, i) => (
          <div
            key={frame.id}
            className={`${styles.thumb} ${i === selectedIndex ? styles.selected : ''}`}
            role="option"
            aria-selected={i === selectedIndex}
            aria-label={`Frame ${i + 1}`}
            tabIndex={0}
            data-testid={`thumb-${i}`}
          >
            <img src={frame.dataUrl} alt={`Frame ${i + 1}`} className={styles.thumbImg} />
            <span className={styles.thumbNum}>{i + 1}</span>
            {!disabled && (
              <>
                <span className={styles.thumbOutline} aria-hidden="true" />
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => onDeleteFrame(i)}
                  aria-label={`Xoá frame ${i + 1}`}
                  data-testid={`delete-frame-${i}`}
                >
                  ×
                </button>
              </>
            )}
          </div>
        ))}
        {/* Next slot (empty) */}
        <div className={styles.emptySlot} aria-label="Slot frame tiếp theo">
          <span className={styles.emptyPlus}>+</span>
          <span className={styles.emptyNum}>{frames.length + 1}</span>
        </div>
      </div>
    </div>
  )
}
