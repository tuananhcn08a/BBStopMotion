/**
 * T-XW03 — AC1: type `Project`/`ProjectFrame` + helper khớp schema `.bbsproj` v1 (nguồn sự thật
 * iOS `Shared/Models/Project.swift`): epoch ms, `seq` liên tục từ 0, tên file `frames/%04d.jpg`
 * = `seq+1` pad 4, `id = "proj-" + uuidv4` lowercase, `exportedAt`/`lastCapturedAt` OMIT key khi
 * chưa có giá trị (không ghi `undefined`/`0`) — JSON.stringify không được chứa key đó.
 */
import { describe, it, expect } from 'vitest'
import {
  CURRENT_SCHEMA_VERSION,
  Project,
  frameFileName,
  newProjectId,
  defaultProjectTitle,
} from '../src/lib/project/types'

describe('frameFileName(seq) — §1 [BINDING] frames/%04d.jpg = seq+1 pad 4', () => {
  it('seq 0 → frames/0001.jpg', () => {
    expect(frameFileName(0)).toBe('frames/0001.jpg')
  })
  it('seq 9 → frames/0010.jpg', () => {
    expect(frameFileName(9)).toBe('frames/0010.jpg')
  })
  it('seq 999 → frames/1000.jpg (pad chỉ áp khi < 4 chữ số)', () => {
    expect(frameFileName(999)).toBe('frames/1000.jpg')
  })
})

describe('newProjectId() — §2.1 "proj-" + uuidv4 lowercase', () => {
  it('có prefix "proj-" và phần UUID lowercase hợp lệ', () => {
    const id = newProjectId()
    expect(id).toMatch(/^proj-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })
  it('mỗi lần gọi ra id khác nhau', () => {
    expect(newProjectId()).not.toBe(newProjectId())
  })
})

describe('defaultProjectTitle(kind) — fallback tối thiểu khi title rỗng', () => {
  it('animation → "Phim hoạt hình mới"', () => {
    expect(defaultProjectTitle('animation')).toBe('Phim hoạt hình mới')
  })
  it('diary → "Nhật ký mới"', () => {
    expect(defaultProjectTitle('diary')).toBe('Nhật ký mới')
  })
})

describe('Project — shape khớp schema, epoch ms, exportedAt/lastCapturedAt omit khi thiếu', () => {
  it('project chưa export: JSON.stringify KHÔNG chứa key exportedAt/lastCapturedAt', () => {
    const project: Project = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: 'proj-abc',
      title: 'Test',
      kind: 'animation',
      fpsLevel: 'normal',
      createdAt: Date.now(),
      frames: [],
    }
    const json = JSON.stringify(project)
    expect(json).not.toContain('exportedAt')
    expect(json).not.toContain('lastCapturedAt')
  })

  it('createdAt là epoch milliseconds (Date.now() đã đúng ms)', () => {
    const before = Date.now()
    const project: Project = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: 'proj-x',
      title: 'Test',
      kind: 'diary',
      fpsLevel: 'slow',
      createdAt: Date.now(),
      frames: [],
    }
    const after = Date.now()
    expect(project.createdAt).toBeGreaterThanOrEqual(before)
    expect(project.createdAt).toBeLessThanOrEqual(after)
    // Nếu là epoch giây (không phải ms) thì con số sẽ nhỏ hơn ~1000 lần — sanity check biên độ.
    expect(project.createdAt).toBeGreaterThan(1_000_000_000_000)
  })
})
