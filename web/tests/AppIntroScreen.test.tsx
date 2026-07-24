/**
 * T-XW21 (S5) — `AppIntroScreen.tsx`: giới thiệu app iOS. AC5: nút App Store (mobile)/QR (desktop)
 * cùng render (CSS quyết định ẩn/hiện theo breakpoint, không phải React), "Để sau" gọi đúng
 * `onLater` (khác backdrop/ESC/✕ chỉ gọi `onClose`), KHÔNG có bất kỳ nhắc macOS nào.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AppIntroScreen, { APP_STORE_URL } from '../src/components/AppIntroScreen'

describe('AppIntroScreen — render nội dung', () => {
  it('hiện tiêu đề, 3 câu copy, thẻ app, nút App Store + QR (cả 2 luôn trong DOM, CSS quyết định breakpoint)', () => {
    render(<AppIntroScreen language="vi" onClose={vi.fn()} onLater={vi.fn()} />)
    expect(screen.getByTestId('app-intro-screen')).toBeInTheDocument()
    expect(screen.getByTestId('app-intro-store-btn')).toHaveAttribute('href', APP_STORE_URL)
    expect(screen.getByTestId('app-intro-qr-row')).toBeInTheDocument()
    expect(screen.getByTestId('app-store-qr')).toBeInTheDocument()
  })

  it('KHÔNG có bất kỳ chữ "macOS" nào (mockup chốt: chỉ giới thiệu iPhone/iPad)', () => {
    render(<AppIntroScreen language="vi" onClose={vi.fn()} onLater={vi.fn()} />)
    expect(screen.getByTestId('app-intro-screen')).not.toHaveTextContent(/macOS/i)
  })

  it('link App Store trỏ đúng id6789743028', () => {
    render(<AppIntroScreen language="vi" onClose={vi.fn()} onLater={vi.fn()} />)
    expect(APP_STORE_URL).toContain('id6789743028')
  })
})

describe('AppIntroScreen — đóng thường (backdrop/ESC/✕) vs "Để sau"', () => {
  it('bấm "Để sau" → gọi onLater, KHÔNG gọi onClose', () => {
    const onClose = vi.fn()
    const onLater = vi.fn()
    render(<AppIntroScreen language="vi" onClose={onClose} onLater={onLater} />)
    fireEvent.click(screen.getByTestId('app-intro-later-btn'))
    expect(onLater).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('click backdrop → gọi onClose, KHÔNG gọi onLater (không persist "đã xem")', () => {
    const onClose = vi.fn()
    const onLater = vi.fn()
    render(<AppIntroScreen language="vi" onClose={onClose} onLater={onLater} />)
    fireEvent.click(screen.getByTestId('app-intro-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onLater).not.toHaveBeenCalled()
  })

  it('click NỘI DUNG (không phải backdrop) → KHÔNG đóng (stopPropagation)', () => {
    const onClose = vi.fn()
    render(<AppIntroScreen language="vi" onClose={onClose} onLater={vi.fn()} />)
    fireEvent.click(screen.getByTestId('app-intro-screen'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('phím ESC → gọi onClose', () => {
    const onClose = vi.fn()
    render(<AppIntroScreen language="vi" onClose={onClose} onLater={vi.fn()} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('AppIntroScreen — bilingual (vi+en)', () => {
  it('mode vi+en hiện cả "Also on iPhone" (sub tiêu đề)', () => {
    render(<AppIntroScreen language="vi+en" onClose={vi.fn()} onLater={vi.fn()} />)
    expect(screen.getByTestId('app-intro-screen')).toHaveTextContent('Also on iPhone')
  })
})
