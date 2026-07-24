/**
 * T-XW14 — port 1:1 iOS `PhotoViewerGesture` (`PhotoViewerGestureIOSTests`): zoom clamp/toggle,
 * badge N/M, ngưỡng dismiss/page, hướng trội, và `resolveDragEnd` — bộ não của gesture THỐNG NHẤT
 * (unifiedDrag) quyết định page/dismiss/cancel từ ĐÚNG 1 nguồn kéo duy nhất.
 */
import { describe, it, expect } from 'vitest'
import {
  clampIndex, clampZoom, dismissBackgroundOpacity, dismissDragFraction, dismissImageScale,
  doubleTapZoomToggle, isVerticalDominant, pageContainerOffset, positionBadgeText, resolveDragEnd,
  resolvedPageIndex, shouldDismiss, shouldPageAdvance,
} from '../src/lib/project/photoViewerGesture'

describe('clampZoom — 1×..4×', () => {
  it('dưới 1 → kẹp về 1', () => expect(clampZoom(0.5)).toBe(1))
  it('trong khoảng → giữ nguyên', () => expect(clampZoom(2.5)).toBe(2.5))
  it('trên 4 → kẹp về 4', () => expect(clampZoom(10)).toBe(4))
})

describe('doubleTapZoomToggle — 1×↔2.5×', () => {
  it('đang 1× → bật 2.5×', () => expect(doubleTapZoomToggle(1)).toBe(2.5))
  it('đang zoom (>1.01) → về 1×', () => expect(doubleTapZoomToggle(2.5)).toBe(1))
  it('đang ĐÚNG 1.01 (biên, không phải >1.01) → vẫn bật 2.5× (ngưỡng chặt >, không phải >=)', () => expect(doubleTapZoomToggle(1.01)).toBe(2.5))
  it('đang 1.02 (vượt biên) → về 1×', () => expect(doubleTapZoomToggle(1.02)).toBe(1))
})

describe('positionBadgeText — "Ảnh N / M" 1-based', () => {
  it('index 0, total 15 → "Ảnh 1 / 15"', () => expect(positionBadgeText(0, 15)).toBe('Ảnh 1 / 15'))
  it('index 14, total 15 → "Ảnh 15 / 15"', () => expect(positionBadgeText(14, 15)).toBe('Ảnh 15 / 15'))
})

describe('clampIndex', () => {
  it('âm → 0', () => expect(clampIndex(-3, 10)).toBe(0))
  it('vượt count → count-1', () => expect(clampIndex(99, 10)).toBe(9))
  it('count=0 → 0', () => expect(clampIndex(5, 0)).toBe(0))
})

describe('shouldDismiss — >120px HOẶC >25% chiều cao', () => {
  it('121px, màn cao 2000 (chưa tới 25%) → true (đạt ngưỡng tuyệt đối)', () => expect(shouldDismiss(121, 2000)).toBe(true))
  it('100px, màn cao 300 (>25%=75) → true (đạt ngưỡng %)', () => expect(shouldDismiss(100, 300)).toBe(true))
  it('50px, màn cao 2000 → false', () => expect(shouldDismiss(50, 2000)).toBe(false))
})

describe('dismissDragFraction/Scale/Opacity', () => {
  it('fraction 0 khi dragHeight<=0', () => expect(dismissDragFraction(0, 800)).toBe(0))
  it('fraction 0.5 khi kéo nửa màn', () => expect(dismissDragFraction(400, 800)).toBe(0.5))
  it('fraction kẹp tối đa 1', () => expect(dismissDragFraction(2000, 800)).toBe(1))
  it('scale co dần theo fraction, tối đa co 18%', () => {
    expect(dismissImageScale(0)).toBe(1)
    expect(dismissImageScale(1)).toBeCloseTo(0.82, 5)
  })
  it('opacity mờ dần, dừng ở 0.35 (không mờ hẳn)', () => {
    expect(dismissBackgroundOpacity(0)).toBe(1)
    expect(dismissBackgroundOpacity(1)).toBeCloseTo(0.35, 5)
  })
})

describe('isVerticalDominant', () => {
  it('|dy|>|dx| → true', () => expect(isVerticalDominant(10, 50)).toBe(true))
  it('|dx|>|dy| → false', () => expect(isVerticalDominant(50, 10)).toBe(false))
})

describe('shouldPageAdvance — >60px HOẶC >20% chiều rộng', () => {
  it('61px, màn rộng 2000 → true', () => expect(shouldPageAdvance(61, 2000)).toBe(true))
  it('50px, màn rộng 200 (>20%=40) → true', () => expect(shouldPageAdvance(50, 200)).toBe(true))
  it('30px, màn rộng 2000 → false', () => expect(shouldPageAdvance(30, 2000)).toBe(false))
  it('âm (vuốt trái) tính theo trị tuyệt đối', () => expect(shouldPageAdvance(-70, 2000)).toBe(true))
})

describe('resolvedPageIndex — vuốt trái=tiến, vuốt phải=lùi, kẹp biên', () => {
  it('vuốt trái đủ ngưỡng → +1', () => expect(resolvedPageIndex(2, -100, 1000, 10)).toBe(3))
  it('vuốt phải đủ ngưỡng → -1', () => expect(resolvedPageIndex(2, 100, 1000, 10)).toBe(1))
  it('chưa đủ ngưỡng → giữ nguyên', () => expect(resolvedPageIndex(2, 10, 1000, 10)).toBe(2))
  it('ở frame CUỐI, vuốt trái tiếp → kẹp lại (không vượt biên)', () => expect(resolvedPageIndex(9, -100, 1000, 10)).toBe(9))
  it('ở frame ĐẦU, vuốt phải tiếp → kẹp lại', () => expect(resolvedPageIndex(0, 100, 1000, 10)).toBe(0))
})

describe('pageContainerOffset', () => {
  it('offset = -currentIndex*screenWidth + dragWidth', () => {
    expect(pageContainerOffset(2, 30, 400)).toBe(-2 * 400 + 30)
  })
})

describe('resolveDragEnd — ĐÚNG 1 gesture nguồn quyết page/dismiss/cancel (T-XP49/55)', () => {
  const base = { currentIndex: 3, count: 10, screenWidth: 400, screenHeight: 800, isZoomed: false }

  it('đang zoom → LUÔN cancel (pan-khi-zoom không page/dismiss)', () => {
    expect(resolveDragEnd({ ...base, dx: 200, dy: 200, isZoomed: true })).toEqual({ type: 'cancel' })
  })

  it('vuốt dọc xuống đủ ngưỡng, KHÔNG zoom → dismiss', () => {
    expect(resolveDragEnd({ ...base, dx: 5, dy: 200 })).toEqual({ type: 'dismiss' })
  })

  it('vuốt dọc xuống CHƯA đủ ngưỡng → cancel', () => {
    expect(resolveDragEnd({ ...base, dx: 5, dy: 20 })).toEqual({ type: 'cancel' })
  })

  it('vuốt dọc LÊN (dy âm) → dragHeight kẹp 0 → không bao giờ dismiss (chỉ vuốt XUỐNG đóng)', () => {
    expect(resolveDragEnd({ ...base, dx: 5, dy: -300 })).toEqual({ type: 'cancel' })
  })

  it('vuốt ngang trái đủ ngưỡng → page newIndex=currentIndex+1', () => {
    expect(resolveDragEnd({ ...base, dx: -100, dy: 5 })).toEqual({ type: 'page', newIndex: 4 })
  })

  it('vuốt ngang phải đủ ngưỡng → page newIndex=currentIndex-1', () => {
    expect(resolveDragEnd({ ...base, dx: 100, dy: 5 })).toEqual({ type: 'page', newIndex: 2 })
  })

  it('vuốt ngang CHƯA đủ ngưỡng → cancel', () => {
    expect(resolveDragEnd({ ...base, dx: 10, dy: 5 })).toEqual({ type: 'cancel' })
  })

  it('vuốt ngang đủ ngưỡng nhưng đã ở biên cuối → cancel (newIndex===currentIndex)', () => {
    expect(resolveDragEnd({ ...base, currentIndex: 9, dx: -200, dy: 5 })).toEqual({ type: 'cancel' })
  })
})
