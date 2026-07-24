/**
 * T-XW17 AC1 — `posterGen.ts`: trích poster JPEG từ blob MP4 qua `<video>` seek + canvas capture.
 * jsdom KHÔNG decode video thật → mock `document.createElement('video'|'canvas')` (cùng quy ước đã
 * dùng ở `tests/useCapture.test.ts` cho canvas) rồi TỰ BẮN các event `<video>` thật sự sẽ phát
 * (`loadedmetadata` → set `currentTime` → `seeked`) để verify orchestration logic (seek time tính
 * đúng, canvas size đúng theo video, `drawImage`/`toDataURL` gọi đúng tham số, lỗi → resolve null).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generatePosterFromBlob, POSTER_MIME, POSTER_QUALITY, POSTER_SEEK_SECONDS } from '../src/lib/project/posterGen'

interface FakeVideo {
  muted: boolean
  playsInline: boolean
  preload: string
  src: string
  duration: number
  videoWidth: number
  videoHeight: number
  currentTime: number
  onloadedmetadata: (() => void) | null
  onseeked: (() => void) | null
  onerror: (() => void) | null
}

function makeFakeVideo(overrides: Partial<FakeVideo> = {}): FakeVideo {
  return {
    muted: false, playsInline: false, preload: '', src: '',
    duration: 5, videoWidth: 1280, videoHeight: 720, currentTime: 0,
    onloadedmetadata: null, onseeked: null, onerror: null,
    ...overrides,
  }
}

function mockCreateElement(fakeVideo: FakeVideo, mockCanvas: unknown) {
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'video') return fakeVideo as unknown as HTMLElement
    if (tag === 'canvas') return mockCanvas as unknown as HTMLElement
    return document.createElement(tag)
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
  if (!('createObjectURL' in URL)) (URL as unknown as { createObjectURL: unknown }).createObjectURL = () => ''
  if (!('revokeObjectURL' in URL)) (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = () => {}
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-video-url')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

describe('generatePosterFromBlob — happy path', () => {
  it('seek đúng POSTER_SEEK_SECONDS mặc định (0.1s) khi video đủ dài', async () => {
    const fakeVideo = makeFakeVideo({ duration: 5 })
    const mockCtx = { drawImage: vi.fn() }
    const mockCanvas = { getContext: vi.fn().mockReturnValue(mockCtx), toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,poster'), width: 0, height: 0 }
    mockCreateElement(fakeVideo, mockCanvas)

    const promise = generatePosterFromBlob(new Blob(['x']))
    fakeVideo.onloadedmetadata?.()
    expect(fakeVideo.currentTime).toBeCloseTo(POSTER_SEEK_SECONDS, 5)
    fakeVideo.onseeked?.()

    const result = await promise
    expect(result).toBe('data:image/jpeg;base64,poster')
  })

  it('canvas kích thước ĐÚNG theo videoWidth/videoHeight (không cố định như frame chụp)', async () => {
    const fakeVideo = makeFakeVideo({ videoWidth: 960, videoHeight: 540 })
    const mockCtx = { drawImage: vi.fn() }
    const mockCanvas = { getContext: vi.fn().mockReturnValue(mockCtx), toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,x'), width: 0, height: 0 }
    mockCreateElement(fakeVideo, mockCanvas)

    const promise = generatePosterFromBlob(new Blob(['x']))
    fakeVideo.onloadedmetadata?.()
    fakeVideo.onseeked?.()
    await promise

    expect(mockCanvas.width).toBe(960)
    expect(mockCanvas.height).toBe(540)
  })

  it('drawImage vẽ FULL video vào FULL canvas (không crop — khác pipeline frame chụp)', async () => {
    const fakeVideo = makeFakeVideo({ videoWidth: 800, videoHeight: 450 })
    const mockCtx = { drawImage: vi.fn() }
    const mockCanvas = { getContext: vi.fn().mockReturnValue(mockCtx), toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,x'), width: 0, height: 0 }
    mockCreateElement(fakeVideo, mockCanvas)

    const promise = generatePosterFromBlob(new Blob(['x']))
    fakeVideo.onloadedmetadata?.()
    fakeVideo.onseeked?.()
    await promise

    expect(mockCtx.drawImage).toHaveBeenCalledWith(fakeVideo, 0, 0, 800, 450)
  })

  it('toDataURL gọi đúng mime "image/jpeg" + quality 0.8 (POSTER_QUALITY, khác 0.85 frame gốc)', async () => {
    expect(POSTER_MIME).toBe('image/jpeg')
    expect(POSTER_QUALITY).toBe(0.8)
    const fakeVideo = makeFakeVideo()
    const mockCtx = { drawImage: vi.fn() }
    const mockCanvas = { getContext: vi.fn().mockReturnValue(mockCtx), toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,x'), width: 0, height: 0 }
    mockCreateElement(fakeVideo, mockCanvas)

    const promise = generatePosterFromBlob(new Blob(['x']))
    fakeVideo.onloadedmetadata?.()
    fakeVideo.onseeked?.()
    await promise

    expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8)
  })

  it('gọi được với seekSeconds tuỳ chỉnh (không phải mặc định 0.1)', async () => {
    const fakeVideo = makeFakeVideo({ duration: 10 })
    const mockCtx = { drawImage: vi.fn() }
    const mockCanvas = { getContext: vi.fn().mockReturnValue(mockCtx), toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,x'), width: 0, height: 0 }
    mockCreateElement(fakeVideo, mockCanvas)

    const promise = generatePosterFromBlob(new Blob(['x']), 2.5)
    fakeVideo.onloadedmetadata?.()
    expect(fakeVideo.currentTime).toBeCloseTo(2.5, 5)
    fakeVideo.onseeked?.()
    await promise
  })

  it('revoke Object URL sau khi xong (dọn bộ nhớ)', async () => {
    const fakeVideo = makeFakeVideo()
    const mockCtx = { drawImage: vi.fn() }
    const mockCanvas = { getContext: vi.fn().mockReturnValue(mockCtx), toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,x'), width: 0, height: 0 }
    mockCreateElement(fakeVideo, mockCanvas)

    const promise = generatePosterFromBlob(new Blob(['x']))
    fakeVideo.onloadedmetadata?.()
    fakeVideo.onseeked?.()
    await promise

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-video-url')
  })
})

describe('generatePosterFromBlob — biên / lỗi (im lặng bỏ qua, khớp iOS)', () => {
  it('video.duration nhỏ hơn seekSeconds → kẹp về gần cuối video (duration - 0.01), không âm/vượt quá', async () => {
    const fakeVideo = makeFakeVideo({ duration: 0.05 })
    const mockCtx = { drawImage: vi.fn() }
    const mockCanvas = { getContext: vi.fn().mockReturnValue(mockCtx), toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,x'), width: 0, height: 0 }
    mockCreateElement(fakeVideo, mockCanvas)

    const promise = generatePosterFromBlob(new Blob(['x']))
    fakeVideo.onloadedmetadata?.()
    expect(fakeVideo.currentTime).toBeGreaterThanOrEqual(0)
    expect(fakeVideo.currentTime).toBeLessThan(POSTER_SEEK_SECONDS)
    fakeVideo.onseeked?.()
    await promise
  })

  it('video.duration = NaN/0 (codec lạ) → không crash, seek fallback về seekSeconds', async () => {
    const fakeVideo = makeFakeVideo({ duration: NaN })
    const mockCtx = { drawImage: vi.fn() }
    const mockCanvas = { getContext: vi.fn().mockReturnValue(mockCtx), toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,x'), width: 0, height: 0 }
    mockCreateElement(fakeVideo, mockCanvas)

    const promise = generatePosterFromBlob(new Blob(['x']))
    expect(() => fakeVideo.onloadedmetadata?.()).not.toThrow()
    fakeVideo.onseeked?.()
    const result = await promise
    expect(result).toBe('data:image/jpeg;base64,x')
  })

  it('video.onerror (file hỏng/codec không hỗ trợ) → resolve null, KHÔNG throw', async () => {
    const fakeVideo = makeFakeVideo()
    mockCreateElement(fakeVideo, {})

    const promise = generatePosterFromBlob(new Blob(['x']))
    fakeVideo.onerror?.()

    await expect(promise).resolves.toBeNull()
  })

  it('canvas.getContext trả null (trình duyệt hiếm gặp không hỗ trợ 2d) → resolve null, không throw', async () => {
    const fakeVideo = makeFakeVideo()
    const mockCanvas = { getContext: vi.fn().mockReturnValue(null), toDataURL: vi.fn(), width: 0, height: 0 }
    mockCreateElement(fakeVideo, mockCanvas)

    const promise = generatePosterFromBlob(new Blob(['x']))
    fakeVideo.onloadedmetadata?.()
    fakeVideo.onseeked?.()

    await expect(promise).resolves.toBeNull()
    expect(mockCanvas.toDataURL).not.toHaveBeenCalled()
  })

  it('drawImage throw (vd SecurityError canvas tainted) → resolve null, không throw ra ngoài', async () => {
    const fakeVideo = makeFakeVideo()
    const mockCtx = { drawImage: vi.fn(() => { throw new Error('SecurityError') }) }
    const mockCanvas = { getContext: vi.fn().mockReturnValue(mockCtx), toDataURL: vi.fn(), width: 0, height: 0 }
    mockCreateElement(fakeVideo, mockCanvas)

    const promise = generatePosterFromBlob(new Blob(['x']))
    fakeVideo.onloadedmetadata?.()
    fakeVideo.onseeked?.()

    await expect(promise).resolves.toBeNull()
  })

  it('onerror bắn SAU onseeked đã resolve rồi → không resolve lại lần 2 (settled guard)', async () => {
    const fakeVideo = makeFakeVideo()
    const mockCtx = { drawImage: vi.fn() }
    const mockCanvas = { getContext: vi.fn().mockReturnValue(mockCtx), toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,ok'), width: 0, height: 0 }
    mockCreateElement(fakeVideo, mockCanvas)

    const promise = generatePosterFromBlob(new Blob(['x']))
    fakeVideo.onloadedmetadata?.()
    fakeVideo.onseeked?.()
    fakeVideo.onerror?.() // bắn thừa sau khi đã settle — phải bị bỏ qua

    const result = await promise
    expect(result).toBe('data:image/jpeg;base64,ok')
  })
})
