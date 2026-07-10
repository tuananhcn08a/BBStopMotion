import { useCallback, useEffect, useState } from 'react'

/**
 * Liệt kê camera đang cắm vào máy — dùng chung bởi `useCamera` (luồng chụp thật, cần stream)
 * và `SettingsScreen` (chỉ cần danh sách để chọn + lưu, KHÔNG mở stream riêng — tránh 2 luồng
 * camera cùng lúc). Nhãn thiết bị (`label`) chỉ có giá trị sau khi trình duyệt đã cấp quyền
 * camera ở bất kỳ đâu trong phiên (CaptureScreen luôn xin quyền trước khi Settings có thể mở tới).
 */
export async function listVideoInputDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const allDevices = await navigator.mediaDevices.enumerateDevices()
    return allDevices.filter(d => d.kind === 'videoinput')
  } catch {
    // enumerateDevices không khả dụng (trình duyệt cũ / môi trường test không mock) — trả rỗng,
    // không crash màn hình gọi nó.
    return []
  }
}

export interface UseCameraDevicesReturn {
  devices: MediaDeviceInfo[]
  refresh: () => Promise<void>
}

/** Hook cho SettingsScreen (F8) — enumerate danh sách camera, tự làm mới khi thiết bị
 *  cắm/rút (`devicechange`). KHÔNG gọi `getUserMedia` — không mở stream mới. */
export function useCameraDevices(): UseCameraDevicesReturn {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

  const refresh = useCallback(async () => {
    setDevices(await listVideoInputDevices())
  }, [])

  useEffect(() => {
    void refresh()

    const mediaDevices = navigator.mediaDevices
    if (!mediaDevices?.addEventListener) return
    mediaDevices.addEventListener('devicechange', refresh)
    return () => mediaDevices.removeEventListener('devicechange', refresh)
  }, [refresh])

  return { devices, refresh }
}
