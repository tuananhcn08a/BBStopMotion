import { FpsLevel, FPS_LABELS, FPS_ICONS, FPS_KEYS, FPS_VALUES } from '../types'
import styles from './FpsSelector.module.css'

interface Props {
  value: FpsLevel
  onChange: (level: FpsLevel) => void
}

const FPS_LEVELS: FpsLevel[] = ['slow', 'normal', 'fast']

export default function FpsSelector({ value, onChange }: Props) {
  return (
    <div className={styles.card} data-landmark="speed-card">
      <div className={styles.label}>TỐC ĐỘ · SPEED</div>
      <div className={styles.seg} role="group" aria-label="Chọn tốc độ phim">
        {FPS_LEVELS.map((level, idx) => (
          <button
            key={level}
            className={`${styles.segBtn} ${value === level ? styles.active : ''}`}
            onClick={() => onChange(level)}
            aria-pressed={value === level}
            aria-label={`${FPS_LABELS[level]} — phím ${idx + 1}`}
          >
            <span>{FPS_ICONS[level]} {FPS_LABELS[level]}</span>
            <span className={styles.key}>{FPS_VALUES[level]} fps · phím {idx + 1}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export { FPS_KEYS }
