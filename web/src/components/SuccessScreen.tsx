import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { ExportResult, Language } from '../types'
import { label, bilingualText } from '../i18n'
import { uploadExportedFile } from '../hooks/useExport'
import StepIndicator from './StepIndicator'
import styles from './SuccessScreen.module.css'

interface Props {
  result: ExportResult
  onNewFilm: () => void
  language: Language
  frameCount: number
  durationSeconds: number
  /** F8/Q6b — khi false, không auto-upload; hiện nút "Tải lên ngay" thủ công thay QR. */
  autoUpload: boolean
}

// QR "dark" module color — phải khớp `--color-text-primary` (tokens.css). Thư viện `qrcode`
// nhận literal hex, không đọc được CSS var trực tiếp, nên đọc `getComputedStyle` lúc runtime để
// không trôi giá trị so với token; fallback hex chỉ dùng khi tokens.css chưa load (SSR/vitest —
// jsdom test không bật CSS, xem ghi chú tests/2d-states.test.tsx).
const QR_DARK_FALLBACK = '#1C3255'

function getQrDarkColor(): string {
  if (typeof document === 'undefined') return QR_DARK_FALLBACK
  const fromToken = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-text-primary')
    .trim()
  return fromToken || QR_DARK_FALLBACK
}

/** Format an ISO-8601 date string to a friendly Vietnamese date, e.g. "3/7/2026". */
function formatExpiryDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

export default function SuccessScreen({ result, onNewFilm, language, frameCount, durationSeconds, autoUpload }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  // Manual upload state (F8 autoUpload=false, or retry after autoUpload failure)
  const [manualUploadUrl, setManualUploadUrl] = useState<string | undefined>(result.uploadUrl)
  const [manualExpiresAt, setManualExpiresAt] = useState<string | undefined>(result.expiresAt)
  const [manualError, setManualError] = useState<string | undefined>(result.uploadError)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    const url = URL.createObjectURL(result.blob)
    setDownloadUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [result.blob])

  useEffect(() => {
    if (manualUploadUrl) {
      QRCode.toDataURL(manualUploadUrl, {
        width: 220,
        margin: 2,
        color: { dark: getQrDarkColor(), light: '#FFFFFF' },
      }).then(url => setQrDataUrl(url)).catch(() => {/* ignore */})
    }
  }, [manualUploadUrl])

  // T-BS66 — bấm nút play trên khung video không phát vì trước đây chưa hề gắn onClick.
  // Toggle play/pause qua ref tới thẻ <video> thật (blob URL, playsInline sẵn có cho iOS).
  const handleTogglePlay = () => {
    const el = videoElRef.current
    if (!el) return
    if (el.paused || el.ended) {
      void el.play()
    } else {
      el.pause()
    }
  }

  // T-BS66 — trên iOS Safari, `<a download>` với blob URL bị bỏ qua (mở/điều hướng blob như
  // trang HTML thay vì tải file). Dùng Web Share API (`navigator.share({ files })`) khi trình
  // duyệt hỗ trợ — share sheet iOS cho phép "Lưu vào Files/Ảnh", đúng ý PO "chọn nơi lưu tuỳ ý".
  // Desktop / trình duyệt không hỗ trợ share file → fallback `<a download>` như cũ.
  const handleDownload = async () => {
    if (!downloadUrl) return

    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
      try {
        const file = new File([result.blob], result.filename, { type: result.blob.type || 'video/mp4' })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: result.filename })
          return
        }
      } catch (err) {
        // Bé bấm huỷ share sheet — không phải lỗi, không cần fallback.
        if (err instanceof Error && err.name === 'AbortError') return
        // Lỗi share khác (hiếm) → rơi xuống tải trực tiếp bên dưới.
      }
    }

    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = result.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const handleUploadNow = async () => {
    setIsUploading(true)
    setManualError(undefined)
    try {
      const uploaded = await uploadExportedFile(result.blob, result.filename)
      setManualUploadUrl(uploaded.downloadUrl)
      setManualExpiresAt(uploaded.expiresAt)
    } catch (err) {
      setManualError(err instanceof Error ? err.message : 'Upload thất bại')
    } finally {
      setIsUploading(false)
    }
  }

  const hasUpload = Boolean(manualUploadUrl)
  const hasError = Boolean(manualError)
  const expiryLabel = manualExpiresAt ? formatExpiryDate(manualExpiresAt) : ''

  return (
    <>
      <StepIndicator language={language} steps={['done', 'done', 'active']} />
      <div className={styles.wrap}>
        <span className={`${styles.deco} ${styles.decoTl}`} aria-hidden="true">🎉</span>
        <span className={`${styles.deco} ${styles.decoTr}`} aria-hidden="true">🎊</span>

        <div className={styles.content}>
          <div className={styles.titleWrap}>
            <h1 className={styles.title}>{label(language, 'success.title').main}</h1>
            {/* Redline 2c literal: "Your movie is ready — 42 frame · 4.2 giây · MP4 + GIF" —
                tiền tố EN chỉ hiện khi language != 'vi' (F4: 'vi' ẩn hoàn toàn hậu tố tiếng Anh). */}
            <p className={styles.sub}>
              {language !== 'vi' ? 'Your movie is ready — ' : ''}
              {frameCount} {label(language, 'progress.frameUnit').main} · {durationSeconds.toFixed(1)} giây · MP4 + GIF
            </p>
          </div>

          <div className={styles.cardsRow}>
            <div className={styles.videoCard} data-landmark="video-player">
              {downloadUrl && (
                <video
                  ref={videoElRef}
                  src={downloadUrl}
                  className={styles.videoEl}
                  muted
                  loop
                  playsInline
                  aria-label="Xem lại phim đã ghép"
                  data-testid="success-video"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />
              )}
              {!isPlaying && (
                <button
                  className={styles.playBtn}
                  aria-label="Phát phim"
                  type="button"
                  onClick={handleTogglePlay}
                  data-testid="success-play-btn"
                >
                  ▶
                </button>
              )}
              <div className={styles.watermark}>watermark BBStopMotion</div>
            </div>

            {hasUpload && qrDataUrl && (
              <div className={styles.qrCard} data-landmark="qr-card">
                <img src={qrDataUrl} alt="QR code để tải phim" className={styles.qrBox} />
                <div className={styles.qrLabel}>{label(language, 'success.scan').main}</div>
                <div className={styles.qrExpiry} data-testid="parent-notice">
                  Phim lưu <b>7 ngày</b>{expiryLabel ? ` (đến ${expiryLabel})` : ''}, chỉ ai có mã này mới tải được.
                </div>
              </div>
            )}

            {!hasUpload && hasError && (
              <div className={styles.uploadErrorCard} role="alert">
                <div className={styles.errorText}>{label(language, 'success.uploadFailed').main}</div>
                <button className={styles.retryUploadBtn} onClick={() => void handleUploadNow()} disabled={isUploading}>
                  {label(language, 'success.retryUpload').main}
                </button>
              </div>
            )}

            {!hasUpload && !hasError && !autoUpload && (
              <div className={styles.notUploadedCard} data-testid="not-uploaded-card">
                <div className={styles.noticeText}>{label(language, 'success.notUploadedYet').main}</div>
                <button
                  className={styles.uploadNowBtn}
                  onClick={() => void handleUploadNow()}
                  disabled={isUploading}
                  data-testid="upload-now-btn"
                >
                  {isUploading ? '...' : label(language, 'success.uploadNow').main}
                </button>
              </div>
            )}
          </div>

          <div className={styles.buttonsRow}>
            <button
              className={styles.downloadBtn}
              onClick={() => void handleDownload()}
              aria-label="Tải phim về máy"
            >
              ⬇ {bilingualText(language, 'success.download')}
            </button>
            <button
              className={styles.newFilmBtn}
              onClick={onNewFilm}
              aria-label="Làm phim mới, reset toàn bộ"
            >
              🔁 {bilingualText(language, 'success.newFilm')}
            </button>
          </div>

          <div className={styles.footerHint}>Bấm nút xanh 🟢 để bắt đầu phim mới ngay lập tức</div>
        </div>
      </div>
    </>
  )
}
