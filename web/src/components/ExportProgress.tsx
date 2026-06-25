import styles from './ExportProgress.module.css'

interface ExportProgressProps {
  message?: string
}

export default function ExportProgress({ message }: ExportProgressProps) {
  const displayMessage = message && message.length > 0
    ? message
    : 'Đang tạo phim của con...'

  return (
    <div className={styles.screen} role="status" aria-live="polite" aria-label="Đang tạo phim">
      <div className={styles.icon}>🎬</div>
      <h1 className={styles.title}>{displayMessage}</h1>
      <div className={styles.spinner} />
      <p className={styles.hint}>Vui lòng đợi, con không tắt trang nhé!</p>
    </div>
  )
}
