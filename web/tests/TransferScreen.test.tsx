/**
 * T-XW21 (S6) — `TransferScreen.tsx`: xuất (hiện tên+dung lượng THẬT trước khi bấm) + nhập (parse
 * → commit, hỏi Ghi đè/Nhân bản khi trùng id) + đóng (backdrop/ESC/nút Đóng).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TransferScreen from '../src/components/TransferScreen'
import { ProjectMeta } from '../src/lib/project/types'
import type { ParsedImport } from '../src/lib/project/bbsprojArchive'

const exportProjectToBbsprojMock = vi.fn()
const parseBbsprojFileMock = vi.fn()
const commitParsedImportMock = vi.fn()
vi.mock('../src/lib/project/bbsprojArchive', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/project/bbsprojArchive')>('../src/lib/project/bbsprojArchive')
  return {
    ...actual,
    exportProjectToBbsproj: (...args: unknown[]) => exportProjectToBbsprojMock(...args),
    parseBbsprojFile: (...args: unknown[]) => parseBbsprojFileMock(...args),
    commitParsedImport: (...args: unknown[]) => commitParsedImportMock(...args),
  }
})

const listProjectsMock = vi.fn().mockResolvedValue([])
vi.mock('../src/lib/project/db', () => ({
  listProjects: () => listProjectsMock(),
}))

function makeProject(overrides: Partial<ProjectMeta> = {}): ProjectMeta {
  return {
    id: 'proj-1', title: 'Cây đậu của Bin', kind: 'diary', fpsLevel: 'slow',
    frameCount: 5, createdAt: 1700000000000, ...overrides,
  }
}

function selectFile(file: File) {
  const input = screen.getByTestId('transfer-import-file-input') as HTMLInputElement
  Object.defineProperty(input, 'files', { value: [file], writable: false, configurable: true })
  fireEvent.change(input)
}

beforeEach(() => {
  vi.restoreAllMocks()
  exportProjectToBbsprojMock.mockReset()
  parseBbsprojFileMock.mockReset()
  commitParsedImportMock.mockReset()
  listProjectsMock.mockReset().mockResolvedValue([])
})

describe('TransferScreen — Xuất file dự án (AC1: tên + dung lượng THẬT trước khi bấm)', () => {
  it('gọi exportProjectToBbsproj(project.id) lúc mount, hiện tên file + dung lượng khi xong', async () => {
    const blob = new Blob(['x'.repeat(2048)], { type: 'application/zip' })
    exportProjectToBbsprojMock.mockResolvedValue({ blob, fileName: 'cay-dau-cua-bin.bbsproj' })

    render(<TransferScreen language="vi" project={makeProject()} onClose={vi.fn()} onImported={vi.fn()} />)

    expect(exportProjectToBbsprojMock).toHaveBeenCalledWith('proj-1')
    const link = await screen.findByTestId('transfer-export-link')
    expect(link).toHaveTextContent('cay-dau-cua-bin.bbsproj')
    expect(link).toHaveTextContent('2 KB')
    expect(link).toHaveAttribute('download', 'cay-dau-cua-bin.bbsproj')
  })

  it('export thất bại (null) → hiện thông báo lỗi', async () => {
    exportProjectToBbsprojMock.mockResolvedValue(null)
    render(<TransferScreen language="vi" project={makeProject()} onClose={vi.fn()} onImported={vi.fn()} />)
    expect(await screen.findByTestId('transfer-export-error')).toBeInTheDocument()
  })
})

describe('TransferScreen — Nhập dự án từ file (AC4 validator + trùng id)', () => {
  it('parse OK, không trùng id → commit "notDuplicate", hiện thông báo thành công, gọi onImported', async () => {
    exportProjectToBbsprojMock.mockResolvedValue({ blob: new Blob(['x']), fileName: 'a.bbsproj' })
    const parsedValue = { project: { id: 'proj-new' }, frameBytesBySeq: new Map(), isDuplicateId: false } as unknown as ParsedImport
    parseBbsprojFileMock.mockResolvedValue({ ok: true, value: parsedValue })
    commitParsedImportMock.mockResolvedValue({ id: 'proj-new' })
    const onImported = vi.fn()

    render(<TransferScreen language="vi" project={makeProject()} onClose={vi.fn()} onImported={onImported} />)
    selectFile(new File(['zip'], 'x.bbsproj'))

    await waitFor(() => expect(commitParsedImportMock).toHaveBeenCalledWith(parsedValue, 'notDuplicate'))
    expect(await screen.findByTestId('transfer-import-success')).toBeInTheDocument()
    expect(onImported).toHaveBeenCalledTimes(1)
  })

  it('parse lỗi (schemaVersionTooNew) → hiện đúng thông báo "Hãy cập nhật app..."', async () => {
    exportProjectToBbsprojMock.mockResolvedValue({ blob: new Blob(['x']), fileName: 'a.bbsproj' })
    parseBbsprojFileMock.mockResolvedValue({ ok: false, error: 'schemaVersionTooNew' })

    render(<TransferScreen language="vi" project={makeProject()} onClose={vi.fn()} onImported={vi.fn()} />)
    selectFile(new File(['zip'], 'x.bbsproj'))

    const err = await screen.findByTestId('transfer-import-error')
    expect(err).toHaveTextContent('Hãy cập nhật app để mở file này')
    expect(commitParsedImportMock).not.toHaveBeenCalled()
  })

  it('trùng id → hiện hộp Ghi đè/Nhân bản/Huỷ, KHÔNG commit ngay', async () => {
    exportProjectToBbsprojMock.mockResolvedValue({ blob: new Blob(['x']), fileName: 'a.bbsproj' })
    const parsedValue = { project: { id: 'proj-1' }, frameBytesBySeq: new Map(), isDuplicateId: true } as unknown as ParsedImport
    parseBbsprojFileMock.mockResolvedValue({ ok: true, value: parsedValue })

    render(<TransferScreen language="vi" project={makeProject()} onClose={vi.fn()} onImported={vi.fn()} />)
    selectFile(new File(['zip'], 'x.bbsproj'))

    expect(await screen.findByTestId('transfer-duplicate-box')).toBeInTheDocument()
    expect(commitParsedImportMock).not.toHaveBeenCalled()
  })

  it('trùng id → bấm "Ghi đè bản cũ" → commit resolution="overwrite"', async () => {
    exportProjectToBbsprojMock.mockResolvedValue({ blob: new Blob(['x']), fileName: 'a.bbsproj' })
    const parsedValue = { project: { id: 'proj-1' }, frameBytesBySeq: new Map(), isDuplicateId: true } as unknown as ParsedImport
    parseBbsprojFileMock.mockResolvedValue({ ok: true, value: parsedValue })
    commitParsedImportMock.mockResolvedValue({ id: 'proj-1' })

    render(<TransferScreen language="vi" project={makeProject()} onClose={vi.fn()} onImported={vi.fn()} />)
    selectFile(new File(['zip'], 'x.bbsproj'))
    fireEvent.click(await screen.findByTestId('transfer-duplicate-overwrite'))

    await waitFor(() => expect(commitParsedImportMock).toHaveBeenCalledWith(parsedValue, 'overwrite'))
  })

  it('trùng id → bấm "Giữ cả 2 (nhân bản)" → commit resolution="duplicate"', async () => {
    exportProjectToBbsprojMock.mockResolvedValue({ blob: new Blob(['x']), fileName: 'a.bbsproj' })
    const parsedValue = { project: { id: 'proj-1' }, frameBytesBySeq: new Map(), isDuplicateId: true } as unknown as ParsedImport
    parseBbsprojFileMock.mockResolvedValue({ ok: true, value: parsedValue })
    commitParsedImportMock.mockResolvedValue({ id: 'proj-2' })

    render(<TransferScreen language="vi" project={makeProject()} onClose={vi.fn()} onImported={vi.fn()} />)
    selectFile(new File(['zip'], 'x.bbsproj'))
    fireEvent.click(await screen.findByTestId('transfer-duplicate-duplicate'))

    await waitFor(() => expect(commitParsedImportMock).toHaveBeenCalledWith(parsedValue, 'duplicate'))
  })

  it('trùng id → bấm "Huỷ" → KHÔNG commit gì, quay lại nút nhập bình thường', async () => {
    exportProjectToBbsprojMock.mockResolvedValue({ blob: new Blob(['x']), fileName: 'a.bbsproj' })
    const parsedValue = { project: { id: 'proj-1' }, frameBytesBySeq: new Map(), isDuplicateId: true } as unknown as ParsedImport
    parseBbsprojFileMock.mockResolvedValue({ ok: true, value: parsedValue })

    render(<TransferScreen language="vi" project={makeProject()} onClose={vi.fn()} onImported={vi.fn()} />)
    selectFile(new File(['zip'], 'x.bbsproj'))
    fireEvent.click(await screen.findByTestId('transfer-duplicate-cancel'))

    expect(commitParsedImportMock).not.toHaveBeenCalled()
    expect(await screen.findByTestId('transfer-import-btn')).toBeInTheDocument()
  })
})

describe('TransferScreen — đóng', () => {
  it('backdrop/ESC/nút Đóng đều gọi onClose', async () => {
    exportProjectToBbsprojMock.mockResolvedValue({ blob: new Blob(['x']), fileName: 'a.bbsproj' })
    const onClose = vi.fn()
    render(<TransferScreen language="vi" project={makeProject()} onClose={onClose} onImported={vi.fn()} />)
    await screen.findByTestId('transfer-export-link')

    fireEvent.click(screen.getByTestId('transfer-close-btn'))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByTestId('transfer-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})
