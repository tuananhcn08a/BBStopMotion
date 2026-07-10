/**
 * F7/Q6a — tầng lưu trữ Library web (IndexedDB, metadata-only). BA Scenario: TS-BS-26
 * "Library reload vẫn còn phim" (đọc lại từ IndexedDB sau khi đóng/mở tab). jsdom KHÔNG
 * implement IndexedDB → dùng `fake-indexeddb/auto` để có driver thật trong Node, round-trip
 * qua các API public của `src/lib/libraryDb.ts` (không mock nội bộ — test hành vi thật).
 *
 * Trước bản vá này, `web/tests/` không có test nào cho libraryDb.ts (architect gate FAIL, T-BS12).
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  addLibraryEntry,
  listLibraryEntries,
  deleteLibraryEntry,
  updateLibraryEntry,
} from '../src/lib/libraryDb'
import { LibraryEntry } from '../src/types'

function makeEntry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id: 'lib-a',
    title: 'Phim thử nghiệm',
    thumbnailDataUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ycACwAAAAABAAEAAAIBTAA7',
    frameCount: 20,
    durationSeconds: 2.0,
    createdAt: Date.now(),
    ...overrides,
  }
}

// indexedDB (fake-indexeddb) giữ nguyên state giữa các test trong cùng file — xoá DB trước
// mỗi test để mô phỏng đúng "round-trip sạch": ghi → đọc lại, không lẫn dữ liệu test khác.
beforeEach(async () => {
  const existing = await listLibraryEntries().catch(() => [] as LibraryEntry[])
  await Promise.all(existing.map(e => deleteLibraryEntry(e.id)))
})

describe('libraryDb — IndexedDB round-trip (F7/Q6a, TS-BS-26)', () => {
  it('add → list: phim vừa lưu đọc lại được đúng dữ liệu (mô phỏng reload tab)', async () => {
    const entry = makeEntry({ id: 'lib-1', title: 'Robot bay 🚀', uploadUrl: 'https://example.com/robot.mp4' })
    await addLibraryEntry(entry)

    // "Reload" = gọi listLibraryEntries() như App.tsx làm lúc mount — không còn state trong bộ nhớ.
    const entries = await listLibraryEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toEqual(entry)
  })

  it('list sắp xếp theo createdAt giảm dần (phim mới nhất lên đầu)', async () => {
    const older = makeEntry({ id: 'lib-old', createdAt: 1000 })
    const newer = makeEntry({ id: 'lib-new', createdAt: 5000 })
    await addLibraryEntry(older)
    await addLibraryEntry(newer)

    const entries = await listLibraryEntries()
    expect(entries.map(e => e.id)).toEqual(['lib-new', 'lib-old'])
  })

  it('delete: phim biến khỏi list sau khi xoá, các phim khác vẫn còn', async () => {
    await addLibraryEntry(makeEntry({ id: 'lib-keep', createdAt: 1 }))
    await addLibraryEntry(makeEntry({ id: 'lib-gone', createdAt: 2 }))

    await deleteLibraryEntry('lib-gone')

    const entries = await listLibraryEntries()
    expect(entries.map(e => e.id)).toEqual(['lib-keep'])
  })

  it('update (TS-BS-22 wiring): patch uploadUrl sau khi "Tải lên lại" thành công, đọc lại thấy giá trị mới', async () => {
    await addLibraryEntry(makeEntry({ id: 'lib-u', uploadUrl: undefined, expiresAt: undefined }))

    await updateLibraryEntry('lib-u', {
      uploadUrl: 'https://example.com/lib-u.mp4',
      expiresAt: '2026-07-20T00:00:00Z',
    })

    const [entry] = await listLibraryEntries()
    expect(entry.uploadUrl).toBe('https://example.com/lib-u.mp4')
    expect(entry.expiresAt).toBe('2026-07-20T00:00:00Z')
    // Các field khác không bị patch phải giữ nguyên
    expect(entry.title).toBe('Phim thử nghiệm')
  })
})
