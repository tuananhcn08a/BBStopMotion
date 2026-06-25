import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCapture } from '../src/hooks/useCapture'
import { CapturedFrame, MIN_FRAMES_TO_EXPORT } from '../src/types'

// TS-02, TS-03, TS-07, TS-08
describe('useCapture', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // TS-02: Capture frame from video
  it('TS-02: captureFrame returns a frame with dataUrl from video', () => {
    const { result } = renderHook(() => useCapture())

    // Mock canvas context
    const mockDataUrl = 'data:image/jpeg;base64,/9j/test'
    const mockCtx = { drawImage: vi.fn(), globalAlpha: 1 }
    const mockCanvas = {
      getContext: vi.fn().mockReturnValue(mockCtx),
      toDataURL: vi.fn().mockReturnValue(mockDataUrl),
      width: 0,
      height: 0,
    }
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'canvas') return mockCanvas as unknown as HTMLElement
      return document.createElement(tag)
    })

    const mockVideo = {
      videoWidth: 640,
      videoHeight: 480,
    } as HTMLVideoElement

    const frame = result.current.captureFrame(mockVideo)
    expect(frame).not.toBeNull()
    expect(frame?.dataUrl).toBe(mockDataUrl)
    expect(frame?.id).toMatch(/^frame-/)
    expect(typeof frame?.timestamp).toBe('number')
  })

  it('TS-02: captureFrame returns null if video has no dimensions', () => {
    const { result } = renderHook(() => useCapture())
    const mockVideo = { videoWidth: 0, videoHeight: 0 } as HTMLVideoElement
    const frame = result.current.captureFrame(mockVideo)
    expect(frame).toBeNull()
  })

  // TS-03: Onion skin returns last frame
  it('TS-03: getOnionSkinFrame returns last frame when frames exist', () => {
    const { result } = renderHook(() => useCapture())
    const frames: CapturedFrame[] = [
      { id: 'f1', dataUrl: 'data:1', timestamp: 1 },
      { id: 'f2', dataUrl: 'data:2', timestamp: 2 },
    ]
    const onion = result.current.getOnionSkinFrame(frames)
    expect(onion?.id).toBe('f2')
  })

  it('TS-08: getOnionSkinFrame returns null when no frames', () => {
    const { result } = renderHook(() => useCapture())
    const onion = result.current.getOnionSkinFrame([])
    expect(onion).toBeNull()
  })

  // TS-07: Delete last frame
  it('TS-07: deleteLastFrame removes the last frame', () => {
    const { result } = renderHook(() => useCapture())
    const frames: CapturedFrame[] = [
      { id: 'f1', dataUrl: 'data:1', timestamp: 1 },
      { id: 'f2', dataUrl: 'data:2', timestamp: 2 },
      { id: 'f3', dataUrl: 'data:3', timestamp: 3 },
    ]
    const updated = result.current.deleteLastFrame(frames)
    expect(updated).toHaveLength(2)
    expect(updated[updated.length - 1]?.id).toBe('f2')
  })

  it('TS-07: deleteLastFrame on single frame returns empty array', () => {
    const { result } = renderHook(() => useCapture())
    const frames: CapturedFrame[] = [{ id: 'f1', dataUrl: 'data:1', timestamp: 1 }]
    const updated = result.current.deleteLastFrame(frames)
    expect(updated).toHaveLength(0)
  })

  it('TS-08: deleteLastFrame on empty array returns empty array', () => {
    const { result } = renderHook(() => useCapture())
    const updated = result.current.deleteLastFrame([])
    expect(updated).toHaveLength(0)
  })

  // TS-05: Min frames guard
  it('TS-05: MIN_FRAMES_TO_EXPORT is 5', () => {
    expect(MIN_FRAMES_TO_EXPORT).toBe(5)
  })
})
