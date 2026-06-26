import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { renderHook, act } from '@testing-library/react'
import { useExport, exportToMp4, _resetFfmpegInstance } from '../src/hooks/useExport'

// Mock @ffmpeg/ffmpeg — hoisted, intercepts the lazy import('@ffmpeg/ffmpeg') inside useExport
vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    exec: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  })),
}))

// Mock @ffmpeg/util — hoisted, intercepts the lazy import('@ffmpeg/util') inside useExport
vi.mock('@ffmpeg/util', () => ({
  toBlobURL: vi.fn().mockResolvedValue('blob:mock'),
  fetchFile: vi.fn().mockResolvedValue(new Uint8Array([0xff, 0xd8])),
}))

const makeFrames = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `f${i}`,
    dataUrl: `data:image/jpeg;base64,/9j/test${i}`,
    timestamp: i,
  }))

// TS-04, TS-10, TS-12
describe('useExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the module-level ffmpegInstance so each test gets a fresh FFmpeg load
    _resetFfmpegInstance()
    // Restore env stubs between tests
    vi.unstubAllEnvs()
  })

  // TS-04: Export succeeds — blob is MP4, filename ends .mp4
  it('TS-04: exportVideo resolves with MP4 blob and .mp4 filename on success', async () => {
    vi.stubEnv('VITE_UPLOAD_ENDPOINT', 'https://bb-share.bapbean.com/api/upload')
    vi.stubEnv('VITE_UPLOAD_TOKEN', 'test-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        download_url: 'https://bb-share.bapbean.com/files/2026-06-26/abc123/movie.mp4',
        expires_at: '2026-07-03T00:00:00Z',
      }),
    }))

    const { result } = renderHook(() => useExport())
    const frames = makeFrames(5)

    let exportResult!: { blob: Blob; filename: string; uploadUrl?: string; uploadError?: string }
    await act(async () => {
      exportResult = await result.current.exportVideo(frames, 'normal')
    })

    expect(exportResult.blob).toBeInstanceOf(Blob)
    expect(exportResult.blob.type).toBe('video/mp4')
    expect(exportResult.filename).toMatch(/phim-cua-con-.*\.mp4$/)
    // NAS contract: uploadUrl comes from download_url, expiresAt from expires_at
    expect(exportResult.uploadUrl).toBe('https://bb-share.bapbean.com/files/2026-06-26/abc123/movie.mp4')
    expect(exportResult.expiresAt).toBe('2026-07-03T00:00:00Z')
  })

  // TS-10: Upload fails — degraded success (blob still present, local download available)
  it('TS-10: export succeeds but upload fails → uploadError set, blob still present (graceful degradation)', async () => {
    vi.stubEnv('VITE_UPLOAD_ENDPOINT', 'https://bb-share.bapbean.com/api/upload')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const { result } = renderHook(() => useExport())
    const frames = makeFrames(5)

    let exportResult!: { blob: Blob; filename: string; uploadUrl?: string; uploadError?: string }
    await act(async () => {
      exportResult = await result.current.exportVideo(frames, 'normal')
    })

    expect(exportResult.blob).toBeInstanceOf(Blob)
    expect(exportResult.blob.type).toBe('video/mp4')
    expect(exportResult.uploadError).toBeTruthy()
    expect(exportResult.uploadUrl).toBeUndefined()
  })

  // AC1: upload request includes X-Upload-Token header when VITE_UPLOAD_TOKEN is set
  it('AC1-NAS: uploadFile sends X-Upload-Token header to NAS endpoint', async () => {
    vi.stubEnv('VITE_UPLOAD_ENDPOINT', 'https://bb-share.bapbean.com/api/upload')
    vi.stubEnv('VITE_UPLOAD_TOKEN', 'secret-test-token')
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        download_url: 'https://bb-share.bapbean.com/files/2026-06-26/abc123/movie.mp4',
        expires_at: '2026-07-03T00:00:00Z',
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useExport())
    const frames = makeFrames(5)
    await act(async () => {
      await result.current.exportVideo(frames, 'normal')
    })

    expect(mockFetch).toHaveBeenCalled()
    const [url, initArg] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://bb-share.bapbean.com/api/upload')
    expect((initArg?.headers as Record<string, string>)?.['X-Upload-Token']).toBe('secret-test-token')
  })

  // TS-12: Download filename ends with .mp4, URL.createObjectURL works
  it('TS-12: URL.createObjectURL callable with MP4 blob, filename ends .mp4', async () => {
    vi.stubEnv('VITE_UPLOAD_ENDPOINT', 'https://bb-share.bapbean.com/api/upload')
    const mockUrl = 'blob:http://localhost/test-123'
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue(mockUrl),
      revokeObjectURL: vi.fn(),
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('No upload')))

    const { result } = renderHook(() => useExport())
    const frames = makeFrames(5)

    let exportResult!: { blob: Blob; filename: string; uploadUrl?: string; uploadError?: string }
    await act(async () => {
      exportResult = await result.current.exportVideo(frames, 'normal')
    })

    const url = URL.createObjectURL(exportResult.blob)
    expect(url).toBe(mockUrl)
    expect(exportResult.filename).toMatch(/\.mp4$/)
  })
})

// T-W04: Reproduce-first — ffmpeg CDN COEP hang guard
// This test MUST FAIL while baseURL still points to unpkg.com.
// It MUST PASS only after the fix sets baseURL to a same-origin path ('/ffmpeg').
describe('ffmpeg loader — same-origin guard (T-W04)', () => {
  it('ffmpeg core must NOT be loaded from a cross-origin CDN (prevents COEP freeze)', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/hooks/useExport.ts'),
      'utf-8'
    )

    const CDN_PATTERNS = [
      'unpkg.com',
      'cdn.jsdelivr.net',
      'cdnjs.cloudflare.com',
      'fastly.net',
      'skypack.dev',
    ]

    for (const cdn of CDN_PATTERNS) {
      expect(source, `baseURL must not reference CDN: ${cdn}`).not.toContain(cdn)
    }

    // Also assert the self-hosted same-origin path is used
    expect(source, "baseURL must use same-origin path '/ffmpeg'").toMatch(
      /baseURL\s*=\s*['"`]\/ffmpeg['"`]/
    )
  })
})

// Unit tests for exportToMp4 directly
describe('exportToMp4', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetFfmpegInstance()
  })

  it('returns a Blob with type video/mp4', async () => {
    const frames = ['data:image/jpeg;base64,/9j/test0', 'data:image/jpeg;base64,/9j/test1']
    const blob = await exportToMp4(frames, 6)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('video/mp4')
  })

  it('calls onProgress with loading and assembling messages', async () => {
    const progress: string[] = []
    const frames = ['data:image/jpeg;base64,/9j/test0']
    await exportToMp4(frames, 6, (msg) => progress.push(msg))
    expect(progress).toContain('Đang chuẩn bị phần mềm ghép phim...')
    expect(progress).toContain('Đang ghép phim...')
  })
})
