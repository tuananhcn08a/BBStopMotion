import { useEffect } from 'react'
import { useCamera } from '../hooks/useCamera'
import styles from './PermissionScreen.module.css'

interface Props {
  onGranted: () => void
}

export default function PermissionScreen({ onGranted }: Props) {
  const { status, requestCamera } = useCamera()

  useEffect(() => {
    void requestCamera()
  }, [requestCamera])

  useEffect(() => {
    if (status === 'active') {
      onGranted()
    }
  }, [status, onGranted])

  if (status === 'denied') {
    return (
      <div className={styles.screen}>
        <div className={styles.icon}>📷</div>
        <h1 className={styles.title}>Con chưa cho app dùng camera</h1>
        <p className={styles.desc}>
          Cho phép camera để bắt đầu làm phim nhé! Bấm vào biểu tượng khoá trên thanh địa chỉ trình duyệt để bật lại quyền camera.
        </p>
        <button
          className={styles.retryBtn}
          onClick={() => void requestCamera()}
          aria-label="Thử lại yêu cầu quyền camera"
        >
          Thử lại
        </button>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      <div className={styles.icon}>🎬</div>
      <h1 className={styles.title}>Xưởng phim của bé</h1>
      <p className={styles.desc}>Đang xin quyền camera...</p>
      <div className={styles.spinner} aria-label="Đang tải" />
    </div>
  )
}
