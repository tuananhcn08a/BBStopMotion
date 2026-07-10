import { Language } from '../types'
import { label } from '../i18n'
import styles from './StepIndicator.module.css'

export type StepStatus = 'done' | 'active' | 'pending'

interface Props {
  language: Language
  /** Trạng thái từng bước 1=Chụp, 2=Xuất, 3=Chia sẻ. */
  steps: [StepStatus, StepStatus, StepStatus]
  /** Copy phụ cho bước 1 khi done (vd "42 frame") — theo redline 2b "✓ Chụp · 42 frame". */
  captureDoneSuffix?: string
  /**
   * Mặc định `true` — đặt `data-landmark="step-indicator"` lên chính div này. Ở 2a, hàng
   * step-indicator trong mockup là 1 flex row DUY NHẤT gồm cả 3 chip + spacer + toggle Onion
   * skin — landmark cần đặt ở wrapper NGOÀI (CaptureScreen) thay vì ở đây, nếu không sẽ đo
   * hụt phần onion-toggle/spacer khi so khớp mockup.
   */
  landmarkOnSelf?: boolean
}

const KEYS = ['step.capture', 'step.export', 'step.share'] as const

export default function StepIndicator({ language, steps, captureDoneSuffix, landmarkOnSelf = true }: Props) {
  return (
    <div className={styles.row} data-landmark={landmarkOnSelf ? 'step-indicator' : undefined}>
      {steps.map((status, i) => {
        const { main, sub } = label(language, KEYS[i])
        const text = sub ? `${main} · ${sub}` : main
        const chipClass =
          status === 'active' ? styles.chipActive : status === 'done' ? styles.chipDone : styles.chipPending
        return (
          <span key={KEYS[i]} style={{ display: 'contents' }}>
            {i > 0 && <span className={styles.sep}>›</span>}
            <span className={`${styles.chip} ${chipClass}`} data-testid={`step-${i + 1}`}>
              {status === 'done' && '✓ '}
              {status === 'active' && (
                <span className={`${styles.bubble} ${styles.bubbleActive}`}>{i + 1}</span>
              )}
              {status === 'pending' && (
                <span className={`${styles.bubble} ${styles.bubblePending}`}>{i + 1}</span>
              )}
              {text}
              {i === 0 && status === 'done' && captureDoneSuffix ? ` · ${captureDoneSuffix}` : ''}
            </span>
          </span>
        )
      })}
    </div>
  )
}
