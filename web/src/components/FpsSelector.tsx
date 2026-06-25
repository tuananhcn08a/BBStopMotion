import { FpsLevel, FPS_LABELS, FPS_ICONS, FPS_KEYS } from '../types'
import styles from './FpsSelector.module.css'

interface Props {
  value: FpsLevel
  onChange: (level: FpsLevel) => void
}

const FPS_LEVELS: FpsLevel[] = ['slow', 'normal', 'fast']

export default function FpsSelector({ value, onChange }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.label}>Tốc độ phim</div>
      <div className={styles.seg} role="group" aria-label="Chọn tốc độ phim">
        {FPS_LEVELS.map((level, idx) => (
          <button
            key={level}
            className={`${styles.segBtn} ${value === level ? styles.active : ''}`}
            onClick={() => onChange(level)}
            aria-pressed={value === level}
            aria-label={`${FPS_LABELS[level]} — phím ${idx + 1}`}
          >
            <span className={styles.emoji}>{FPS_ICONS[level]}</span>
            <span>{FPS_LABELS[level]}</span>
            <span className={styles.key}>{idx + 1}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export { FPS_KEYS }
