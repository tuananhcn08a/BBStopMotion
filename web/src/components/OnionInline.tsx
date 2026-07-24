import { useState } from 'react'
import { Language } from '../types'
import { label } from '../i18n'
import styles from './OnionInline.module.css'

interface Props {
  language: Language
  /** Đọc/ghi THẲNG cùng giá trị `onionSkinOpacity` với slider Cài đặt — không state riêng. */
  opacity: number
  onOpacityChange: (opacity: number) => void
  /** Độ mờ nhớ lại khi bật lại sau khi tắt (T-XP58 `onionSkinLastOpacity`). */
  lastOpacity: number
}

/**
 * T-XW10 AC5 — onion config INLINE 3 trạng thái, mirror iOS T-XP58/68 `onionControl`:
 * ① TẮT (opacity===0) = icon 👻 trần, chạm → bật lại (khôi phục `lastOpacity`).
 * ② BẬT gọn ("👻 N%") = chạm → bung sang trạng thái ③ (KHÔNG tự tắt).
 * ③ ĐANG CHỈNH (slider bung) = kéo đổi opacity (bước 5%, khớp `onionSkinRow` Cài đặt), nút 👻 bên
 *   trái thu gọn lại về ②.
 * Đồng bộ 2 CHIỀU với slider Cài đặt "miễn phí" vì cả 2 nơi đọc/ghi CÙNG 1 giá trị
 * `settings.onionSkinOpacity` qua props — không có state riêng ngoài `isExpanded` (thuần UI, cục bộ).
 */
export default function OnionInline({ language, opacity, onOpacityChange, lastOpacity }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isOn = opacity > 0
  const percent = Math.round(opacity * 100)

  if (!isOn) {
    return (
      <button
        type="button"
        className={styles.iconBtn}
        onClick={() => onOpacityChange(lastOpacity > 0 ? lastOpacity : 0.4)}
        aria-label={label(language, 'onion.off').main}
        data-testid="onion-inline-off"
      >
        👻
      </button>
    )
  }

  if (!isExpanded) {
    return (
      <button
        type="button"
        className={styles.compact}
        onClick={() => setIsExpanded(true)}
        aria-label={`${label(language, 'onion.onCompact').main} — ${percent}%`}
        data-testid="onion-inline-compact"
      >
        <span aria-hidden="true">👻</span>
        <span className={styles.pct}>{percent}%</span>
      </button>
    )
  }

  return (
    <div className={styles.expanded} data-testid="onion-inline-expanded">
      <button
        type="button"
        className={styles.collapseBtn}
        onClick={() => setIsExpanded(false)}
        aria-label={label(language, 'onion.collapse').main}
        data-testid="onion-inline-collapse"
      >
        👻
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={percent}
        onChange={e => onOpacityChange(Number(e.target.value) / 100)}
        className={styles.slider}
        aria-label={label(language, 'onion.opacityLabel').main}
        data-testid="onion-inline-slider"
      />
      <span className={styles.pct}>{percent}%</span>
    </div>
  )
}
