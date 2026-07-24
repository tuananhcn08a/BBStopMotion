import { Language, Screen } from '../types'
import { label, bilingualText } from '../i18n'
import styles from './Sidebar.module.css'

interface Props {
  screen: Screen
  onNavigate: (screen: Screen) => void
  /** 'full' = Capture (nav + progress card + help); 'compact' = Hub/Library/Settings (nav only). */
  variant: 'full' | 'compact'
  locked: boolean
  language: Language
  frameCount: number
  goalFrames: number
  /** T-XW05 — số dự án cho pill header mobile "N dự án" khi `screen==='hub'` (ẩn khi 0/undefined,
   *  khớp iOS `if !store.projects.isEmpty`). */
  hubProjectCount?: number
}

const NAV_ITEMS: { screen: Screen; icon: string; key: 'nav.hub' | 'nav.library' | 'nav.settings' }[] = [
  // T-XW05 — mục 1 đổi từ "🎥 Chụp phim" (thẳng vào Capture) sang "🎬 Xưởng phim" (Hub đa dự án,
  // mockup wave-1/mockup-hub-create.html, đã chốt).
  { screen: 'hub', icon: '🎬', key: 'nav.hub' },
  { screen: 'library', icon: '📽️', key: 'nav.library' },
  { screen: 'settings', icon: '⚙️', key: 'nav.settings' },
]

export default function Sidebar({
  screen, onNavigate, variant, locked, language, frameCount, goalFrames, hubProjectCount,
}: Props) {
  const progressPct = Math.min(frameCount / Math.max(goalFrames, 1), 1) * 100
  const remaining = Math.max(goalFrames - frameCount, 0)
  const goalReached = frameCount >= goalFrames

  // T-BS71 — tiêu đề header xanh mobile theo từng màn (redline §1.1). `screen` + `variant` đã đủ
  // phân biệt Capture(full)/Success(capture+compact)/Library/Settings — Export không tới đây vì
  // `locked` ẩn hẳn cả header+tab bar (xem .sidebar[data-locked="true"] mobile trong CSS module).
  // T-XW05 — thêm nhánh 'hub' (mockup mHeader "🎬 Xưởng phim").
  const mobileHeaderTitle = screen === 'hub'
    ? `🎬 ${bilingualText(language, 'nav.hub')}`
    : screen === 'library'
      ? bilingualText(language, 'nav.library')
      : screen === 'settings'
        ? bilingualText(language, 'settings.title')
        : 'BBStopMotion'

  return (
    <div
      className={styles.sidebar}
      data-landmark="sidebar"
      data-testid="sidebar"
      data-locked={locked ? 'true' : 'false'}
      style={locked ? { opacity: 0.55, pointerEvents: 'none' } : undefined}
      aria-hidden={locked}
    >
      {/* T-BS71 — header xanh mobile (redline §1.1). Ẩn mặc định (desktop), chỉ hiện
          @media (max-width:720px) qua Sidebar.module.css. */}
      <div className={styles.mobileHeader} data-landmark="mobile-header">
        <span className={styles.mobileHeaderTitle}>{mobileHeaderTitle}</span>
        {variant === 'full' && screen === 'capture' && (
          <span className={styles.mobileHeaderBadge} data-testid="mobile-header-badge">
            {frameCount} / {goalFrames} ⭐
          </span>
        )}
        {/* T-XW05 — pill "N dự án" (mockup mHeaderBadge Hub) — ẩn khi rỗng, khớp iOS
            `if !store.projects.isEmpty`. */}
        {screen === 'hub' && typeof hubProjectCount === 'number' && hubProjectCount > 0 && (
          <span className={styles.mobileHeaderBadge} data-testid="hub-header-count">
            {hubProjectCount} dự án
          </span>
        )}
      </div>

      <div className={styles.logoRow}>
        <div className={styles.logoIcon}>BB</div>
        <div className={styles.wordmark}>
          BBStopMotion <span className={styles.wordmarkAccent}>studio</span>
        </div>
      </div>

      <nav aria-label="Điều hướng chính" className={styles.navList}>
        {NAV_ITEMS.map(item => {
          // 'hub' nav luôn active khi đang ở Hub HOẶC đang Capture 1 dự án (Capture là sub-flow
          // điều hướng từ Hub, không phải mục nav riêng — mirror mockup tab bar mobile).
          const active = item.screen === 'hub' ? (screen === 'hub' || screen === 'capture') : screen === item.screen
          const { main, sub } = label(language, item.key)
          return (
            <button
              key={item.screen}
              type="button"
              className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
              onClick={() => !locked && onNavigate(item.screen)}
              disabled={locked}
              aria-current={active ? 'page' : undefined}
              data-landmark={`nav-${item.screen}`}
              data-testid={`nav-${item.screen}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span>
                {main}
                {sub && <span className={styles.navSub}>{sub}</span>}
              </span>
            </button>
          )
        })}
      </nav>

      {variant === 'full' && (
        <>
          <div className={styles.progressCard} data-landmark="progress-card">
            <div className={styles.progressLabel}>
              {label(language, 'progress.label').main}
              {label(language, 'progress.label').sub ? ` · ${label(language, 'progress.label').sub}` : ''}
            </div>
            <div className={styles.progressNum} data-testid="goal-progress-num">
              {frameCount} <span className={styles.progressGoal}>/ {goalFrames} {label(language, 'progress.frameUnit').main}</span>
            </div>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${progressPct}%` }} data-testid="goal-progress-fill" />
              <span className={styles.progressStar}>⭐</span>
            </div>
            <div className={styles.progressHint}>
              {goalReached
                ? label(language, 'progress.goalReached').main
                : <>{label(language, 'progress.remaining').main} <b>{remaining} frame</b> {label(language, 'progress.remainingSuffix').main}</>
              }
            </div>
          </div>

          {/* ThingBot card — ẨN trên web (Q7 chốt): web không có UART thật. */}
        </>
      )}

      <div className={styles.spacer} />

      {variant === 'full' && (
        <button type="button" className={styles.helpItem} disabled={locked}>
          <span>❓</span> {bilingualText(language, 'nav.help')}
        </button>
      )}
    </div>
  )
}
