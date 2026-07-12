import { useState, useEffect, useRef, useCallback } from 'react'
import { listVideoInputDevices } from './useCameraDevices'

export type CameraState = 'requesting' | 'live' | 'denied' | 'no-device'

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  state: CameraState
  stream: MediaStream | null
  devices: MediaDeviceInfo[]
  activeDeviceId: string | null
  requestCamera: () => Promise<void>
  switchCamera: (deviceId: string) => Promise<void>
  error: string | null
}

const CAMERA_TIMEOUT_MS = 5000

/** Điện thoại/tablet thật (touch + màn hẹp) — không nhận nhầm laptop có màn cảm ứng. Dùng để
 *  mặc định mở camera SAU (facingMode environment) trên mobile: app chụp vật làm phim đặt trước
 *  ống kính, không phải chụp selfie. Desktop (không touch, hoặc touch nhưng màn rộng) giữ nguyên
 *  hành vi cũ — trình duyệt tự chọn camera mặc định. */
function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  // Chỉ dùng maxTouchPoints — `'ontouchstart' in window` không đáng tin: nhiều trình duyệt
  // (kể cả jsdom) khai báo sẵn thuộc tính event-handler này dù máy không có màn cảm ứng thật.
  const hasTouch = navigator.maxTouchPoints > 0
  const narrow = window.innerWidth <= 820
  return hasTouch && narrow
}

/**
 * @param preferredDeviceId Camera đã chọn ở Settings (F8, `settings.cameraDeviceId`), áp dụng
 *   MỘT LẦN lúc mount (CaptureScreen unmount/remount mỗi lần chuyển màn nên "áp lúc mount" là đủ
 *   — không cần theo dõi thay đổi sau đó). `undefined`/`null` → dùng camera mặc định của trình duyệt.
 */
export function useCamera(preferredDeviceId?: string | null): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const initialDeviceIdRef = useRef(preferredDeviceId ?? null)

  const [state, setState] = useState<CameraState>('requesting')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const enumerateDevices = useCallback(async () => {
    setDevices(await listVideoInputDevices())
  }, [])

  const stopCurrentStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setStream(null)
  }, [])

  const requestCamera = useCallback(async (deviceId?: string | null) => {
    setState('requesting')
    setError(null)

    // Stop previous stream before requesting new one
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    // T-BS66 — deviceId cụ thể (Settings hoặc switchCamera) luôn thắng. Không thì trên mobile
    // ưu tiên camera SAU (`ideal` — không `exact` để không rớt OverconstrainedError trên máy chỉ
    // có 1 camera/không hỗ trợ facingMode, vd fake device trong e2e test).
    const constraints: MediaStreamConstraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : isMobileDevice()
          ? { facingMode: { ideal: 'environment' } }
          : true,
      audio: false,
    }

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('timeout')),
        CAMERA_TIMEOUT_MS,
      ),
    )

    try {
      const s = await Promise.race([
        navigator.mediaDevices.getUserMedia(constraints),
        timeoutPromise,
      ])

      streamRef.current = s
      setStream(s)
      setState('live')
      setError(null)

      // Set activeDeviceId from stream
      const track = s.getVideoTracks()[0]
      const settings = track?.getSettings()
      if (settings?.deviceId) {
        setActiveDeviceId(settings.deviceId)
      }

      // Attach to video element if available
      if (videoRef.current) {
        videoRef.current.srcObject = s
      }

      // Enumerate after getting stream (labels become available post-permission)
      await enumerateDevices()

      // Handle track end (camera disconnected)
      track?.addEventListener('ended', () => {
        setState('denied')
        setStream(null)
        streamRef.current = null
        setError('Camera bị ngắt. Bấm Thử lại.')
      })
    } catch (err) {
      stopCurrentStream()

      // Normalise: DOMException is not always an instanceof Error in jsdom
      const errName: string = (err as { name?: string }).name ?? ''
      const errMessage: string = (err as { message?: string }).message ?? ''

      if (errMessage === 'timeout') {
        setState('denied')
        setError(
          'Trình duyệt chưa cho phép camera. Bấm vào biểu tượng camera trên thanh địa chỉ để cấp quyền.',
        )
      } else if (
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError' ||
        errName === 'SecurityError'
      ) {
        setState('denied')
        setError('Con chưa cho app dùng camera. Bấm "Thử lại" hoặc cho phép camera trong cài đặt trình duyệt nhé!')
      } else if (
        errName === 'NotFoundError' ||
        errName === 'DevicesNotFoundError' ||
        errName === 'OverconstrainedError'
      ) {
        setState('no-device')
        setError('Không tìm thấy camera. Con thử cắm camera vào rồi bấm Thử lại nhé!')
      } else {
        setState('denied')
        setError('Không thể kết nối camera. Bấm "Thử lại" nhé!')
      }

      // Enumerate even on failure so dropdown can show available devices
      await enumerateDevices()
    }
  }, [enumerateDevices, stopCurrentStream])

  const switchCamera = useCallback(
    async (deviceId: string) => {
      setActiveDeviceId(deviceId)
      await requestCamera(deviceId)
    },
    [requestCamera],
  )

  // Mount: request camera immediately (dùng deviceId đã lưu ở Settings nếu có) + enumerate
  // devices. requestCamera/enumerateDevices ổn định (useCallback deps rỗng/gần rỗng) nên effect
  // này chỉ chạy 1 lần lúc mount — initialDeviceIdRef không phải dep vì chỉ đọc giá trị lúc mount.
  useEffect(() => {
    void enumerateDevices()
    void requestCamera(initialDeviceIdRef.current)
  }, [enumerateDevices, requestCamera])

  // Attach stream to video element whenever stream or videoRef changes
  useEffect(() => {
    if (videoRef.current && stream && state === 'live') {
      videoRef.current.srcObject = stream
    }
  }, [stream, state])

  // Cleanup streams on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  return {
    videoRef,
    state,
    stream,
    devices,
    activeDeviceId,
    requestCamera: () => requestCamera(activeDeviceId),
    switchCamera,
    error,
  }
}
