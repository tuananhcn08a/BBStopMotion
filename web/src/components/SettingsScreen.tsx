import { useEffect, useState } from 'react'
import { AppSettings, FpsLevel, GOAL_FRAMES_OPTIONS, Language } from '../types'
import { label, bilingualText } from '../i18n'
import { useCameraDevices } from '../hooks/useCameraDevices'
import { getStorageEstimate, requestPersistentStorage, StorageEstimateResult } from '../lib/project/storageGuard'
import styles from './SettingsScreen.module.css'

interface Props {
  settings: AppSettings
  onChange: (patch: Partial<AppSettings>) => void
  /** T-XW21 S5 — mở lại màn giới thiệu app iPhone (điểm vào (b), "chủ động xem lại bất cứ lúc nào"). */
  onOpenAppIntro?: () => void
}

/** [ARCH] ngưỡng cảnh báo dung lượng — PO chưa chốt số cụ thể (mockup ghi "còn mở"), web-dev tự
 *  quyết hợp lý theo Autonomy §8 WORKING-WITH-PO: >=80% cảnh báo (vàng), >=95% nguy hiểm (đỏ). */
const STORAGE_WARN_PCT = 80
const STORAGE_DANGER_PCT = 95

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

export default function SettingsScreen({ settings, onChange, onOpenAppIntro }: Props) {
  const language = settings.language
  // F8 (T-BS35) — danh sách camera thật, KHÔNG mở stream riêng (xem useCameraDevices.ts).
  const { devices } = useCameraDevices()
  const titleLabel = label(language, 'settings.title')

  // T-XW21 — Storage 3 lớp: lớp 1 (persist) + lớp 2 (đồng hồ dung lượng), đọc lại mỗi lần vào Cài
  // đặt (mockup: "cập nhật mỗi lần vào Cài đặt" — không cache xuyên phiên).
  const [persistGranted, setPersistGranted] = useState<boolean | null>(null)
  const [estimate, setEstimate] = useState<StorageEstimateResult>({})

  useEffect(() => {
    let cancelled = false
    requestPersistentStorage().then(granted => { if (!cancelled) setPersistGranted(granted) })
    getStorageEstimate().then(est => { if (!cancelled) setEstimate(est) })
    return () => { cancelled = true }
  }, [])

  const usagePct = estimate.usageBytes !== undefined && estimate.quotaBytes
    ? Math.min(100, Math.round((estimate.usageBytes / estimate.quotaBytes) * 100))
    : 0
  const gaugeColor = usagePct >= STORAGE_DANGER_PCT
    ? 'var(--color-error)'
    : usagePct >= STORAGE_WARN_PCT ? 'var(--color-warn-text)' : 'var(--color-primary)'
  const formatMb = (bytes?: number) => (bytes !== undefined ? `${(bytes / (1024 * 1024)).toFixed(0)} MB` : '?')
  // PO chốt 2026-07-13 (T-BS78): bỏ hẳn "(dành cho Thợ Cả)"/"(for the Studio Lead)" — tiêu đề
  // chỉ còn "Cài đặt · Settings" (titleLabel.sub = "Settings" khi language='vi+en', null khi
  // chỉ 1 ngôn ngữ nên không hiện phần phụ thừa).
  const titleSecondary = titleLabel.sub

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

        {/* T-XW21 S5 — điểm vào (b): chủ động xem lại giới thiệu app iPhone bất cứ lúc nào. */}
        {onOpenAppIntro && (
          <button type="button" className={`${styles.row} ${styles.rowClickable}`} onClick={onOpenAppIntro} data-testid="settings-app-intro-row">
            <span className={styles.iconChip}>📲</span>
            <div className={styles.rowText}>
              <div className={styles.rowName}>{label(language, 'appIntro.settingsRow').main}</div>
              <div className={styles.rowDesc}>{label(language, 'appIntro.settingsRowDesc').main}</div>
            </div>
            <span aria-hidden="true">›</span>
          </button>
        )}
      </div>

      {/* T-XW21 — Storage 3 lớp (quyết định #14: vị trí = Cài đặt). */}
      <div className={styles.card} style={{ marginTop: 14 }} data-testid="storage-card">
        <div className={styles.storageTitle}>💾 {label(language, 'settings.storageTitle').main}</div>

        <div className={styles.layerRow}>
          <div className={styles.layerNum}>1</div>
          <div className={styles.layerBody}>
            <div className={styles.layerLabel}>{label(language, 'settings.storagePersistLabel').main}</div>
            {persistGranted === null ? null : persistGranted ? (
              <span className={`${styles.persistBadge} ${styles.persistBadgeGranted}`} data-testid="storage-persist-granted">
                ✓ {label(language, 'settings.storagePersistGranted').main}
              </span>
            ) : (
              <span className={`${styles.persistBadge} ${styles.persistBadgeDenied}`} data-testid="storage-persist-denied">
                ⚠️ {label(language, 'settings.storagePersistDenied').main}
              </span>
            )}
            <div className={styles.layerDesc}>{label(language, 'settings.storagePersistDesc').main}</div>
          </div>
        </div>

        <div className={styles.layerRow}>
          <div className={styles.layerNum}>2</div>
          <div className={styles.layerBody}>
            <div className={styles.layerLabel}>{label(language, 'settings.storageGaugeLabel').main}</div>
            <div className={styles.gaugeTrack}>
              <div className={styles.gaugeFill} style={{ width: `${usagePct}%`, background: gaugeColor }} data-testid="storage-gauge-fill" />
            </div>
            <div className={styles.gaugeText} data-testid="storage-gauge-text">
              {language === 'en' ? 'Using' : 'Đang dùng'} <b>{formatMb(estimate.usageBytes)}</b>
              {estimate.quotaBytes !== undefined ? ` / ${formatMb(estimate.quotaBytes)}` : ''}
            </div>
            <div className={styles.layerDesc}>{label(language, 'settings.storageGaugeDesc').main}</div>
          </div>
        </div>

        <div className={styles.layerRow}>
          <div className={styles.layerNum}>3</div>
          <div className={styles.layerBody}>
            <div className={styles.layerLabel}>{label(language, 'settings.storageHomeScreenLabel').main}</div>
            <div className={styles.homeTip}>{label(language, 'settings.storageHomeScreenTip').main}</div>
          </div>
        </div>

        <div className={styles.layerRow}>
          <div className={styles.layerNum}>•</div>
          <div className={styles.layerBody}>
            <div className={styles.layerLabel} style={{ color: 'var(--color-text-secondary)' }}>
              {label(language, 'settings.storageFinalLabel').main}
            </div>
            <div className={styles.layerDesc}>{label(language, 'settings.storageFinalDesc').main}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
