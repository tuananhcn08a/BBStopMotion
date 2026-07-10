import { AppSettings, FpsLevel, GOAL_FRAMES_OPTIONS, Language } from '../types'
import { label, bilingualText } from '../i18n'
import { useCameraDevices } from '../hooks/useCameraDevices'
import styles from './SettingsScreen.module.css'

interface Props {
  settings: AppSettings
  onChange: (patch: Partial<AppSettings>) => void
}

const SPEED_LEVELS: { level: FpsLevel; icon: string; fps: number }[] = [
  { level: 'slow', icon: '🐢', fps: 1 },
  { level: 'normal', icon: '🐇', fps: 6 },
  { level: 'fast', icon: '⚡', fps: 12 },
]

function Toggle({ checked, onChange, testId }: { checked: boolean; onChange: (v: boolean) => void; testId: string }) {
  return (
    <button
      type="button"
      className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      data-testid={testId}
    >
      <span className={styles.toggleKnob} />
    </button>
  )
}

export default function SettingsScreen({ settings, onChange }: Props) {
  const language = settings.language
  // F8 (T-BS35) — danh sách camera thật, KHÔNG mở stream riêng (xem useCameraDevices.ts).
  const { devices } = useCameraDevices()
  const titleLabel = label(language, 'settings.title')
  const subtitleLabel = label(language, 'settings.subtitle')
  // Redline 1h literal: "Cài đặt · Settings (dành cho Thợ Cả)" — title.sub ("Settings") PHẢI
  // ghép cùng subtitle, không được nuốt (bug T-BS11 #2 — QA phát hiện qua overlay bằng mắt,
  // Δ hình học không bắt được vì đây là 1 khối span, không đổi kích thước khung ngoài).
  const titleSecondary = [titleLabel.sub, subtitleLabel.main].filter(Boolean).join(' ')

  return (
    <div data-landmark="settings-screen">
      <div className={styles.title}>
        {titleLabel.main}{' '}
        {titleSecondary && <span className={styles.titleSub}>· {titleSecondary}</span>}
      </div>

      <div className={styles.card} style={{ marginTop: 14 }}>
        <div className={styles.row}>
          <span className={styles.iconChip}>📷</span>
          <div className={styles.rowText}>
            <div className={styles.rowName}>{label(language, 'settings.camera').main}</div>
            <div className={styles.rowDesc}>Chọn thiết bị camera đang dùng</div>
          </div>
          <select
            className={styles.dropdown}
            value={settings.cameraDeviceId ?? ''}
            onChange={e => onChange({ cameraDeviceId: e.target.value || null })}
            aria-label={label(language, 'settings.camera').main}
            data-testid="camera-dropdown"
          >
            <option value="">Mặc định</option>
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.row}>
          <span className={styles.iconChip}>👻</span>
          <div className={styles.rowText}>
            <div className={styles.rowName}>{label(language, 'settings.onion').main}</div>
            <div className={styles.rowDesc}>Độ mờ frame trước chồng lên live preview</div>
          </div>
          <div className={styles.sliderRow}>
            <input
              type="range"
              className={styles.slider}
              min={0}
              max={100}
              step={5}
              value={Math.round(settings.onionSkinOpacity * 100)}
              onChange={e => onChange({ onionSkinOpacity: Number(e.target.value) / 100 })}
              aria-label="Độ mờ onion skin"
              data-testid="onion-opacity-slider"
            />
            <span className={styles.sliderValue}>{Math.round(settings.onionSkinOpacity * 100)}%</span>
          </div>
        </div>

        <div className={styles.row}>
          <span className={styles.iconChip}>🐇</span>
          <div className={styles.rowText}>
            <div className={styles.rowName}>{label(language, 'settings.defaultSpeed').main}</div>
            <div className={styles.rowDesc}>Áp dụng khi bắt đầu phiên mới</div>
          </div>
          <div className={styles.segmented}>
            {SPEED_LEVELS.map(s => (
              <button
                key={s.level}
                className={`${styles.segItem} ${settings.defaultFpsLevel === s.level ? styles.segItemActive : ''}`}
                onClick={() => onChange({ defaultFpsLevel: s.level })}
                data-testid={`default-speed-${s.level}`}
              >
                {s.icon} {s.fps}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.row}>
          <span className={styles.iconChip}>🌐</span>
          <div className={styles.rowText}>
            <div className={styles.rowName}>{bilingualText(language, 'settings.language')}</div>
            <div className={styles.rowDesc}>Hiển thị song ngữ hoặc một ngôn ngữ</div>
          </div>
          <div className={styles.segmented}>
            {(['vi+en', 'vi', 'en'] as Language[]).map(l => (
              <button
                key={l}
                className={`${styles.segItem} ${settings.language === l ? styles.segItemActive : ''}`}
                onClick={() => onChange({ language: l })}
                data-testid={`language-${l}`}
              >
                {l === 'vi+en' && label(language, 'settings.langBoth').main}
                {l === 'vi' && label(language, 'settings.langVi').main}
                {l === 'en' && label(language, 'settings.langEn').main}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.row}>
          <span className={styles.iconChip}>🔊</span>
          <div className={styles.rowText}>
            <div className={styles.rowName}>{label(language, 'settings.sound').main}</div>
            <div className={styles.rowDesc}>Shutter sound on capture</div>
          </div>
          <Toggle checked={settings.soundEnabled} onChange={v => onChange({ soundEnabled: v })} testId="sound-toggle" />
        </div>

        <div className={styles.row}>
          <span className={styles.iconChip}>🎯</span>
          <div className={styles.rowText}>
            <div className={styles.rowName}>{label(language, 'settings.goalFrames').main}</div>
            <div className={styles.rowDesc}>Số frame gợi ý để phim đủ mượt</div>
          </div>
          <select
            className={styles.dropdown}
            value={settings.goalFrames}
            onChange={e => onChange({ goalFrames: Number(e.target.value) })}
            aria-label={label(language, 'settings.goalFrames').main}
            data-testid="goal-frames-select"
          >
            {GOAL_FRAMES_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt} frame</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.card} style={{ marginTop: 14 }}>
        <div className={styles.row}>
          <span className={styles.iconChip}>☁️</span>
          <div className={styles.rowText}>
            <div className={styles.rowName}>{label(language, 'settings.autoUpload').main}</div>
            <div className={styles.rowDesc}>Auto-upload + tạo QR sau khi xuất phim</div>
          </div>
          <Toggle checked={settings.autoUpload} onChange={v => onChange({ autoUpload: v })} testId="auto-upload-toggle" />
        </div>

        <div className={styles.row}>
          <span className={styles.iconChip}>🔌</span>
          <div className={styles.rowText}>
            <div className={styles.rowName}>{label(language, 'settings.thingbot').main}</div>
            <div className={styles.rowDesc}>IO1 🟢 chụp frame · IO2 🔴 tạo phim</div>
          </div>
          <span className={styles.statusBadge}>Không áp dụng trên web</span>
        </div>
      </div>
    </div>
  )
}
