/**
 * T-XW03 — AC2: fps tra theo `(kind, level)`, khớp `FpsTable` phía iOS
 * (`bbsproj-format-v1.md` §4 [BINDING]): animation 1/6/12, diary 3/6/12 (diary override slow=3).
 */
import { describe, it, expect } from 'vitest'
import { fpsFor, defaultFpsLevel } from '../src/lib/project/fps'
import { FPS_VALUES } from '../src/types'

describe('fpsFor(kind, level) — bảng fps khớp iOS FpsTable (AC2)', () => {
  it('animation: slow=1, normal=6, fast=12', () => {
    expect(fpsFor('animation', 'slow')).toBe(1)
    expect(fpsFor('animation', 'normal')).toBe(6)
    expect(fpsFor('animation', 'fast')).toBe(12)
  })

  it('diary: slow=3 (MỚI, khác animation), normal=6, fast=12 (kế thừa animation)', () => {
    expect(fpsFor('diary', 'slow')).toBe(3)
    expect(fpsFor('diary', 'normal')).toBe(6)
    expect(fpsFor('diary', 'fast')).toBe(12)
  })

  it('zero-regression: fpsFor("animation", level) === FPS_VALUES[level] cũ toàn hệ', () => {
    expect(fpsFor('animation', 'slow')).toBe(FPS_VALUES.slow)
    expect(fpsFor('animation', 'normal')).toBe(FPS_VALUES.normal)
    expect(fpsFor('animation', 'fast')).toBe(FPS_VALUES.fast)
  })
})

describe('defaultFpsLevel(kind) — mặc định theo kind [BINDING]', () => {
  it('animation → normal', () => {
    expect(defaultFpsLevel('animation')).toBe('normal')
  })
  it('diary → slow', () => {
    expect(defaultFpsLevel('diary')).toBe('slow')
  })
})
