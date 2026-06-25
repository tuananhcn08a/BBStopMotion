import { useCallback, useState } from 'react'
import type { FFmpeg } from '@ffmpeg/ffmpeg'
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

// Module-level cache: ffmpeg instance is lazy-loaded once and reused
let ffmpegInstance: FFmpeg | null = null

/** Reset the cached FFmpeg instance. For use in tests only. */
export function _resetFfmpegInstance(): void {
  ffmpegInstance = null
}

async function loadFfmpeg(onProgress?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance
  onProgress?.('Đang chuẩn bị phần mềm ghép phim...')
  const { FFmpeg } = await import('@ffmpeg/ffmpeg')
  const { toBlobURL } = await import('@ffmpeg/util')
  const ffmpeg = new FFmpeg()
  const baseURL = '/ffmpeg'
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })
  ffmpegInstance = ffmpeg
  return ffmpeg
}

export async function exportToMp4(
  frames: string[],
  fps: number,
  onProgress?: (msg: string) => void,
): Promise<Blob> {
  const ffmpeg = await loadFfmpeg(onProgress)
  const { fetchFile } = await import('@ffmpeg/util')
  // Write each frame as input000.jpg, input001.jpg, ...
  for (let i = 0; i < frames.length; i++) {
    const name = `input${String(i).padStart(3, '0')}.jpg`
    await ffmpeg.writeFile(name, await fetchFile(frames[i] ?? ''))
  }
  onProgress?.('Đang ghép phim...')
  await ffmpeg.exec([
    '-framerate', String(fps),
    '-i', 'input%03d.jpg',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    'output.mp4',
  ])
  const data = await ffmpeg.readFile('output.mp4')
  return new Blob([data], { type: 'video/mp4' })
}

export interface UseExportReturn {
  exportVideo: (frames: CapturedFrame[], fpsLevel: FpsLevel) => Promise<ExportResult>
  isExporting: boolean
  progressMessage: string
}

export function useExport(): UseExportReturn {
  const [isExporting, setIsExporting] = useState(false)
  const [progressMessage, setProgressMessage] = useState('')

  const exportVideo = useCallback(async (
    frames: CapturedFrame[],
    fpsLevel: FpsLevel,
  ): Promise<ExportResult> => {
    setIsExporting(true)
    setProgressMessage('')
    try {
      const fps = FPS_VALUES[fpsLevel]
      const dataUrls = frames.map(f => f.dataUrl)
      const blob = await exportToMp4(dataUrls, fps, setProgressMessage)
      const filename = `phim-cua-con-${Date.now()}.mp4`

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
      setProgressMessage('')
    }
  }, [])

  return { exportVideo, isExporting, progressMessage }
}
