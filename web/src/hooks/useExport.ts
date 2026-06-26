import { useCallback, useState } from 'react'
import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { CapturedFrame, ExportResult, FpsLevel, FPS_VALUES } from '../types'

interface NasUploadResponse {
  ok: boolean
  download_url: string
  expires_at: string   // ISO-8601
}

// NAS upload endpoint and token are read inside uploadFile (not captured at module level)
// so that vi.stubEnv() can override them in tests and Vite still replaces them at build time.
// Set VITE_UPLOAD_ENDPOINT + VITE_UPLOAD_TOKEN in .env.local — never commit real values.
async function uploadFile(blob: Blob, filename: string): Promise<{ downloadUrl: string; expiresAt: string }> {
  const endpoint = import.meta.env.VITE_UPLOAD_ENDPOINT ?? ''
  const token = import.meta.env.VITE_UPLOAD_TOKEN ?? ''
  if (!endpoint) throw new Error('Upload endpoint not configured')
  const form = new FormData()
  form.append('file', blob, filename)
  form.append('filename', filename)
  const headers: HeadersInit = {}
  if (token) headers['X-Upload-Token'] = token
  const res = await fetch(endpoint, { method: 'POST', body: form, headers })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  const data = await res.json() as NasUploadResponse
  return { downloadUrl: data.download_url, expiresAt: data.expires_at }
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
      let expiresAt: string | undefined
      let uploadError: string | undefined

      try {
        const uploaded = await uploadFile(blob, filename)
        uploadUrl = uploaded.downloadUrl
        expiresAt = uploaded.expiresAt
      } catch (err) {
        uploadError = err instanceof Error ? err.message : 'Upload thất bại'
      }

      return { blob, filename, uploadUrl, expiresAt, uploadError }
    } finally {
      setIsExporting(false)
      setProgressMessage('')
    }
  }, [])

  return { exportVideo, isExporting, progressMessage }
}
