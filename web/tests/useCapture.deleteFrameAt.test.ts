/**
 * F1 — deleteFrame(index): xoá frame bất kỳ, re-index tự nhiên.
 * BA Scenarios: TS-BS-01, TS-BS-02, TS-BS-03
 */
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCapture } from '../src/hooks/useCapture'
import { CapturedFrame } from '../src/types'

const makeFrames = (count: number): CapturedFrame[] =>
  Array.from({ length: count }, (_, i) => ({ id: `f${i}`, dataUrl: `data:${i}`, timestamp: i }))

describe('useCapture — deleteFrameAt (F1)', () => {
  it('TS-BS-01: xoá frame giữa dải → re-index liên tục, frameCount giảm 1', () => {
    const { result } = renderHook(() => useCapture())
    const frames = makeFrames(5) // f0..f4
    const updated = result.current.deleteFrameAt(frames, 1) // xoá f1 (frame #2 hiển thị)
    expect(updated).toHaveLength(4)
    expect(updated.map(f => f.id)).toEqual(['f0', 'f2', 'f3', 'f4'])
  })

  it('TS-BS-02: xoá frame cuối bằng deleteFrameAt(len-1) — giống deleteLastFrame', () => {
    const { result } = renderHook(() => useCapture())
    const frames = makeFrames(3)
    const viaIndex = result.current.deleteFrameAt(frames, frames.length - 1)
    const viaLast = result.current.deleteLastFrame(frames)
    expect(viaIndex).toEqual(viaLast)
    expect(viaIndex.map(f => f.id)).toEqual(['f0', 'f1'])
  })

  it('TS-BS-03: xoá frame duy nhất → về 0 frame (Empty)', () => {
    const { result } = renderHook(() => useCapture())
    const frames = makeFrames(1)
    const updated = result.current.deleteFrameAt(frames, 0)
    expect(updated).toHaveLength(0)
  })

  it('onion skin sau khi xoá luôn phản ánh frame cuối dải MỚI (không phải frame vừa xoá)', () => {
    const { result } = renderHook(() => useCapture())
    const frames = makeFrames(5) // f0..f4, onion = f4 (cuối)
    // Xoá frame cuối (f4) — onion phải chuyển sang f3
    const afterDelete = result.current.deleteFrameAt(frames, 4)
    const onion = result.current.getOnionSkinFrame(afterDelete)
    expect(onion?.id).toBe('f3')
  })

  it('index ngoài phạm vi → trả về mảng gốc không đổi (an toàn race-condition)', () => {
    const { result } = renderHook(() => useCapture())
    const frames = makeFrames(3)
    expect(result.current.deleteFrameAt(frames, 99)).toEqual(frames)
    expect(result.current.deleteFrameAt(frames, -1)).toEqual(frames)
  })

  it('click × liên tiếp trên 2 thumbnail khác nhau xoá đúng 2 frame tương ứng', () => {
    const { result } = renderHook(() => useCapture())
    const frames = makeFrames(5) // f0..f4
    // Bé xoá index 1 (f1) trước, rồi xoá index 1 của mảng MỚI (giờ là f2)
    const step1 = result.current.deleteFrameAt(frames, 1)
    expect(step1.map(f => f.id)).toEqual(['f0', 'f2', 'f3', 'f4'])
    const step2 = result.current.deleteFrameAt(step1, 1)
    expect(step2.map(f => f.id)).toEqual(['f0', 'f3', 'f4'])
  })
})
