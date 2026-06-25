import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { ExportResult } from '../types'
import styles from './SuccessScreen.module.css'

interface Props {
  result: ExportResult
  onNewFilm: () => void
}

export default function SuccessScreen({ result, onNewFilm }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    // Generate download URL from blob
    const url = URL.createObjectURL(result.blob)
    setDownloadUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [result.blob])

  useEffect(() => {
    if (result.uploadUrl) {
      QRCode.toDataURL(result.uploadUrl, {
        width: 220,
        margin: 2,
        color: { dark: '#0F1923', light: '#FFFFFF' },
      }).then(url => setQrDataUrl(url)).catch(() => {/* ignore */})
    }
  }, [result.uploadUrl])

  const handleDownload = () => {
    if (!downloadUrl) return
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = result.filename
    a.click()
  }

  const handleRetryUpload = () => {
    setRetryCount(c => c + 1)
    // Retry logic would re-trigger upload — for MVP just show count
    // In production, this would call the upload function again
  }

  const hasUpload = Boolean(result.uploadUrl)
  const hasError = Boolean(result.uploadError)

  return (
    <div className={styles.screen}>
      {/* Confetti animation */}
      <div className={styles.confetti} aria-hidden="true">
        {['🎉', '⭐', '🎬', '🌟', '🎊'].map((emoji, i) => (
          <span key={i} className={styles.confettiItem} style={{ animationDelay: `${i * 0.12}s`, left: `${15 + i * 17}%` }}>
            {emoji}
          </span>
        ))}
      </div>

      <div className={styles.content}>
        <h1 className={styles.title}>Phim của con xong rồi!</h1>

        {hasError && (
          <div className={styles.uploadError} role="alert">
            <p>Tải lên chưa được — con vẫn có thể tải phim về máy nhé!</p>
            <button className={styles.retryUploadBtn} onClick={handleRetryUpload}>
              Thử tải lên lại {retryCount > 0 ? `(${retryCount})` : ''}
            </button>
          </div>
        )}

        {hasUpload && qrDataUrl && (
          <div className={styles.qrWrap}>
            <img src={qrDataUrl} alt="QR code để tải phim" className={styles.qr} />
            <p className={styles.qrHint}>Quét để xem phim trên điện thoại</p>
          </div>
        )}

        <div className={styles.actions}>
          <button
            className={styles.downloadBtn}
            onClick={handleDownload}
            aria-label="Tải phim về máy"
          >
            Tải về
          </button>
          <button
            className={styles.newFilmBtn}
            onClick={onNewFilm}
            aria-label="Làm phim mới, reset toàn bộ"
          >
            Làm phim mới
          </button>
        </div>
      </div>
    </div>
  )
}
