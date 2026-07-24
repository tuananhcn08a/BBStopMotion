/**
 * T-XW10 AC6 — S4 Phim nháp: CTA chính "Chụp tiếp" (đổi chữ theo đã-chụp-hôm-nay-chưa cho 🌱),
 * thẻ dự phóng (growCard ≥2 ngày / neutralCard <2 ngày), export phụ disabled khi chưa đủ frame
 * tối thiểu, note "không đóng dự án", xem được kể cả rất ít frame.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DraftFilmScreen from '../src/components/DraftFilmScreen'
import { CapturedFrame } from '../src/types'

const DAY_MS = 86400000

function frameAt(id: string, daysAgo: number): CapturedFrame {
  return { id, dataUrl: `data:image/jpeg;base64,${id}`, timestamp: Date.now() - daysAgo * DAY_MS }
}

describe('DraftFilmScreen — empty state (0 frame, vẫn xem được)', () => {
  it('0 frame → hiện empty state, KHÔNG hiện meta/CTA/note', () => {
    render(
      <DraftFilmScreen
        language="vi+en" projectTitle="Cây đậu của Bin" projectKind="diary" frames={[]} fpsLevel="slow"
        onBack={vi.fn()} onExportFull={vi.fn()}
      />
    )
    expect(screen.getByText(/Chụp thêm vài ảnh để xem phim nháp/)).toBeInTheDocument()
    expect(screen.queryByTestId('draft-meta')).not.toBeInTheDocument()
    expect(screen.queryByTestId('draft-cta-primary')).not.toBeInTheDocument()
  })
})

describe('DraftFilmScreen — AC6 CTA chính đổi chữ theo đã-chụp-hôm-nay-chưa (🌱)', () => {
  it('🌱 CHƯA chụp hôm nay → "Chụp tiếp hôm nay"', () => {
    render(
      <DraftFilmScreen
        language="vi+en" projectTitle="t" projectKind="diary" frames={[frameAt('f0', 1)]} fpsLevel="slow"
        onBack={vi.fn()} onExportFull={vi.fn()}
      />
    )
    expect(screen.getByTestId('draft-cta-primary')).toHaveTextContent('Chụp tiếp hôm nay')
  })

  it('🌱 ĐÃ chụp hôm nay → "Chụp tiếp ngày mai"', () => {
    render(
      <DraftFilmScreen
        language="vi+en" projectTitle="t" projectKind="diary" frames={[frameAt('f0', 0)]} fpsLevel="slow"
        onBack={vi.fn()} onExportFull={vi.fn()}
      />
    )
    expect(screen.getByTestId('draft-cta-primary')).toHaveTextContent('Chụp tiếp ngày mai')
  })

  it('🎭 animation → luôn "Chụp tiếp" (không có khái niệm ngày)', () => {
    render(
      <DraftFilmScreen
        language="vi+en" projectTitle="t" projectKind="animation" frames={[frameAt('f0', 0)]} fpsLevel="normal"
        onBack={vi.fn()} onExportFull={vi.fn()}
      />
    )
    expect(screen.getByTestId('draft-cta-primary')).toHaveTextContent('Chụp tiếp')
    expect(screen.getByTestId('draft-cta-primary')).not.toHaveTextContent('hôm nay')
  })

  it('bấm CTA chính → gọi onBack (KHÔNG đóng dự án, chỉ đóng phim nháp)', async () => {
    const onBack = vi.fn()
    const user = userEvent.setup()
    render(
      <DraftFilmScreen
        language="vi+en" projectTitle="t" projectKind="diary" frames={[frameAt('f0', 0)]} fpsLevel="slow"
        onBack={onBack} onExportFull={vi.fn()}
      />
    )
    await user.click(screen.getByTestId('draft-cta-primary'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

describe('DraftFilmScreen — thẻ dự phóng (chỉ 🌱, ≥2 ngày khác nhau)', () => {
  it('<2 ngày khác nhau → neutralCard trung tính, KHÔNG suy diễn dự phóng', () => {
    render(
      <DraftFilmScreen
        language="vi+en" projectTitle="t" projectKind="diary" frames={[frameAt('f0', 0), frameAt('f1', 0)]} fpsLevel="slow"
        onBack={vi.fn()} onExportFull={vi.fn()}
      />
    )
    expect(screen.getByTestId('draft-neutral-card')).toBeInTheDocument()
    expect(screen.queryByTestId('draft-grow-card')).not.toBeInTheDocument()
  })

  it('≥2 ngày khác nhau → growCard hiện số ngày đã chụp', () => {
    render(
      <DraftFilmScreen
        language="vi+en" projectTitle="t" projectKind="diary"
        frames={[frameAt('f0', 1), frameAt('f1', 0)]} fpsLevel="slow"
        onBack={vi.fn()} onExportFull={vi.fn()}
      />
    )
    expect(screen.getByTestId('draft-grow-card')).toHaveTextContent('2 ngày')
  })

  it('🎭 animation — KHÔNG hiện thẻ dự phóng nào (chỉ 🌱 mới có)', () => {
    render(
      <DraftFilmScreen
        language="vi+en" projectTitle="t" projectKind="animation"
        frames={[frameAt('f0', 1), frameAt('f1', 0)]} fpsLevel="normal"
        onBack={vi.fn()} onExportFull={vi.fn()}
      />
    )
    expect(screen.queryByTestId('draft-grow-card')).not.toBeInTheDocument()
    expect(screen.queryByTestId('draft-neutral-card')).not.toBeInTheDocument()
  })
})

describe('DraftFilmScreen — export phụ + note không đóng dự án', () => {
  it('chưa đủ MIN_FRAMES_TO_EXPORT (5) → nút Xuất phim hoàn chỉnh disabled', () => {
    render(
      <DraftFilmScreen
        language="vi+en" projectTitle="t" projectKind="animation"
        frames={[frameAt('f0', 0), frameAt('f1', 0)]} fpsLevel="normal"
        onBack={vi.fn()} onExportFull={vi.fn()}
      />
    )
    expect(screen.getByTestId('draft-cta-export')).toBeDisabled()
  })

  it('đủ ≥5 frame → nút Xuất phim hoàn chỉnh bấm được, gọi onExportFull', async () => {
    const onExportFull = vi.fn()
    const user = userEvent.setup()
    render(
      <DraftFilmScreen
        language="vi+en" projectTitle="t" projectKind="animation"
        frames={Array.from({ length: 5 }, (_, i) => frameAt(`f${i}`, 0))} fpsLevel="normal"
        onBack={vi.fn()} onExportFull={onExportFull}
      />
    )
    expect(screen.getByTestId('draft-cta-export')).not.toBeDisabled()
    await user.click(screen.getByTestId('draft-cta-export'))
    expect(onExportFull).toHaveBeenCalledTimes(1)
  })

  it('hiện note "xuất xong dự án vẫn còn"', () => {
    render(
      <DraftFilmScreen
        language="vi+en" projectTitle="t" projectKind="diary" frames={[frameAt('f0', 0)]} fpsLevel="slow"
        onBack={vi.fn()} onExportFull={vi.fn()}
      />
    )
    expect(screen.getByText(/dự án vẫn còn/)).toBeInTheDocument()
  })
})
