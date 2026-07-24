/**
 * T-XW14 AC4/AC5 — `commitFrameOrder`: commit "1 phát" chế độ Sắp xếp transactional (mirror
 * `ProjectStore.commitFrameOrder` iOS) — gộp xoá + đổi vị trí trong CÙNG 1 transaction, renumber
 * liên tục 0..n-1 sau commit, no-op an toàn khi input không hợp lệ.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { DB_NAME, resetAppDbConnectionForTests } from '../src/lib/db/appDb'
import { addFrame, commitFrameOrder, createProject, getFrameBytes, getFrames } from '../src/lib/project/db'

async function deleteDb(): Promise<void> {
  await resetAppDbConnectionForTests()
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error ?? new Error('deleteDatabase failed'))
    req.onblocked = () => resolve()
  })
}

function tagBytes(tag: number): ArrayBuffer {
  const buf = new ArrayBuffer(4)
  new DataView(buf).setUint32(0, tag)
  return buf
}
function bytesToTag(buf: ArrayBuffer): number {
  return new DataView(buf).getUint32(0)
}

beforeEach(async () => {
  await deleteDb()
})

describe('commitFrameOrder — đổi vị trí (không xoá gì)', () => {
  it('đảo ngược thứ tự [2,1,0] — renumber liên tục 0..2, bytes/capturedAt đi theo đúng frame', async () => {
    const project = await createProject('animation')
    await addFrame(project.id, tagBytes(1), 100) // seq 0
    await addFrame(project.id, tagBytes(2), 200) // seq 1
    await addFrame(project.id, tagBytes(3), 300) // seq 2

    await commitFrameOrder(project.id, [2, 1, 0])

    const frames = await getFrames(project.id)
    expect(frames.map(f => f.seq)).toEqual([0, 1, 2])
    expect(frames.map(f => f.file)).toEqual(['frames/0001.jpg', 'frames/0002.jpg', 'frames/0003.jpg'])
    expect(frames.map(f => f.capturedAt)).toEqual([300, 200, 100])

    const bytes0 = await getFrameBytes(project.id, 0)
    const bytes2 = await getFrameBytes(project.id, 2)
    expect(bytesToTag(bytes0!)).toBe(3)
    expect(bytesToTag(bytes2!)).toBe(1)
  })

  it('hoán vị vòng tròn 3 phần tử [1,2,0] — không collision key giữa các bước ghi (2-phase)', async () => {
    const project = await createProject('animation')
    await addFrame(project.id, tagBytes(10), 1) // seq 0
    await addFrame(project.id, tagBytes(20), 2) // seq 1
    await addFrame(project.id, tagBytes(30), 3) // seq 2

    // newSeq 0 <- oldSeq1, newSeq1 <- oldSeq2, newSeq2 <- oldSeq0
    await commitFrameOrder(project.id, [1, 2, 0])

    const frames = await getFrames(project.id)
    expect(frames.map(f => f.seq)).toEqual([0, 1, 2])
    const bytes0 = await getFrameBytes(project.id, 0)
    const bytes1 = await getFrameBytes(project.id, 1)
    const bytes2 = await getFrameBytes(project.id, 2)
    expect(bytesToTag(bytes0!)).toBe(20)
    expect(bytesToTag(bytes1!)).toBe(30)
    expect(bytesToTag(bytes2!)).toBe(10)
  })
})

describe('commitFrameOrder — gộp XOÁ + đổi vị trí trong 1 transaction', () => {
  it('xoá seq giữa (1) + đảo 2 seq còn lại — renumber liên tục 0..1', async () => {
    const project = await createProject('animation')
    await addFrame(project.id, tagBytes(1), 1) // seq 0
    await addFrame(project.id, tagBytes(2), 2) // seq 1 (sẽ bị xoá)
    await addFrame(project.id, tagBytes(3), 3) // seq 2

    // Giữ lại seq 2 rồi seq 0 (đảo thứ tự), bỏ seq 1.
    await commitFrameOrder(project.id, [2, 0])

    const frames = await getFrames(project.id)
    expect(frames.map(f => f.seq)).toEqual([0, 1])
    const bytes0 = await getFrameBytes(project.id, 0)
    const bytes1 = await getFrameBytes(project.id, 1)
    expect(bytesToTag(bytes0!)).toBe(3)
    expect(bytesToTag(bytes1!)).toBe(1)
    // seq cũ 2 (đã renumber về 0/1) không còn record mồ côi ở vị trí seq=2 cũ.
    expect(await getFrameBytes(project.id, 2)).toBeUndefined()
  })

  it('xoá HẾT (keptSeqsInOrder rỗng) → 0 frame còn lại, denorm frameCount=0', async () => {
    const project = await createProject('animation')
    await addFrame(project.id, tagBytes(1), 1)
    await addFrame(project.id, tagBytes(2), 2)

    await commitFrameOrder(project.id, [])

    const frames = await getFrames(project.id)
    expect(frames).toEqual([])
  })
})

describe('commitFrameOrder — no-op an toàn (bảo vệ state lệch/race)', () => {
  it('keptSeqsInOrder trùng lặp phần tử → no-op, KHÔNG đổi gì', async () => {
    const project = await createProject('animation')
    await addFrame(project.id, tagBytes(1), 1)
    await addFrame(project.id, tagBytes(2), 2)

    await commitFrameOrder(project.id, [0, 0])

    const frames = await getFrames(project.id)
    expect(frames.map(f => f.seq)).toEqual([0, 1]) // giữ nguyên, không bị phá
  })

  it('keptSeqsInOrder chứa seq không tồn tại → no-op', async () => {
    const project = await createProject('animation')
    await addFrame(project.id, tagBytes(1), 1)

    await commitFrameOrder(project.id, [0, 99])

    const frames = await getFrames(project.id)
    expect(frames).toHaveLength(1)
  })

  it('thứ tự mới TRÙNG thứ tự hiện có → no-op nhanh (không ghi thừa, không đổi bytes)', async () => {
    const project = await createProject('animation')
    await addFrame(project.id, tagBytes(1), 1)
    await addFrame(project.id, tagBytes(2), 2)

    await commitFrameOrder(project.id, [0, 1]) // y hệt thứ tự hiện có

    const frames = await getFrames(project.id)
    expect(frames.map(f => f.seq)).toEqual([0, 1])
    expect(bytesToTag((await getFrameBytes(project.id, 0))!)).toBe(1)
  })

  it('project không tồn tại → không throw (an toàn)', async () => {
    await expect(commitFrameOrder('proj-khong-ton-tai', [0])).resolves.toBeUndefined()
  })
})
