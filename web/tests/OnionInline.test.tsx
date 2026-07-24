/**
 * T-XW10 AC5 — OnionInline: 3 trạng thái (① tắt · ② bật gọn · ③ đang chỉnh), đọc/ghi thẳng
 * `onionSkinOpacity` (không state riêng ngoài `isExpanded` cục bộ), nhớ `lastOpacity` khi bật lại.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OnionInline from '../src/components/OnionInline'

describe('OnionInline — ① trạng thái TẮT (opacity===0)', () => {
  it('opacity=0 → hiện icon trần, KHÔNG hiện % hay slider', () => {
    render(<OnionInline language="vi+en" opacity={0} onOpacityChange={vi.fn()} lastOpacity={0.4} />)
    expect(screen.getByTestId('onion-inline-off')).toBeInTheDocument()
    expect(screen.queryByTestId('onion-inline-compact')).not.toBeInTheDocument()
    expect(screen.queryByTestId('onion-inline-expanded')).not.toBeInTheDocument()
  })

  it('bấm khi tắt → onOpacityChange(lastOpacity) — khôi phục đúng mức cũ (nhớ lastOpacity)', async () => {
    const onOpacityChange = vi.fn()
    const user = userEvent.setup()
    render(<OnionInline language="vi+en" opacity={0} onOpacityChange={onOpacityChange} lastOpacity={0.6} />)
    await user.click(screen.getByTestId('onion-inline-off'))
    expect(onOpacityChange).toHaveBeenCalledWith(0.6)
  })

  it('bấm khi tắt + lastOpacity=0 (chưa từng bật) → fallback 0.4 (không bao giờ bật về 0%)', async () => {
    const onOpacityChange = vi.fn()
    const user = userEvent.setup()
    render(<OnionInline language="vi+en" opacity={0} onOpacityChange={onOpacityChange} lastOpacity={0} />)
    await user.click(screen.getByTestId('onion-inline-off'))
    expect(onOpacityChange).toHaveBeenCalledWith(0.4)
  })
})

describe('OnionInline — ② trạng thái BẬT gọn ("👻 N%")', () => {
  it('opacity>0, chưa chạm → hiện "👻 N%" gọn, KHÔNG tự bung slider', () => {
    render(<OnionInline language="vi+en" opacity={0.6} onOpacityChange={vi.fn()} lastOpacity={0.6} />)
    expect(screen.getByTestId('onion-inline-compact')).toHaveTextContent('60%')
    expect(screen.queryByTestId('onion-inline-expanded')).not.toBeInTheDocument()
  })

  it('bấm cụm gọn → CHUYỂN sang ③ bung slider (không đổi opacity, chỉ đổi UI cục bộ)', async () => {
    const onOpacityChange = vi.fn()
    const user = userEvent.setup()
    render(<OnionInline language="vi+en" opacity={0.6} onOpacityChange={onOpacityChange} lastOpacity={0.6} />)
    await user.click(screen.getByTestId('onion-inline-compact'))
    expect(screen.getByTestId('onion-inline-expanded')).toBeInTheDocument()
    expect(onOpacityChange).not.toHaveBeenCalled()
  })
})

describe('OnionInline — ③ trạng thái ĐANG CHỈNH (slider bung)', () => {
  it('kéo slider → onOpacityChange(newValue/100) đúng bước 5%', async () => {
    const onOpacityChange = vi.fn()
    const user = userEvent.setup()
    render(<OnionInline language="vi+en" opacity={0.6} onOpacityChange={onOpacityChange} lastOpacity={0.6} />)
    await user.click(screen.getByTestId('onion-inline-compact'))

    const slider = screen.getByTestId('onion-inline-slider') as HTMLInputElement
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    nativeSetter?.call(slider, '75')
    slider.dispatchEvent(new Event('input', { bubbles: true }))
    // React onChange nghe cả 'input' cho <input type=range> qua synthetic event — dùng change thay thế an toàn.
    slider.dispatchEvent(new Event('change', { bubbles: true }))

    expect(onOpacityChange).toHaveBeenCalledWith(0.75)
  })

  it('bấm nút 👻 thu gọn → về lại ② compact', async () => {
    const user = userEvent.setup()
    render(<OnionInline language="vi+en" opacity={0.6} onOpacityChange={vi.fn()} lastOpacity={0.6} />)
    await user.click(screen.getByTestId('onion-inline-compact'))
    expect(screen.getByTestId('onion-inline-expanded')).toBeInTheDocument()

    await user.click(screen.getByTestId('onion-inline-collapse'))
    expect(screen.getByTestId('onion-inline-compact')).toBeInTheDocument()
    expect(screen.queryByTestId('onion-inline-expanded')).not.toBeInTheDocument()
  })
})
