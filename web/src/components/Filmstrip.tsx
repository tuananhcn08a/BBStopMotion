import { CapturedFrame } from '../types'
import styles from './Filmstrip.module.css'

interface Props {
  frames: CapturedFrame[]
  selectedIndex: number
}

export default function Filmstrip({ frames, selectedIndex }: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.title}>Các frame đã chụp</span>
        <span className={styles.pill}>{frames.length} frame</span>
      </div>
      <div
        className={styles.filmstrip}
        role="listbox"
        aria-label="Danh sách frame đã chụp"
      >
        {frames.map((frame, i) => (
          <div
            key={frame.id}
            className={`${styles.thumb} ${i === selectedIndex ? styles.selected : ''}`}
            role="option"
            aria-selected={i === selectedIndex}
            aria-label={`Frame ${i + 1}`}
            tabIndex={0}
          >
            <img src={frame.dataUrl} alt={`Frame ${i + 1}`} className={styles.thumbImg} />
            <span className={styles.thumbNum}>{i + 1}</span>
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
