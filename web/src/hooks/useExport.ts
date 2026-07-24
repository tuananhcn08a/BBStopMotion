import { useCallback, useState } from 'react'
import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { CapturedFrame, ExportResult, FpsLevel } from '../types'
import { ProjectKind } from '../lib/project/types'
import { fpsFor } from '../lib/project/fps'

interface NasUploadResponse {
  ok: boolean
  download_url: string
  expires_at: string   // ISO-8601
}

// NAS upload endpoint and token are read inside uploadFile (not captured at module level)
// so that vi.stubEnv() can override them in tests and Vite still replaces them at build time.
// Set VITE_UPLOAD_ENDPOINT + VITE_UPLOAD_TOKEN in .env.local — never commit real values.
export async function uploadExportedFile(
  blob: Blob,
  filename: string,
): Promise<{ downloadUrl: string; expiresAt: string }> {
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

/** 4 giai đoạn hiển thị trên card export 2b — TS-BS-28 (autoUpload OFF bỏ upload/qr). */
export type ExportStage = 'mp4' | 'gif' | 'upload' | 'qr'

export interface ExportProgressState {
  stage: ExportStage
  percent: number
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export interface UseExportReturn {
  exportVideo: (
    frames: CapturedFrame[],
    fpsLevel: FpsLevel,
    autoUpload?: boolean,
    kind?: ProjectKind,
  ) => Promise<ExportResult>
  isExporting: boolean
  progress: ExportProgressState
}

export function useExport(): UseExportReturn {
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState<ExportProgressState>({ stage: 'mp4', percent: 0 })

  const exportVideo = useCallback(async (
    frames: CapturedFrame[],
    fpsLevel: FpsLevel,
    autoUpload: boolean = true,
    // T-XW05 AC7 — fps qua fpsFor(kind, level) thay vì FPS_VALUES phẳng. Default 'animation' khớp
    // Y HỆT hành vi cũ (FPS_VALUES[level] === fpsFor('animation', level) mọi level) cho call-site
    // nào chưa truyền `kind` (test cũ không cần sửa).
    kind: ProjectKind = 'animation',
  ): Promise<ExportResult> => {
    setIsExporting(true)
    setProgress({ stage: 'mp4', percent: 0 })
    try {
      const fps = fpsFor(kind, fpsLevel)
      const dataUrls = frames.map(f => f.dataUrl)
      let mp4Calls = 0
      const blob = await exportToMp4(dataUrls, fps, () => {
        mp4Calls += 1
        setProgress({ stage: 'mp4', percent: mp4Calls === 1 ? 12 : 30 })
      })
      const filename = `phim-cua-con-${Date.now()}.mp4`

      // GIF stage — visual-only cho tới khi có pipeline GIF thật (ngoài phạm vi T-BS10).
      setProgress({ stage: 'gif', percent: 48 })
      await sleep(150)
      setProgress({ stage: 'gif', percent: 62 })
      // Bug T-BS11 (QA phát hiện): thiếu `await` giữa 2 setProgress liên tiếp khi autoUpload=false
      // khiến React batch 2 lần setState cùng tick — 62% ("✓ Ghép MP4 / ● Tạo GIF...", khớp mockup
      // 2b) KHÔNG BAO GIỜ thực sự render, app nhảy thẳng 48%→100%. Thêm await ở đây để 62% luôn
      // có ít nhất 1 khung hình render trước khi qua bước kế tiếp, dù có autoUpload hay không.
      await sleep(150)

      let uploadUrl: string | undefined
      let expiresAt: string | undefined
      let uploadError: string | undefined

      if (autoUpload) {
        setProgress({ stage: 'upload', percent: 75 })
        try {
          const uploaded = await uploadExportedFile(blob, filename)
          uploadUrl = uploaded.downloadUrl
          expiresAt = uploaded.expiresAt
        } catch (err) {
          uploadError = err instanceof Error ? err.message : 'Upload thất bại'
        }
        setProgress({ stage: 'qr', percent: 95 })
        await sleep(100)
      }

      setProgress({ stage: autoUpload ? 'qr' : 'gif', percent: 100 })
      return { blob, filename, uploadUrl, expiresAt, uploadError }
    } finally {
      setIsExporting(false)
    }
  }, [])

  return { exportVideo, isExporting, progress }
}
