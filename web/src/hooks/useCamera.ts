import { useState, useEffect, useRef, useCallback } from 'react'

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'disconnected' | 'error'

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  status: CameraStatus
  requestCamera: () => Promise<void>
  stream: MediaStream | null
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [stream, setStream] = useState<MediaStream | null>(null)

  const requestCamera = useCallback(async () => {
    setStatus('requesting')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current = s
      setStream(s)
      setStatus('active')

      if (videoRef.current) {
        videoRef.current.srcObject = s
      }

      // Handle track end (camera disconnected)
      s.getVideoTracks()[0]?.addEventListener('ended', () => {
        setStatus('disconnected')
        setStream(null)
      })
    } catch (err) {
      if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        setStatus('denied')
      } else {
        setStatus('error')
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  useEffect(() => {
    if (videoRef.current && stream && status === 'active') {
      videoRef.current.srcObject = stream
    }
  }, [stream, status])

  return { videoRef, status, requestCamera, stream }
}
