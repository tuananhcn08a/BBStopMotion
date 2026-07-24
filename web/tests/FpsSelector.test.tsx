/**
 * T-XW05 AC7 — FpsSelector hiển thị số fps qua `fpsFor(kind, level)` thay vì bảng `FPS_VALUES`
 * phẳng cũ. Không truyền `kind` (mọi call-site cũ) → mặc định 'animation', hiển thị Y HỆT hành vi
 * trước T-XW05 (zero-regression). Truyền `kind="diary"` → slow hiện đúng 3fps (khác animation 1fps).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import FpsSelector from '../src/components/FpsSelector'

describe('FpsSelector — kind mặc định "animation" (zero-regression call-site cũ)', () => {
  it('không truyền kind → slow/normal/fast hiện 1/6/12 fps (khớp FPS_VALUES cũ)', () => {
    render(<FpsSelector value="normal" onChange={vi.fn()} />)
    expect(screen.getByText('1 fps')).toBeInTheDocument()
    expect(screen.getByText('6 fps')).toBeInTheDocument()
    expect(screen.getByText('12 fps')).toBeInTheDocument()
  })
})

describe('FpsSelector — kind="diary" (AC7, diary slow=3fps khác animation)', () => {
  it('slow hiện 3fps (KHÔNG phải 1fps của animation), normal/fast vẫn 6/12 (kế thừa)', () => {
    render(<FpsSelector value="slow" onChange={vi.fn()} kind="diary" />)
    expect(screen.getByText('3 fps')).toBeInTheDocument()
    expect(screen.queryByText('1 fps')).not.toBeInTheDocument()
    expect(screen.getByText('6 fps')).toBeInTheDocument()
    expect(screen.getByText('12 fps')).toBeInTheDocument()
  })
})
