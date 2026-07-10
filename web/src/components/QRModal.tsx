/**
 * F7 — Modal mã QR mở từ nút "QR" trong Library (BA Scenario: TS-BS-21, P0).
 *
 * Tái dùng cách render QR của SuccessScreen.tsx (`QRCode.toDataURL`, cùng màu dark/light) để mã
 * luôn trỏ đúng `uploadUrl` (= `download_url`) của ĐÚNG phim đang mở, không lẫn phim khác — mỗi
 * lần mở modal nhận `uploadUrl` riêng của entry đó qua props, không có state toàn cục dùng chung.
 *
 * Đóng modal: nút × / click nền (backdrop) / phím Esc — KHÔNG dùng alert/confirm của trình duyệt.
 *
 * Trường hợp phòng thủ: nếu `uploadUrl` rỗng (phim chưa upload) thì hiện thông báo hướng dẫn thay
 * vì mã QR trống — LibraryScreen chỉ render nút "QR" khi đã có `uploadUrl`, nhưng modal vẫn tự an
 * toàn khi được gọi ở trạng thái này (vd race condition khi upload vừa thất bại).
 */
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Language } from '../types'
import { label } from '../i18n'
import styles from './QRModal.module.css'

interface Props {
  language: Language
  title: string
  uploadUrl?: string
  onClose: () => void
}

export default function QRModal({ language, title, uploadUrl, onClose }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!uploadUrl) {
      setQrDataUrl(null)
      return
    }
    let cancelled = false
    QRCode.toDataURL(uploadUrl, {
      width: 220,
      margin: 2,
      color: { dark: '#1C3255', light: '#FFFFFF' },
    })
      .then(url => { if (!cancelled) setQrDataUrl(url) })
      .catch(() => { /* ignore — modal falls back to notice-less empty state */ })
    return () => { cancelled = true }
  }, [uploadUrl])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const hasUpload = Boolean(uploadUrl)

  return (
    <div
      className={styles.backdrop}
      data-testid="qr-modal-backdrop"
      onClick={onClose}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={label(language, 'library.qrTitle').main}
        data-testid="qr-modal"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label={label(language, 'library.qrClose').main}
          data-testid="qr-modal-close"
        >
          ×
        </button>
        <div className={styles.title}>{title}</div>

        {hasUpload && qrDataUrl && (
          <>
            <img
              src={qrDataUrl}
              alt="QR code để tải phim"
              className={styles.qrBox}
              data-testid="qr-modal-image"
            />
            <div className={styles.hint}>{label(language, 'success.scan').main}</div>
          </>
        )}

        {!hasUpload && (
          <div className={styles.notice} data-testid="qr-modal-notice">
            {label(language, 'library.qrNotUploaded').main}
          </div>
        )}
      </div>
    </div>
  )
}
