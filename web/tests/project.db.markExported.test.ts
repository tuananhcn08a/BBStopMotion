/**
 * T-XW05 AC6 — `markProjectExported`: export KHÔNG đóng dự án (quyết định #10, mirror
 * `ProjectStore.markExported` iOS) — chỉ ghi `exportedAt`, `frames`/trạng thái khác giữ nguyên,
 * dự án vẫn còn trong `listProjects()`. Gọi lại nhiều lần vẫn hợp lệ (export lại → cập nhật mới).
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { DB_NAME, resetAppDbConnectionForTests } from '../src/lib/db/appDb'
import { addFrame, createProject, getProject, listProjects, markProjectExported } from '../src/lib/project/db'

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

describe('markProjectExported — export không đóng dự án (AC6)', () => {
  it('ghi exportedAt, project vẫn còn trong listProjects với frames nguyên vẹn', async () => {
    const project = await createProject('animation', 'Phim thử')
    await addFrame(project.id, new ArrayBuffer(4), 100)
    await addFrame(project.id, new ArrayBuffer(4), 200)

    await markProjectExported(project.id, 12345)

    const projects = await listProjects()
    expect(projects).toHaveLength(1)
    expect(projects[0].id).toBe(project.id)
    expect(projects[0].exportedAt).toBe(12345)
    expect(projects[0].frameCount).toBe(2)

    const reloaded = await getProject(project.id)
    expect(reloaded!.exportedAt).toBe(12345)
    expect(reloaded!.frames).toHaveLength(2)
  })

  it('default exportedAt = Date.now() khi không truyền tham số', async () => {
    const project = await createProject('diary')
    const before = Date.now()
    await markProjectExported(project.id)
    const after = Date.now()

    const reloaded = await getProject(project.id)
    expect(reloaded!.exportedAt).toBeGreaterThanOrEqual(before)
    expect(reloaded!.exportedAt).toBeLessThanOrEqual(after)
  })

  it('gọi lại nhiều lần vẫn hợp lệ — exportedAt cập nhật thành giá trị mới nhất', async () => {
    const project = await createProject('animation')
    await markProjectExported(project.id, 1000)
    await markProjectExported(project.id, 2000)

    const reloaded = await getProject(project.id)
    expect(reloaded!.exportedAt).toBe(2000)
  })

  it('project không tồn tại — no-op an toàn, không throw', async () => {
    await expect(markProjectExported('proj-khong-ton-tai', 1)).resolves.toBeUndefined()
  })
})
