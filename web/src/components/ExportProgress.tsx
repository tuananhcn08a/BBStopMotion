import styles from './ExportProgress.module.css'

export default function ExportProgress() {
  return (
    <div className={styles.screen} role="status" aria-live="polite" aria-label="Đang tạo phim">
      <div className={styles.icon}>🎬</div>
      <h1 className={styles.title}>Đang tạo phim của con...</h1>
      <div className={styles.spinner} />
      <p className={styles.hint}>Vui lòng đợi, con không tắt trang nhé!</p>
    </div>
  )
}
