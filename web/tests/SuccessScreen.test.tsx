/**
 * F8/Q6b — auto-upload OFF (mặc định trên web): Success hiện banner "chưa tải lên" +
 * nút "Tải lên ngay" thủ công thay vì QR mặc định. BA Scenario: TS-BS-28.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SuccessScreen from '../src/components/SuccessScreen'
import type { ExportResult } from '../src/types'

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockqr') },
}))

const mockUploadExportedFile = vi.fn()
vi.mock('../src/hooks/useExport', () => ({
  uploadExportedFile: (...args: unknown[]) => mockUploadExportedFile(...args),
}))

function makeResult(overrides: Partial<ExportResult> = {}): ExportResult {
  return {
    blob: new Blob(['fake'], { type: 'video/mp4' }),
    filename: 'phim-test.mp4',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn().mockReturnValue('blob:mock'),
    revokeObjectURL: vi.fn(),
  })
})

describe('SuccessScreen — auto-upload OFF (F8/TS-BS-28)', () => {
  it('autoUpload=false, chưa có uploadUrl → hiện banner "chưa tải lên" + nút "Tải lên ngay" thay vì QR', () => {
    render(
      <SuccessScreen
        result={makeResult()}
        onNewFilm={vi.fn()}
        language="vi+en"
        frameCount={10}
        durationSeconds={2}
        autoUpload={false}
      />
    )
    expect(screen.getByTestId('not-uploaded-card')).toBeInTheDocument()
    expect(screen.getByTestId('upload-now-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('qr-card')).not.toBeInTheDocument()
  })

  it('bấm "Tải lên ngay" gọi uploadExportedFile, thành công → hiện QR + parent-notice', async () => {
    mockUploadExportedFile.mockResolvedValue({
      downloadUrl: 'https://example.com/movie.mp4',
      expiresAt: '2026-07-20T00:00:00Z',
    })
    render(
      <SuccessScreen
        result={makeResult()}
        onNewFilm={vi.fn()}
        language="vi+en"
        frameCount={10}
        durationSeconds={2}
        autoUpload={false}
      />
    )
    const user = userEvent.setup()
    await user.click(screen.getByTestId('upload-now-btn'))

    await waitFor(() => {
      expect(mockUploadExportedFile).toHaveBeenCalledWith(expect.any(Blob), 'phim-test.mp4')
    })
    await waitFor(() => {
      expect(screen.getByTestId('parent-notice')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('not-uploaded-card')).not.toBeInTheDocument()
  })

  it('đã có uploadUrl sẵn (vd autoUpload=true thành công) → hiện thẳng QR card, không hiện nút Tải lên ngay', async () => {
    render(
      <SuccessScreen
        result={makeResult({ uploadUrl: 'https://example.com/movie.mp4', expiresAt: '2026-07-20T00:00:00Z' })}
        onNewFilm={vi.fn()}
        language="vi+en"
        frameCount={10}
        durationSeconds={2}
        autoUpload={true}
      />
    )
    await waitFor(() => {
      expect(screen.getByTestId('parent-notice')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('upload-now-btn')).not.toBeInTheDocument()
  })

  it('Tải về máy luôn khả dụng bất kể trạng thái upload (degraded success — TS-BS-31)', () => {
    render(
      <SuccessScreen
        result={makeResult()}
        onNewFilm={vi.fn()}
        language="vi+en"
        frameCount={10}
        durationSeconds={2}
        autoUpload={false}
      />
    )
    expect(screen.getByLabelText('Tải phim về máy')).toBeInTheDocument()
  })

  // ─── T-BS11 (QA gate-web-report.md) — bilingual "VN · EN" không bị nuốt EN ───────────

  it('T-BS11: nút Tải về máy / Làm phim mới hiện cả VN lẫn EN', () => {
    render(
      <SuccessScreen
        result={makeResult()}
        onNewFilm={vi.fn()}
        language="vi+en"
        frameCount={10}
        durationSeconds={2}
        autoUpload={false}
      />
    )
    expect(screen.getByLabelText('Tải phim về máy')).toHaveTextContent('Download')
    expect(screen.getByLabelText(/Làm phim mới/)).toHaveTextContent('New film')
  })

  it('T-BS11: subtitle hiện tiền tố EN "Your movie is ready" khi language != vi', () => {
    render(
      <SuccessScreen
        result={makeResult()}
        onNewFilm={vi.fn()}
        language="vi+en"
        frameCount={10}
        durationSeconds={2}
        autoUpload={false}
      />
    )
    expect(screen.getByText(/Your movie is ready/)).toBeInTheDocument()
  })

  it('T-BS11: subtitle KHÔNG hiện tiền tố EN khi language = vi (F4: ẩn hoàn toàn EN)', () => {
    render(
      <SuccessScreen
        result={makeResult()}
        onNewFilm={vi.fn()}
        language="vi"
        frameCount={10}
        durationSeconds={2}
        autoUpload={false}
      />
    )
    expect(screen.queryByText(/Your movie is ready/)).not.toBeInTheDocument()
  })

  // ─── T-BS66 (PO test iPhone thật) — nút play không phát video ────────────────────────

  it('T-BS66: bấm nút play trên khung video → gọi video.play() thật', async () => {
    const playSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    render(
      <SuccessScreen
        result={makeResult()}
        onNewFilm={vi.fn()}
        language="vi+en"
        frameCount={10}
        durationSeconds={2}
        autoUpload={false}
      />
    )
    const user = userEvent.setup()
    await user.click(screen.getByTestId('success-play-btn'))
    expect(playSpy).toHaveBeenCalledTimes(1)
    playSpy.mockRestore()
  })

  // ─── T-BS66 — "Tải về máy" tải nhầm trang HTML thay vì file MP4 trên iOS Safari ───────

  it('T-BS66: có Web Share API hỗ trợ chia sẻ file → dùng navigator.share(file MP4), không tải qua thẻ <a>', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined)
    const canShareMock = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, 'share', { configurable: true, value: shareMock })
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShareMock })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(
      <SuccessScreen
        result={makeResult()}
        onNewFilm={vi.fn()}
        language="vi+en"
        frameCount={10}
        durationSeconds={2}
        autoUpload={false}
      />
    )
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Tải phim về máy'))

    await waitFor(() => expect(shareMock).toHaveBeenCalledTimes(1))
    const shareArg = shareMock.mock.calls[0][0] as { files: File[] }
    expect(shareArg.files[0]).toBeInstanceOf(File)
    expect(shareArg.files[0].name).toBe('phim-test.mp4')
    expect(shareArg.files[0].type).toBe('video/mp4')
    expect(clickSpy).not.toHaveBeenCalled()

    clickSpy.mockRestore()
    delete (navigator as unknown as { share?: unknown }).share
    delete (navigator as unknown as { canShare?: unknown }).canShare
  })

  it('T-BS66: không hỗ trợ Web Share API (desktop) → fallback tải qua thẻ <a download> đúng file MP4', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(
      <SuccessScreen
        result={makeResult()}
        onNewFilm={vi.fn()}
        language="vi+en"
        frameCount={10}
        durationSeconds={2}
        autoUpload={false}
      />
    )
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Tải phim về máy'))

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1))
    clickSpy.mockRestore()
  })
})
