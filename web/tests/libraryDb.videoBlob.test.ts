/**
 * T-XW17 AC4 — persist blob MP4 trong IndexedDB (`saveLibraryVideoBlob`/`getLibraryVideoBlob`/
 * `deleteLibraryVideoBlob`, store `videoBlobs` v3), THAY `blobCacheRef` RAM-only (mất khi reload).
 * Round-trip qua API public — không mock nội bộ, dùng `fake-indexeddb` (driver thật trong Node).
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { DB_NAME, resetAppDbConnectionForTests } from '../src/lib/db/appDb'
import { deleteLibraryVideoBlob, getLibraryVideoBlob, saveLibraryVideoBlob } from '../src/lib/libraryDb'

async function deleteDb(): Promise<void> {
  await resetAppDbConnectionForTests()
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error ?? new Error('deleteDatabase failed'))
    req.onblocked = () => resolve()
  })
}

beforeEach(async () => {
  await deleteDb()
})

async function blobText(blob: Blob): Promise<string> {
  return new TextDecoder().decode(await blob.arrayBuffer())
}

describe('saveLibraryVideoBlob / getLibraryVideoBlob — round-trip (T-XW17 AC4)', () => {
  it('lưu rồi đọc lại đúng nội dung bytes + mimeType (mô phỏng reload trang)', async () => {
    const blob = new Blob(['fake-mp4-bytes'], { type: 'video/mp4' })
    await saveLibraryVideoBlob('film-1', blob)

    // "Reload" = mở lại kết nối DB mới (như `getLibraryVideoBlob` gọi App.tsx làm sau F5 thật).
    const readBack = await getLibraryVideoBlob('film-1')

    expect(readBack).toBeInstanceOf(Blob)
    expect(readBack?.type).toBe('video/mp4')
    expect(await blobText(readBack!)).toBe('fake-mp4-bytes')
  })

  it('id không tồn tại → undefined (không throw)', async () => {
    const readBack = await getLibraryVideoBlob('khong-ton-tai')
    expect(readBack).toBeUndefined()
  })

  it('blob không có `.type` (mime rỗng) → fallback "video/mp4"', async () => {
    const blob = new Blob(['bytes-khong-mime'])
    expect(blob.type).toBe('')
    await saveLibraryVideoBlob('film-no-mime', blob)

    const readBack = await getLibraryVideoBlob('film-no-mime')
    expect(readBack?.type).toBe('video/mp4')
  })

  it('ghi lại cùng id (upload lại/export lại) → GHI ĐÈ bản cũ, đọc ra bản MỚI nhất', async () => {
    await saveLibraryVideoBlob('film-x', new Blob(['ban-cu'], { type: 'video/mp4' }))
    await saveLibraryVideoBlob('film-x', new Blob(['ban-moi'], { type: 'video/mp4' }))

    const readBack = await getLibraryVideoBlob('film-x')
    expect(await blobText(readBack!)).toBe('ban-moi')
  })

  it('nhiều entry độc lập — xoá 1 KHÔNG ảnh hưởng blob của entry khác', async () => {
    await saveLibraryVideoBlob('film-a', new Blob(['A'], { type: 'video/mp4' }))
    await saveLibraryVideoBlob('film-b', new Blob(['B'], { type: 'video/mp4' }))

    await deleteLibraryVideoBlob('film-a')

    expect(await getLibraryVideoBlob('film-a')).toBeUndefined()
    const b = await getLibraryVideoBlob('film-b')
    expect(await blobText(b!)).toBe('B')
  })

  it('xoá id không tồn tại → không throw (no-op an toàn)', async () => {
    await expect(deleteLibraryVideoBlob('khong-ton-tai')).resolves.toBeUndefined()
  })
})
