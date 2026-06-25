import { useCallback, useState } from 'react'
import { CapturedFrame, ExportResult, FpsLevel, FPS_VALUES } from '../types'

// Upload endpoint — devops will implement this. See DEVOPS_INTERFACE.md
const UPLOAD_ENDPOINT = import.meta.env.VITE_UPLOAD_ENDPOINT ?? ''

async function uploadFile(blob: Blob, filename: string): Promise<string> {
  if (!UPLOAD_ENDPOINT) throw new Error('Upload endpoint not configured')
  const form = new FormData()
  form.append('file', blob, filename)
  form.append('filename', filename)
  const res = await fetch(UPLOAD_ENDPOINT, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  const data = await res.json() as { url: string }
  return data.url
}

async function assembleVideoMediaRecorder(
  frames: CapturedFrame[],
  fps: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const img = new Image()

    // Determine dimensions from first frame
    img.onload = () => {
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas context unavailable')); return }

      const stream = canvas.captureStream(fps)
      const options: MediaRecorderOptions = {}
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        options.mimeType = 'video/webm;codecs=vp9'
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        options.mimeType = 'video/webm;codecs=vp8'
      }

      const recorder = new MediaRecorder(stream, options)
      const chunks: Blob[] = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }))
      recorder.onerror = () => reject(new Error('MediaRecorder error'))

      recorder.start()

      let frameIdx = 0
      const frameInterval = 1000 / fps

      const drawNext = () => {
        if (frameIdx >= frames.length) {
          recorder.stop()
          stream.getTracks().forEach(t => t.stop())
          return
        }
        const frame = frames[frameIdx]
        if (!frame) { recorder.stop(); return }
        const fImg = new Image()
        fImg.onload = () => {
          ctx.drawImage(fImg, 0, 0, canvas.width, canvas.height)
          frameIdx++
          setTimeout(drawNext, frameInterval)
        }
        fImg.onerror = () => { frameIdx++; setTimeout(drawNext, frameInterval) }
        fImg.src = frame.dataUrl
      }

      drawNext()
    }
    img.onerror = () => reject(new Error('Failed to load first frame'))
    img.src = frames[0]?.dataUrl ?? ''
  })
}

export interface UseExportReturn {
  exportVideo: (frames: CapturedFrame[], fpsLevel: FpsLevel) => Promise<ExportResult>
  isExporting: boolean
}

export function useExport(): UseExportReturn {
  const [isExporting, setIsExporting] = useState(false)

  const exportVideo = useCallback(async (
    frames: CapturedFrame[],
    fpsLevel: FpsLevel,
  ): Promise<ExportResult> => {
    setIsExporting(true)
    try {
      const fps = FPS_VALUES[fpsLevel]
      const blob = await assembleVideoMediaRecorder(frames, fps)
      const filename = `neo-stopmotion-${Date.now()}.webm`

      let uploadUrl: string | undefined
      let uploadError: string | undefined

      try {
        uploadUrl = await uploadFile(blob, filename)
      } catch (err) {
        uploadError = err instanceof Error ? err.message : 'Upload thất bại'
      }

      return { blob, filename, uploadUrl, uploadError }
    } finally {
      setIsExporting(false)
    }
  }, [])

  return { exportVideo, isExporting }
}
