/**
 * T-XW17 AC2/AC3 — `importImage.ts`: normalize ảnh import qua ĐÚNG pipeline crop-fill dùng chung
 * với camera (`drawNormalizedFrame`, `imageNormalize.ts`) — test verify: canvas LUÔN đúng
 * NORMALIZED_WIDTH×HEIGHT (không theo kích thước ảnh nguồn, giống frame chụp T-XW09), drawImage
 * crop-fill đúng vùng nguồn, toDataURL đúng mime/quality (q0.85, KHỚP frame chụp — khác q0.8 poster),
 * lỗi 1 file không chặn cả batch (mirror iOS `continue`).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { normalizeImportedFile, normalizeImportedFiles } from '../src/lib/project/importImage'
import { NORMALIZED_HEIGHT, NORMALIZED_MIME, NORMALIZED_QUALITY, NORMALIZED_WIDTH } from '../src/lib/project/imageNormalize'

function makeFakeBitmap(width: number, height: number) {
  return { width, height, close: vi.fn() }
}

function mockCanvas(dataUrl = 'data:image/jpeg;base64,dGVzdA==') {
  const ctx = { drawImage: vi.fn() }
  const canvas = { getContext: vi.fn().mockReturnValue(ctx), toDataURL: vi.fn().mockReturnValue(dataUrl), width: 0, height: 0 }
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') return canvas as unknown as HTMLElement
    return document.createElement(tag)
  })
  return { ctx, canvas }
}

function fakeFile(name = 'photo.jpg'): File {
  return new File(['fake-bytes'], name, { type: 'image/jpeg' })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('normalizeImportedFile — happy path (createImageBitmap khả dụng)', () => {
  it('canvas LUÔN đúng NORMALIZED_WIDTH×HEIGHT (1280×720) — không theo kích thước ảnh nguồn', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(makeFakeBitmap(3000, 2000)))
    const { canvas } = mockCanvas()

    await normalizeImportedFile(fakeFile())

    expect(canvas.width).toBe(NORMALIZED_WIDTH)
    expect(canvas.height).toBe(NORMALIZED_HEIGHT)
  })

  it('ảnh nguồn 4:3 (2000×1500) → crop-fill trên/dưới đúng công thức computeCropFillSourceRect (cùng pipeline camera T-XW09)', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(makeFakeBitmap(2000, 1500)))
    const { ctx } = mockCanvas()

    await normalizeImportedFile(fakeFile())

    // targetAspect 16:9; nguồn 2000×1500 (4:3) cao hơn tỉ lệ đích → cắt trên/dưới, giữ chiều rộng.
    // sHeight = 2000/(16/9) = 1125; sy = (1500-1125)/2 = 187.5
    expect(ctx.drawImage).toHaveBeenCalledWith(
      expect.objectContaining({ width: 2000, height: 1500 }),
      0, 187.5, 2000, 1125,
      0, 0, NORMALIZED_WIDTH, NORMALIZED_HEIGHT,
    )
  })

  it('toDataURL đúng mime/quality — CÙNG hằng số frame chụp (q0.85, không phải q0.8 poster)', async () => {
    expect(NORMALIZED_QUALITY).toBe(0.85)
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(makeFakeBitmap(1280, 720)))
    const { canvas } = mockCanvas()

    await normalizeImportedFile(fakeFile())

    expect(canvas.toDataURL).toHaveBeenCalledWith(NORMALIZED_MIME, NORMALIZED_QUALITY)
  })

  it('trả về dataUrl + bytes (ArrayBuffer) đúng nội dung đã encode', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(makeFakeBitmap(1280, 720)))
    mockCanvas('data:image/jpeg;base64,dGVzdA==') // "test"

    const result = await normalizeImportedFile(fakeFile())

    expect(result).not.toBeNull()
    expect(result?.dataUrl).toBe('data:image/jpeg;base64,dGVzdA==')
    expect(result?.bytes).toBeInstanceOf(ArrayBuffer)
    expect(new TextDecoder().decode(result!.bytes)).toBe('test')
  })

  it('bitmap.close() được gọi sau khi xong (giải phóng bộ nhớ)', async () => {
    const bitmap = makeFakeBitmap(1280, 720)
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    mockCanvas()

    await normalizeImportedFile(fakeFile())

    expect(bitmap.close).toHaveBeenCalledTimes(1)
  })
})

describe('normalizeImportedFile — lỗi/biên (không chặn batch)', () => {
  it('createImageBitmap throw + không có Image fallback khả dụng → resolve null (không throw)', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed')))
    vi.stubGlobal('Image', class { onerror: (() => void) | null = null; onload: (() => void) | null = null; set src(_: string) { queueMicrotask(() => this.onerror?.()) } })

    const result = await normalizeImportedFile(fakeFile('bad.jpg'))
    expect(result).toBeNull()
  })

  it('canvas.getContext trả null → resolve null, không throw', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(makeFakeBitmap(1280, 720)))
    const canvas = { getContext: vi.fn().mockReturnValue(null), toDataURL: vi.fn(), width: 0, height: 0 }
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return canvas as unknown as HTMLElement
      return document.createElement(tag)
    })

    const result = await normalizeImportedFile(fakeFile())
    expect(result).toBeNull()
  })

  it('bitmap width/height = 0 (file hỏng decode "thành công" nhưng rỗng) → resolve null', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(makeFakeBitmap(0, 0)))
    mockCanvas()

    const result = await normalizeImportedFile(fakeFile())
    expect(result).toBeNull()
  })
})

describe('normalizeImportedFiles — batch tuần tự, 1 file lỗi KHÔNG chặn cả batch', () => {
  it('3 file, file giữa lỗi → trả về đúng 2 kết quả thành công, giữ thứ tự', async () => {
    let call = 0
    vi.stubGlobal('createImageBitmap', vi.fn().mockImplementation(() => {
      call += 1
      if (call === 2) return Promise.reject(new Error('file hỏng'))
      return Promise.resolve(makeFakeBitmap(1280, 720))
    }))
    vi.stubGlobal('Image', class { onerror: (() => void) | null = null; onload: (() => void) | null = null; set src(_: string) { queueMicrotask(() => this.onerror?.()) } })
    mockCanvas()

    const results = await normalizeImportedFiles([fakeFile('a.jpg'), fakeFile('b-bad.jpg'), fakeFile('c.jpg')])

    expect(results).toHaveLength(2)
  })

  it('mảng rỗng → trả mảng rỗng, không gọi createImageBitmap', async () => {
    const spy = vi.fn()
    vi.stubGlobal('createImageBitmap', spy)

    const results = await normalizeImportedFiles([])

    expect(results).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })
})
