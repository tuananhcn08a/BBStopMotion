import { Language } from '../types'
import { label } from '../i18n'
import styles from './WelcomeScreen.module.css'

interface Props {
  language: Language
  onStart: () => void
}

const STEPS = [
  { icon: '📷', titleVi: '1 · Chụp', titleEn: '1 · Capture', descVi: 'Sắp đặt nhân vật rồi chụp 30–50 tấm ảnh', descEn: 'Set up your characters then capture 30-50 photos' },
  { icon: '🎬', titleVi: '2 · Xuất phim', titleEn: '2 · Export', descVi: 'App tự ghép ảnh thành phim MP4 + GIF', descEn: 'The app stitches your photos into MP4 + GIF' },
  { icon: '📱', titleVi: '3 · Chia sẻ', titleEn: '3 · Share', descVi: 'Bố mẹ quét QR để tải phim về điện thoại', descEn: 'Parents scan the QR to download the movie' },
]

export default function WelcomeScreen({ language, onStart }: Props) {
  const title = label(language, 'welcome.title')
  const cta = label(language, 'welcome.cta')

  return (
    <div className={styles.screen} data-landmark="welcome-screen">
      <span className={`${styles.deco} ${styles.decoTl}`} aria-hidden="true">🎬</span>
      <span className={`${styles.deco} ${styles.decoTr}`} aria-hidden="true">⭐</span>
      <span className={`${styles.deco} ${styles.decoBl}`} aria-hidden="true">🎞️</span>
      <span className={`${styles.deco} ${styles.decoBr}`} aria-hidden="true">🤖</span>

      <div className={styles.logoRow}>
        <div className={styles.logoIcon}>BB</div>
        <div className={styles.wordmark}>
          BBStopMotion <span className={styles.wordmarkAccent}>studio</span>
        </div>
      </div>

      <div className={styles.titleWrap}>
        <h1 className={styles.title} data-landmark="welcome-title">
          {title.main}
        </h1>
        <p className={styles.sub}>
          {language === 'vi'
            ? 'Hôm nay con sẽ tự tay làm một bộ phim hoạt hình.'
            : 'Welcome to the animation studio — hôm nay con sẽ tự tay làm một bộ phim hoạt hình.'}
        </p>
      </div>

      <div className={styles.cards}>
        {STEPS.map(step => (
          <div className={styles.card} key={step.titleVi}>
            <div className={styles.cardIcon}>{step.icon}</div>
            <div className={styles.cardTitle}>{language === 'en' ? step.titleEn : step.titleVi}</div>
            <div className={styles.cardDesc}>{language === 'en' ? step.descEn : step.descVi}</div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className={styles.cta}
        onClick={onStart}
        data-landmark="welcome-cta"
      >
        {cta.main}{cta.sub ? ` · ${cta.sub}` : ''} 🚀
      </button>
      <div className={styles.ctaHint}>
        {language === 'en'
          ? 'Or press the green 🟢 button on the desk to start right away'
          : 'Hoặc bấm nút xanh 🟢 trên bàn để bắt đầu ngay'}
      </div>
    </div>
  )
}
