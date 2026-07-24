/**
 * T-XW05 — S2 Sheet tạo dự án. AC2 (chọn 🎭/🌱 → `onCreate(kind, title)` đúng), mặc định 🎭 Hoạt
 * hình đã chọn sẵn (CTA luôn sẵn sàng bấm — khớp iOS `selectedKind: ProjectKind = .animation`),
 * tên gợi ý đổi theo pool khi đổi thể loại, nút ✕ chỉ hiện khi có chữ, hint 🌱 chỉ hiện khi chọn
 * Nhật ký, đóng qua backdrop.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NewProjectSheet from '../src/components/NewProjectSheet'

const ANIMATION_NAMES = [
  'Khủng long phiêu lưu', 'Chú mèo học bay', 'Rô-bốt nhảy múa',
  'Công chúa và rồng', 'Siêu xe bay', 'Bữa tiệc đồ chơi',
]
const DIARY_NAMES = [
  'Cây đậu của em', 'Nhật ký lớn lên', 'Chậu hoa nhỏ',
  'Chú cún lớn nhanh', 'Vườn rau của em', 'Hạt mầm kỳ diệu',
]

describe('NewProjectSheet — mặc định + chọn thể loại (AC2)', () => {
  it('mở sheet: 🎭 Hoạt hình đã chọn sẵn, tên gợi ý thuộc pool animation, hint diary KHÔNG hiện', () => {
    render(<NewProjectSheet language="vi+en" onCreate={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByTestId('new-project-type-animation')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('new-project-type-diary')).toHaveAttribute('aria-pressed', 'false')

    const input = screen.getByTestId('new-project-name-input') as HTMLInputElement
    expect(ANIMATION_NAMES).toContain(input.value)

    expect(screen.queryByText(/Mỗi ngày chụp 1-3 ảnh/)).not.toBeInTheDocument()
  })

  it('bấm 🌱 Nhật ký → chọn diary, tên đổi sang pool diary, hint 🌱 hiện ra', async () => {
    const user = userEvent.setup()
    render(<NewProjectSheet language="vi+en" onCreate={vi.fn()} onClose={vi.fn()} />)

    await user.click(screen.getByTestId('new-project-type-diary'))

    expect(screen.getByTestId('new-project-type-diary')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('new-project-type-animation')).toHaveAttribute('aria-pressed', 'false')

    const input = screen.getByTestId('new-project-name-input') as HTMLInputElement
    expect(DIARY_NAMES).toContain(input.value)

    expect(screen.getByText(/Mỗi ngày chụp 1-3 ảnh/)).toBeInTheDocument()
  })

  it('bấm CTA "Bắt đầu chụp" → onCreate("animation", <tên hiện tại>) khi chưa đổi thể loại', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<NewProjectSheet language="vi+en" onCreate={onCreate} onClose={vi.fn()} />)

    const input = screen.getByTestId('new-project-name-input') as HTMLInputElement
    const initialName = input.value

    await user.click(screen.getByTestId('new-project-cta'))
    expect(onCreate).toHaveBeenCalledWith('animation', initialName)
  })

  it('bấm 🌱 rồi bấm CTA → onCreate("diary", <tên pool diary>)', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<NewProjectSheet language="vi+en" onCreate={onCreate} onClose={vi.fn()} />)

    await user.click(screen.getByTestId('new-project-type-diary'))
    await user.click(screen.getByTestId('new-project-cta'))

    expect(onCreate).toHaveBeenCalledTimes(1)
    const [kind, title] = onCreate.mock.calls[0]
    expect(kind).toBe('diary')
    expect(DIARY_NAMES).toContain(title)
  })
})

describe('NewProjectSheet — tên dự án (T-XP25 Đ2 AC3 — nút ✕ trong ô nhập)', () => {
  it('nút ✕ HIỆN khi có chữ, bấm ✕ → xoá sạch tên', async () => {
    const user = userEvent.setup()
    render(<NewProjectSheet language="vi+en" onCreate={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByTestId('new-project-name-clear')).toBeInTheDocument()
    await user.click(screen.getByTestId('new-project-name-clear'))

    const input = screen.getByTestId('new-project-name-input') as HTMLInputElement
    expect(input.value).toBe('')
    expect(screen.queryByTestId('new-project-name-clear')).not.toBeInTheDocument()
  })

  it('gõ tên tuỳ ý → input cập nhật, CTA dùng đúng tên đó', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<NewProjectSheet language="vi+en" onCreate={onCreate} onClose={vi.fn()} />)

    const input = screen.getByTestId('new-project-name-input') as HTMLInputElement
    await user.clear(input)
    await user.type(input, 'Phim của Bo')
    await user.click(screen.getByTestId('new-project-cta'))

    expect(onCreate).toHaveBeenCalledWith('animation', 'Phim của Bo')
  })
})

describe('NewProjectSheet — đóng sheet', () => {
  it('bấm backdrop → gọi onClose', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<NewProjectSheet language="vi+en" onCreate={vi.fn()} onClose={onClose} />)

    await user.click(screen.getByTestId('new-project-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('bấm bên trong sheet KHÔNG đóng (stopPropagation)', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<NewProjectSheet language="vi+en" onCreate={vi.fn()} onClose={onClose} />)

    await user.click(screen.getByTestId('new-project-sheet'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('NewProjectSheet — "Mở dự án từ file" (wave-6, hiện nhưng vô hiệu)', () => {
  it('hiện hint, KHÔNG phải nút bấm được (aria-disabled)', () => {
    render(<NewProjectSheet language="vi+en" onCreate={vi.fn()} onClose={vi.fn()} />)
    const openFile = screen.getByTestId('new-project-open-file')
    expect(openFile).toHaveAttribute('aria-disabled', 'true')
  })
})
