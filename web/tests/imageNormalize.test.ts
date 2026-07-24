/**
 * T-XW09 — `computeCropFillSourceRect` + hằng số normalize, đối chiếu logic crop iOS
 * `ImageNormalizer.normalizeImported` (bbsproj-format-v1.md §5, `ImageNormalizer.swift` dòng
 * 88-100): nguồn RỘNG hơn tỉ lệ đích → cắt trái/phải giữ chiều cao; nguồn CAO/vuông hơn → cắt
 * trên/dưới giữ chiều rộng. Crop luôn đối xứng (margin 2 bên bằng nhau) — không méo, không viền đen.
 */
import { describe, it, expect } from 'vitest'
import {
  NORMALIZED_HEIGHT, NORMALIZED_MIME, NORMALIZED_QUALITY, NORMALIZED_WIDTH, computeCropFillSourceRect,
} from '../src/lib/project/imageNormalize'

describe('Hằng số normalize [BINDING bbsproj-format-v1.md §1/§5]', () => {
  it('khớp ImageNormalizer.swift: 1280×720, q0.85, JPEG', () => {
    expect(NORMALIZED_WIDTH).toBe(1280)
    expect(NORMALIZED_HEIGHT).toBe(720)
    expect(NORMALIZED_QUALITY).toBe(0.85)
    expect(NORMALIZED_MIME).toBe('image/jpeg')
  })
})

describe('computeCropFillSourceRect — AC2 crop-fill giữ tỉ lệ, không méo, không viền đen', () => {
  it('nguồn ĐÚNG 16:9 (1920×1080) → KHÔNG crop gì (sx=sy=0, sWidth/sHeight = nguyên gốc)', () => {
    const rect = computeCropFillSourceRect(1920, 1080, 1280, 720)
    expect(rect).toEqual({ sx: 0, sy: 0, sWidth: 1920, sHeight: 1080 })
  })

  it('nguồn 4:3 (640×480, camera webcam phổ biến) → CAO hơn tỉ lệ đích → cắt trên/dưới, giữ chiều rộng', () => {
    const rect = computeCropFillSourceRect(640, 480, 1280, 720)
    // targetAspect = 16/9 ≈ 1.778; sourceAspect = 4/3 ≈ 1.333 → sourceAspect < targetAspect → cắt trên/dưới
    expect(rect.sx).toBe(0)
    expect(rect.sWidth).toBe(640)
    expect(rect.sHeight).toBeCloseTo(360, 5) // 640 / (16/9) = 360
    expect(rect.sy).toBeCloseTo((480 - 360) / 2, 5) // margin đối xứng = 60
    // Tỉ lệ vùng crop phải ĐÚNG 16:9 (không méo khi vẽ scale vào canvas 1280×720)
    expect(rect.sWidth / rect.sHeight).toBeCloseTo(1280 / 720, 5)
  })

  it('nguồn 1:1 vuông (1000×1000) → cắt trên/dưới, giữ chiều rộng, margin đối xứng', () => {
    const rect = computeCropFillSourceRect(1000, 1000, 1280, 720)
    expect(rect.sx).toBe(0)
    expect(rect.sWidth).toBe(1000)
    expect(rect.sHeight).toBeCloseTo(562.5, 5) // 1000 / (16/9)
    expect(rect.sy).toBeCloseTo((1000 - 562.5) / 2, 5)
    expect(rect.sWidth / rect.sHeight).toBeCloseTo(1280 / 720, 5)
  })

  it('nguồn RỘNG hơn 16:9 (vd 21:9, 2560×1080) → cắt trái/phải, giữ chiều cao, margin đối xứng', () => {
    const rect = computeCropFillSourceRect(2560, 1080, 1280, 720)
    // targetAspect ≈1.778; sourceAspect ≈2.37 > targetAspect → cắt trái/phải
    expect(rect.sy).toBe(0)
    expect(rect.sHeight).toBe(1080)
    expect(rect.sWidth).toBeCloseTo(1080 * (1280 / 720), 5) // 1920
    expect(rect.sx).toBeCloseTo((2560 - 1920) / 2, 5) // margin đối xứng = 320
    expect(rect.sWidth / rect.sHeight).toBeCloseTo(1280 / 720, 5)
  })

  it('nguồn nhỏ hơn đích (640×360, đúng 16:9) → vẫn không crop, chỉ scale-up khi vẽ (canvas cố định)', () => {
    const rect = computeCropFillSourceRect(640, 360, 1280, 720)
    expect(rect).toEqual({ sx: 0, sy: 0, sWidth: 640, sHeight: 360 })
  })
})
