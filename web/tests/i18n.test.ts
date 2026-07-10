/**
 * F4 — Song ngữ language('vi+en'|'vi'|'en').
 * BA Scenarios: TS-BS-11 ('en' → chữ Anh làm chính, không còn chữ Việt),
 *               TS-BS-12 ('vi' → ẩn hậu tố EN),
 *               TS-BS-13 (mặc định 'vi+en' → VN chính + EN phụ nhỏ hơn)
 */
import { describe, it, expect } from 'vitest'
import { label, mainText } from '../src/i18n'

describe('i18n — label() theo language (F4)', () => {
  it("TS-BS-13: 'vi+en' (mặc định) → main=VN, sub=EN", () => {
    const { main, sub } = label('vi+en', 'nav.capture')
    expect(main).toBe('Chụp phim')
    expect(sub).toBe('Capture')
  })

  it("TS-BS-12: 'vi' → main=VN, sub=null (ẩn hậu tố EN hoàn toàn)", () => {
    const { main, sub } = label('vi', 'nav.capture')
    expect(main).toBe('Chụp phim')
    expect(sub).toBeNull()
  })

  it("TS-BS-11: 'en' → main=EN (chữ Anh làm chính), sub=null, không còn chữ Việt", () => {
    const { main, sub } = label('en', 'nav.capture')
    expect(main).toBe('Capture')
    expect(sub).toBeNull()
    expect(main).not.toMatch(/Chụp/)
  })

  it("TS-BS-11: áp dụng cho mọi nhãn hệ thống — vd nút CHỤP → 'Snap'", () => {
    expect(mainText('en', 'capture.btn')).toBe('Snap')
    expect(mainText('vi', 'capture.btn')).toBe('CHỤP')
  })
})
