import { FpsLevel, FPS_LABELS, FPS_ICONS, FPS_KEYS } from '../types'
import { ProjectKind } from '../lib/project/types'
import { fpsFor } from '../lib/project/fps'
import styles from './FpsSelector.module.css'

interface Props {
  value: FpsLevel
  onChange: (level: FpsLevel) => void
  /** T-XW05 AC7 — tra số fps hiển thị qua `fpsFor(kind, level)` thay vì bảng `FPS_VALUES` phẳng cũ
   *  (diary slow=3fps khác animation slow=1fps). Default 'animation' khớp Y HỆT hành vi cũ khi
   *  không có dự án bind (mọi call-site hiện có không truyền prop này vẫn chạy đúng như trước). */
  kind?: ProjectKind
}

const FPS_LEVELS: FpsLevel[] = ['slow', 'normal', 'fast']

export default function FpsSelector({ value, onChange, kind = 'animation' }: Props) {
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
            <span className={styles.key}>
              {fpsFor(kind, level)} fps
              <span className={styles.keyDesktop}> · phím {idx + 1}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export { FPS_KEYS }
