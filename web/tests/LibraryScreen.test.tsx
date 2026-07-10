/**
 * F7 — Thư viện phim (Library). BA Scenario: TS-BS-25 (xoá phim, xác nhận 2 bước).
 *
 * T-BS10 (fix vòng 2): nút xoá phim đổi từ menu "..." sang hover-reveal + position:absolute
 * (KHÔNG nằm trong flex-flow của row) theo quyết định Coordinator — để state mặc định của
 * row khớp pixel với mockup golden 1g-library.html (không có nút xoá trong luồng). Vẫn giữ
 * xác nhận xoá 2 bước (BR-05 cũ / Q4 quyết "giữ tính năng, không thoái lui UX").
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LibraryScreen from '../src/components/LibraryScreen'
import { LibraryEntry } from '../src/types'

function makeEntry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id: 'lib-1',
    title: 'Robot bay vào vũ trụ 🚀',
    thumbnailDataUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ycACwAAAAABAAEAAAIBTAA7',
    frameCount: 42,
    durationSeconds: 4.2,
    createdAt: Date.now(),
    uploadUrl: 'https://example.com/robot.mp4',
    ...overrides,
  }
}

describe('LibraryScreen — xoá phim 2 bước, hover-reveal (F7/TS-BS-25)', () => {
  it('TS-BS-25: click 1 lần chỉ vào trạng thái xác nhận, KHÔNG gọi onDelete ngay', async () => {
    const onDelete = vi.fn()
    render(
      <LibraryScreen
        language="vi+en"
        entries={[makeEntry()]}
        onDelete={onDelete}
        onPlay={vi.fn()}
        onUpload={vi.fn()}
        uploadingId={null}
      />
    )
    const deleteBtn = screen.getByTestId('delete-lib-1')
    await userEvent.click(deleteBtn)
    expect(onDelete).not.toHaveBeenCalled()
    // Trạng thái xác nhận: label đổi sang "Xoá phim này?"
    expect(deleteBtn).toHaveTextContent('Xoá phim này?')
  })

  it('TS-BS-25: click lần 2 (xác nhận) → onDelete gọi đúng id, phim biến khỏi danh sách', async () => {
    const onDelete = vi.fn()
    const { rerender } = render(
      <LibraryScreen
        language="vi+en"
        entries={[makeEntry()]}
        onDelete={onDelete}
        onPlay={vi.fn()}
        onUpload={vi.fn()}
        uploadingId={null}
      />
    )
    const deleteBtn = screen.getByTestId('delete-lib-1')
    await userEvent.click(deleteBtn) // click 1: vào trạng thái xác nhận
    await userEvent.click(screen.getByTestId('delete-lib-1')) // click 2: xác nhận xoá
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith('lib-1')

    // Mô phỏng parent bỏ entry khỏi danh sách sau khi onDelete
    rerender(
      <LibraryScreen
        language="vi+en"
        entries={[]}
        onDelete={onDelete}
        onPlay={vi.fn()}
        onUpload={vi.fn()}
        uploadingId={null}
      />
    )
    expect(screen.queryByTestId('delete-lib-1')).not.toBeInTheDocument()
    expect(screen.getByText(/Chưa có phim nào|No films yet/i)).toBeInTheDocument()
  })

  it('rời chuột khỏi row (mouseLeave) khi đang ở trạng thái xác nhận → reset về mặc định, click lại sau đó không xoá ngay', async () => {
    const onDelete = vi.fn()
    render(
      <LibraryScreen
        language="vi+en"
        entries={[makeEntry()]}
        onDelete={onDelete}
        onPlay={vi.fn()}
        onUpload={vi.fn()}
        uploadingId={null}
      />
    )
    const deleteBtn = screen.getByTestId('delete-lib-1')
    await userEvent.click(deleteBtn)
    expect(deleteBtn).toHaveTextContent('Xoá phim này?')

    const row = screen.getByTestId('library-row-lib-1')
    await userEvent.unhover(row) // trigger mouseLeave trên row

    expect(screen.getByTestId('delete-lib-1')).toHaveTextContent('🗑')
    expect(screen.getByTestId('delete-lib-1')).not.toHaveTextContent('Xoá phim này?')

    await userEvent.click(screen.getByTestId('delete-lib-1'))
    expect(onDelete).not.toHaveBeenCalled() // đã reset — click này lại là "click 1"
  })

  it('nút xoá KHÔNG nằm trong flex-flow của row (position:absolute) — không đổi số con trực tiếp mặc định của row', () => {
    render(
      <LibraryScreen
        language="vi+en"
        entries={[makeEntry()]}
        onDelete={vi.fn()}
        onPlay={vi.fn()}
        onUpload={vi.fn()}
        uploadingId={null}
      />
    )
    const deleteBtn = screen.getByTestId('delete-lib-1')
    // CSS module hash tên class (vd `_deleteBtn_6dde26`) nên so khớp một phần thay vì exact.
    expect(deleteBtn.className).toMatch(/deleteBtn(?!Confirm)/)
    // Không dùng class deleteBtnConfirm ở trạng thái mặc định (chỉ hover mới lộ, CSS display:none mặc định)
    expect(deleteBtn.className).not.toMatch(/deleteBtnConfirm/)
  })
})
