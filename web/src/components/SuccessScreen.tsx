import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { ExportResult, Language } from '../types'
import { label } from '../i18n'
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
        color: { dark: '#1C3255', light: '#FFFFFF' },
      }).then(url => setQrDataUrl(url)).catch(() => {/* ignore */})
    }
  }, [manualUploadUrl])

  const handleDownload = () => {
    if (!downloadUrl) return
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = result.filename
    a.click()
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
            <p className={styles.sub}>{frameCount} frame · {durationSeconds.toFixed(1)}s · MP4 + GIF</p>
          </div>

          <div className={styles.cardsRow}>
            <div className={styles.videoCard} data-landmark="video-player">
              {downloadUrl && (
                <video src={downloadUrl} className={styles.videoEl} muted loop playsInline aria-label="Xem lại phim đã ghép" />
              )}
              <button className={styles.playBtn} aria-label="Phát phim" type="button">▶</button>
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
              onClick={handleDownload}
              aria-label="Tải phim về máy"
            >
              ⬇ {label(language, 'success.download').main}
            </button>
            <button
              className={styles.newFilmBtn}
              onClick={onNewFilm}
              aria-label="Làm phim mới, reset toàn bộ"
            >
              🔁 {label(language, 'success.newFilm').main}
            </button>
          </div>

          <div className={styles.footerHint}>Bấm nút xanh 🟢 để bắt đầu phim mới ngay lập tức</div>
        </div>
      </div>
    </>
  )
}
