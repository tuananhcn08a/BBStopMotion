import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useExport } from '../src/hooks/useExport'
import { CapturedFrame } from '../src/types'

// TS-04, TS-10, TS-12
describe('useExport', () => {
  const makeFrames = (count: number): CapturedFrame[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `f${i}`,
      dataUrl: `data:image/jpeg;base64,/9j/test${i}`,
      timestamp: i,
    }))

  beforeEach(() => {
    vi.restoreAllMocks()
    // Mock Image
    vi.stubGlobal('Image', class {
      naturalWidth = 640
      naturalHeight = 480
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_: string) { setTimeout(() => this.onload?.(), 0) }
    })

    // Mock HTMLCanvasElement and captureStream
    const mockStream = {
      getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }]),
    }
    const mockRecorderInstance = {
      start: vi.fn(),
      stop: vi.fn(),
      ondataavailable: null as ((e: { data: Blob }) => void) | null,
      onstop: null as (() => void) | null,
      onerror: null as (() => void) | null,
      mimeType: 'video/webm',
    }
    // Make stop trigger onstop after data
    mockRecorderInstance.stop = vi.fn().mockImplementation(function (this: typeof mockRecorderInstance) {
      setTimeout(() => {
        this.ondataavailable?.({ data: new Blob(['test']) })
        this.onstop?.()
      }, 10)
    })

    const MockMediaRecorder = vi.fn().mockImplementation(() => {
      const instance = Object.create(mockRecorderInstance)
      // bind stop so 'this' refers to the new instance
      instance.stop = vi.fn().mockImplementation(function (this: typeof mockRecorderInstance) {
        setTimeout(() => {
          this.ondataavailable?.({ data: new Blob(['test']) })
          this.onstop?.()
        }, 10)
      })
      return instance
    }) as unknown as typeof MediaRecorder
    ;(MockMediaRecorder as unknown as Record<string, unknown>).isTypeSupported = vi.fn().mockReturnValue(false)
    vi.stubGlobal('MediaRecorder', MockMediaRecorder)

    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({ drawImage: vi.fn() }),
      captureStream: vi.fn().mockReturnValue(mockStream),
    }
    const origCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'canvas') return canvas as unknown as HTMLElement
      return origCreateElement(tag)
    })
  })

  // TS-04: Export succeeds (upload stub success)
  it('TS-04: exportVideo resolves with blob and filename on success', async () => {
    // Mock fetch to succeed
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: 'https://example.com/film.webm' }),
    }))

    const { result } = renderHook(() => useExport())
    const frames = makeFrames(5)
    const exportResult = await result.current.exportVideo(frames, 'normal')

    expect(exportResult.blob).toBeInstanceOf(Blob)
    expect(exportResult.filename).toMatch(/neo-stopmotion-.*\.webm/)
  })

  // TS-10: Upload fails — degraded success
  it('TS-10: export succeeds but upload fail → uploadError is set, blob still present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const { result } = renderHook(() => useExport())
    const frames = makeFrames(5)
    const exportResult = await result.current.exportVideo(frames, 'normal')

    expect(exportResult.blob).toBeInstanceOf(Blob)
    expect(exportResult.uploadError).toBeTruthy()
    expect(exportResult.uploadUrl).toBeUndefined()
  })

  // TS-12: Download URL creation
  it('TS-12: URL.createObjectURL is callable with the export blob', async () => {
    const mockUrl = 'blob:http://localhost/test-123'
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue(mockUrl),
      revokeObjectURL: vi.fn(),
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('No upload')))

    const { result } = renderHook(() => useExport())
    const frames = makeFrames(5)
    const exportResult = await result.current.exportVideo(frames, 'normal')

    const url = URL.createObjectURL(exportResult.blob)
    expect(url).toBe(mockUrl)
  })
})
