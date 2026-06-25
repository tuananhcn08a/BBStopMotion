import { useCallback, useRef } from 'react'
import { CapturedFrame } from '../types'

export interface UseCaptureReturn {
  captureFrame: (video: HTMLVideoElement) => CapturedFrame | null
  deleteLastFrame: (frames: CapturedFrame[]) => CapturedFrame[]
  getOnionSkinFrame: (frames: CapturedFrame[]) => CapturedFrame | null
}

export function useCapture(): UseCaptureReturn {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const getCanvas = useCallback((width: number, height: number): HTMLCanvasElement => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
    }
    canvasRef.current.width = width
    canvasRef.current.height = height
    return canvasRef.current
  }, [])

  const captureFrame = useCallback((video: HTMLVideoElement): CapturedFrame | null => {
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null
    const canvas = getCanvas(video.videoWidth, video.videoHeight)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    return {
      id: `frame-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dataUrl,
      timestamp: Date.now(),
    }
  }, [getCanvas])

  const deleteLastFrame = useCallback((frames: CapturedFrame[]): CapturedFrame[] => {
    if (frames.length === 0) return frames
    return frames.slice(0, -1)
  }, [])

  const getOnionSkinFrame = useCallback((frames: CapturedFrame[]): CapturedFrame | null => {
    if (frames.length === 0) return null
    return frames[frames.length - 1] ?? null
  }, [])

  return { captureFrame, deleteLastFrame, getOnionSkinFrame }
}
