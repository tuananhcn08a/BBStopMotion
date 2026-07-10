/**
 * F7 — Library badge/QR/tải-lên-lại. BA Scenarios: TS-BS-20, TS-BS-21 (P0), TS-BS-22 (P0).
 *
 * Trước bản vá này (T-BS12 architect FAIL): nút "QR" ở LibraryScreen.tsx:145 không có onClick/modal
 * (nút chết) và không có test nào phủ 3 scenario này.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LibraryScreen from '../src/components/LibraryScreen'
import { LibraryEntry } from '../src/types'

const mockToDataURL = vi.fn().mockResolvedValue('data:image/png;base64,mockqr')
vi.mock('qrcode', () => ({
  default: { toDataURL: (...args: unknown[]) => mockToDataURL(...args) },
}))

function makeEntry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id: 'lib-1',
    title: 'Robot bay vào vũ trụ 🚀',
    thumbnailDataUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ycACwAAAAABAAEAAAIBTAA7',
    frameCount: 42,
    durationSeconds: 4.2,
    createdAt: Date.now(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockToDataURL.mockResolvedValue('data:image/png;base64,mockqr')
})

describe('LibraryScreen — badge trạng thái + hành động theo uploadUrl (F7/TS-BS-20)', () => {
  it('TS-BS-20: phim đã upload → badge "✓ Đã tải lên" + nút "QR"; phim chưa upload → badge "⚠ Chưa tải lên" + nút "↻ Tải lên"', () => {
    const uploaded = makeEntry({ id: 'lib-ok', title: 'Đã tải lên xong', uploadUrl: 'https://example.com/ok.mp4' })
    const notUploaded = makeEntry({ id: 'lib-fail', title: 'Chưa tải lên', createdAt: Date.now() - 1000 })

    render(
      <LibraryScreen
        language="vi+en"
        entries={[uploaded, notUploaded]}
        onDelete={vi.fn()}
        onPlay={vi.fn()}
        onUpload={vi.fn()}
        uploadingId={null}
      />
    )

    const rowOk = screen.getByTestId('library-row-lib-ok')
    expect(within(rowOk).getByText(/✓ Đã tải lên/)).toBeInTheDocument()
    expect(within(rowOk).getByTestId('qr-lib-ok')).toBeInTheDocument()
    expect(within(rowOk).queryByTestId('upload-lib-ok')).not.toBeInTheDocument()

    const rowFail = screen.getByTestId('library-row-lib-fail')
    expect(within(rowFail).getByText(/⚠ Chưa tải lên/)).toBeInTheDocument()
    expect(within(rowFail).getByTestId('upload-lib-fail')).toBeInTheDocument()
    expect(within(rowFail).queryByTestId('qr-lib-fail')).not.toBeInTheDocument()
  })

  it('TS-BS-20: 2 phim cùng ngày hôm nay được nhóm chung 1 header "HÔM NAY"', () => {
    const a = makeEntry({ id: 'lib-a', createdAt: Date.now(), uploadUrl: 'https://example.com/a.mp4' })
    const b = makeEntry({ id: 'lib-b', createdAt: Date.now() - 5000 })

    render(
      <LibraryScreen
        language="vi+en"
        entries={[a, b]}
        onDelete={vi.fn()}
        onPlay={vi.fn()}
        onUpload={vi.fn()}
        uploadingId={null}
      />
    )

    const headers = screen.getAllByText(/HÔM NAY/)
    expect(headers).toHaveLength(1)
    expect(screen.getByTestId('library-row-lib-a')).toBeInTheDocument()
    expect(screen.getByTestId('library-row-lib-b')).toBeInTheDocument()
  })
})

describe('LibraryScreen — bấm QR mở modal đúng phim (F7/TS-BS-21, P0)', () => {
  it('TS-BS-21: bấm "QR" mở modal, mã QR sinh từ đúng uploadUrl của phim đó (không lẫn phim khác)', async () => {
    const filmA = makeEntry({ id: 'lib-a', title: 'Phim A', uploadUrl: 'https://example.com/a.mp4' })
    const filmB = makeEntry({ id: 'lib-b', title: 'Phim B', uploadUrl: 'https://example.com/b.mp4', createdAt: Date.now() - 1000 })

    render(
      <LibraryScreen
        language="vi+en"
        entries={[filmA, filmB]}
        onDelete={vi.fn()}
        onPlay={vi.fn()}
        onUpload={vi.fn()}
        uploadingId={null}
      />
    )

    const user = userEvent.setup()
    // Bấm QR của phim B trước (không phải phim đầu) — kiểm modal đúng phim, không lẫn phim A.
    await user.click(screen.getByTestId('qr-lib-b'))

    expect(await screen.findByTestId('qr-modal')).toBeInTheDocument()
    expect(mockToDataURL).toHaveBeenCalledWith('https://example.com/b.mp4', expect.any(Object))
    expect(screen.getByTestId('qr-modal')).toHaveTextContent('Phim B')
    expect(await screen.findByTestId('qr-modal-image')).toHaveAttribute('src', 'data:image/png;base64,mockqr')
  })

  it('TS-BS-21: đóng modal bằng nút × ', async () => {
    const filmA = makeEntry({ id: 'lib-a', uploadUrl: 'https://example.com/a.mp4' })
    render(
      <LibraryScreen
        language="vi+en"
        entries={[filmA]}
        onDelete={vi.fn()}
        onPlay={vi.fn()}
        onUpload={vi.fn()}
        uploadingId={null}
      />
    )
    const user = userEvent.setup()
    await user.click(screen.getByTestId('qr-lib-a'))
    expect(await screen.findByTestId('qr-modal')).toBeInTheDocument()

    await user.click(screen.getByTestId('qr-modal-close'))
    expect(screen.queryByTestId('qr-modal')).not.toBeInTheDocument()
  })

  it('TS-BS-21: đóng modal bằng click nền (backdrop)', async () => {
    const filmA = makeEntry({ id: 'lib-a', uploadUrl: 'https://example.com/a.mp4' })
    render(
      <LibraryScreen
        language="vi+en"
        entries={[filmA]}
        onDelete={vi.fn()}
        onPlay={vi.fn()}
        onUpload={vi.fn()}
        uploadingId={null}
      />
    )
    const user = userEvent.setup()
    await user.click(screen.getByTestId('qr-lib-a'))
    expect(await screen.findByTestId('qr-modal')).toBeInTheDocument()

    await user.click(screen.getByTestId('qr-modal-backdrop'))
    expect(screen.queryByTestId('qr-modal')).not.toBeInTheDocument()
  })

  it('TS-BS-21: đóng modal bằng phím Esc', async () => {
    const filmA = makeEntry({ id: 'lib-a', uploadUrl: 'https://example.com/a.mp4' })
    render(
      <LibraryScreen
        language="vi+en"
        entries={[filmA]}
        onDelete={vi.fn()}
        onPlay={vi.fn()}
        onUpload={vi.fn()}
        uploadingId={null}
      />
    )
    const user = userEvent.setup()
    await user.click(screen.getByTestId('qr-lib-a'))
    expect(await screen.findByTestId('qr-modal')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('qr-modal')).not.toBeInTheDocument()
  })
})

describe('LibraryScreen — "↻ Tải lên" cho phim chưa upload (F7/TS-BS-22, P0)', () => {
  it('TS-BS-22: bấm "↻ Tải lên" gọi onUpload đúng entry; sau khi parent cập nhật uploadUrl → badge/nút lật sang "✓ Đã tải lên"/"QR"', async () => {
    const onUpload = vi.fn()
    const pending = makeEntry({ id: 'lib-p', title: 'Phim chưa lên', createdAt: Date.now() })

    const { rerender } = render(
      <LibraryScreen
        language="vi+en"
        entries={[pending]}
        onDelete={vi.fn()}
        onPlay={vi.fn()}
        onUpload={onUpload}
        uploadingId={null}
      />
    )

    const user = userEvent.setup()
    expect(screen.getByTestId('upload-lib-p')).toBeInTheDocument()
    await user.click(screen.getByTestId('upload-lib-p'))
    expect(onUpload).toHaveBeenCalledTimes(1)
    expect(onUpload).toHaveBeenCalledWith(pending)

    // Mô phỏng App.tsx: upload thành công → entry cập nhật uploadUrl, parent re-render với entries mới.
    const uploaded = { ...pending, uploadUrl: 'https://example.com/lib-p.mp4', expiresAt: '2026-07-20T00:00:00Z' }
    rerender(
      <LibraryScreen
        language="vi+en"
        entries={[uploaded]}
        onDelete={vi.fn()}
        onPlay={vi.fn()}
        onUpload={onUpload}
        uploadingId={null}
      />
    )

    expect(screen.getByText(/✓ Đã tải lên/)).toBeInTheDocument()
    expect(screen.getByTestId('qr-lib-p')).toBeInTheDocument()
    expect(screen.queryByTestId('upload-lib-p')).not.toBeInTheDocument()
  })

  it('TS-BS-22: nút "↻ Tải lên" disabled + hiện "..." khi uploadingId khớp entry đang tải', () => {
    const pending = makeEntry({ id: 'lib-p' })
    render(
      <LibraryScreen
        language="vi+en"
        entries={[pending]}
        onDelete={vi.fn()}
        onPlay={vi.fn()}
        onUpload={vi.fn()}
        uploadingId="lib-p"
      />
    )
    const btn = screen.getByTestId('upload-lib-p')
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent('...')
  })
})
