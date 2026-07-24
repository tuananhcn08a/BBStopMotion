import { useCallback, useRef } from 'react'
import { CapturedFrame } from '../types'
import {
  NORMALIZED_HEIGHT, NORMALIZED_MIME, NORMALIZED_QUALITY, NORMALIZED_WIDTH, drawNormalizedFrame,
} from '../lib/project/imageNormalize'

export interface UseCaptureReturn {
  captureFrame: (video: HTMLVideoElement) => CapturedFrame | null
  deleteLastFrame: (frames: CapturedFrame[]) => CapturedFrame[]
  deleteFrameAt: (frames: CapturedFrame[], index: number) => CapturedFrame[]
  getOnionSkinFrame: (frames: CapturedFrame[]) => CapturedFrame | null
}

export function useCapture(): UseCaptureReturn {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // T-XW09 — canvas kích thước CỐ ĐỊNH 1280×720 (KHÔNG nhân devicePixelRatio), tạo 1 lần và tái
  // dùng cho mọi frame (không còn resize theo video.videoWidth/Height mỗi lần chụp như trước).
  const getCanvas = useCallback((): HTMLCanvasElement => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
      canvasRef.current.width = NORMALIZED_WIDTH
      canvasRef.current.height = NORMALIZED_HEIGHT
    }
    return canvasRef.current
  }, [])

  // T-XW09 AC1/AC2 — normalize NGAY LÚC CHỤP: crop-fill khung camera hiện tại (giữ tỉ lệ, không
  // méo, không viền đen) vào canvas cố định 1280×720, encode JPEG q0.85 MỘT LẦN duy nhất. Frame
  // lưu xuống IndexedDB (qua `db.addFrame`, App.tsx) và export (ffmpeg.wasm, `useExport.ts`) dùng
  // THẲNG bytes này — không re-encode/downscale lần nữa (AC3).
  // T-XW17 — `drawNormalizedFrame` dùng CHUNG với import ảnh (`importImage.ts`), KHÔNG tự
  // `computeCropFillSourceRect`+`drawImage` riêng ở đây nữa (1 điểm crop-fill duy nhất toàn app).
  const captureFrame = useCallback((video: HTMLVideoElement): CapturedFrame | null => {
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null
    const canvas = getCanvas()
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    drawNormalizedFrame(ctx, video, video.videoWidth, video.videoHeight)
    const dataUrl = canvas.toDataURL(NORMALIZED_MIME, NORMALIZED_QUALITY)
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

  /**
   * F1 — xoá frame bất kỳ theo index, re-index tự nhiên vì thứ tự hiển thị luôn theo
   * vị trí mảng (TS-BS-01/02/03). Trả về mảng mới, không mutate.
   */
  const deleteFrameAt = useCallback((frames: CapturedFrame[], index: number): CapturedFrame[] => {
    if (index < 0 || index >= frames.length) return frames
    return [...frames.slice(0, index), ...frames.slice(index + 1)]
  }, [])

  const getOnionSkinFrame = useCallback((frames: CapturedFrame[]): CapturedFrame | null => {
    if (frames.length === 0) return null
    return frames[frames.length - 1] ?? null
  }, [])

  return { captureFrame, deleteLastFrame, deleteFrameAt, getOnionSkinFrame }
}
