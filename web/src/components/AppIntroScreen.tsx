/**
 * T-XW21 (S5) — Giới thiệu app iOS (mirror mockup T-XW18, quyết định #11 po-handoff §3).
 * 2 điểm vào: (a) tự động ngay sau khi tạo dự án 🌱 Nhật ký ĐẦU TIÊN, (b) chủ động từ Cài đặt —
 * NỘI DUNG GIỐNG NHAU dù vào từ đâu. "Để sau" ghi nhớ 1 lần, KHÔNG hiện lại kể cả phiên sau
 * (App.tsx sở hữu cờ persist qua `onLater`) — khác backdrop/ESC/nút ✕ (đóng thường, KHÔNG persist,
 * để lần vào Cài đặt sau vẫn xem lại được nếu muốn).
 *
 * Responsive: mobile ≤720px = nút "Tải trên App Store" bấm THẲNG (đang cầm chính thiết bị);
 * desktop = QR thật (không ai quét QR trên máy đang dùng) — reuse `AppStoreQr` (SVG đã verify).
 * KHÔNG nhắc macOS (đang chờ Apple review, mockup ghi rõ).
 */
import { useEffect } from 'react'
import { Language } from '../types'
import { label } from '../i18n'
import AppStoreQr from './AppStoreQr'
import styles from './AppIntroScreen.module.css'

/** [BINDING po-handoff §3] link App Store thật — id6789743028, đã verify qua QR (T-XW18). */
export const APP_STORE_URL = 'https://apps.apple.com/vn/app/bbstopmotion/id6789743028'

interface Props {
  language: Language
  /** Đóng THƯỜNG (backdrop/ESC/✕) — KHÔNG persist "đã xem", có thể hiện lại lần sau. */
  onClose: () => void
  /** Bấm "Để sau" — App.tsx ghi cờ persist (KHÔNG tự động hiện lại) rồi đóng. */
  onLater: () => void
}

export default function AppIntroScreen({ language, onClose, onLater }: Props) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className={styles.backdrop} data-testid="app-intro-backdrop" onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={label(language, 'appIntro.title').main}
        data-testid="app-intro-screen"
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.grabber} aria-hidden="true" />
        <div className={styles.title}>
          {label(language, 'appIntro.title').main}
          <small>{label(language, 'appIntro.title').sub ?? 'Also on iPhone'}</small>
        </div>

        <p className={styles.nudgeCopy}>
          {label(language, 'appIntro.body1').main}{' '}
          <span className={styles.newSentence}>{label(language, 'appIntro.body2').main}</span>{' '}
          <span className={styles.newSentence}>{label(language, 'appIntro.body3').main}</span>
        </p>

        <div className={styles.appCard}>
          <div className={styles.appIcon} aria-hidden="true">🎬</div>
          <div className={styles.appCardTxt}>
            <b>{label(language, 'appIntro.appName').main}</b>
            <span>{label(language, 'appIntro.appMeta').main}</span>
          </div>
        </div>

        {/* Mobile: nút bấm thẳng (đang cầm chính thiết bị). Desktop: QR thật (CSS ẩn/hiện theo breakpoint). */}
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noreferrer"
          className={styles.ctaStore}
          data-testid="app-intro-store-btn"
        >
          📲 {label(language, 'appIntro.storeCta').main}
        </a>

        <div className={styles.qrRow} data-testid="app-intro-qr-row">
          <AppStoreQr className={styles.qrBox} />
          <p>
            <b>{label(language, 'appIntro.qrTitle').main}</b>
            <br />
            {label(language, 'appIntro.qrHint').main}
          </p>
        </div>

        <button type="button" className={styles.ctaGhost} onClick={onLater} data-testid="app-intro-later-btn">
          {label(language, 'appIntro.later').main}
        </button>
      </div>
    </div>
  )
}
