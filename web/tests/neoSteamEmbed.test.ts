/**
 * T-218 — neoSteamEmbed (giao thức `neo-practice`, Embedded Practice App Contract v0.1 §3/§4).
 *
 * Bao phủ:
 *  - Bất biến no-op tuyệt đối khi standalone (không parent iframe) — KHÔNG add listener, KHÔNG
 *    postMessage, dù gọi init()/emitLearningEvent() thế nào.
 *  - Detect nhúng qua window.parent !== window VÀ qua query ?embed=neo-steam.
 *  - Origin-check 2 chiều khi nhận PRACTICE_CONTEXT (contract §3.2): allowlist ENV
 *    VITE_NEO_STEAM_ORIGINS + event.source === window.parent — thiếu 1 trong 2 → bị bỏ qua.
 *  - emitLearningEvent() chỉ postMessage sau khi có context đã verify, targetOrigin = origin host
 *    đã verify (KHÔNG '*'), envelope đúng ns/version/verb theo contract.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetForTest,
  emitLearningEvent,
  getContext,
  init,
  isEmbedded,
  onContext,
} from '../src/lib/neoSteamEmbed'

const HOST_ORIGIN = 'https://neo-steam.bapbean.com'
const OTHER_ORIGIN = 'https://evil-embedder.example'

function fakeParentWindow(): Window {
  return { postMessage: vi.fn() } as unknown as Window
}

function definePracticeContextEventSource(source: unknown) {
  return source
}

let realParent: typeof window.parent

beforeEach(() => {
  __resetForTest()
  vi.stubEnv('VITE_NEO_STEAM_ORIGINS', `${HOST_ORIGIN},http://localhost:5173`)
  realParent = window.parent
  history.pushState({}, '', '/')
})

afterEach(() => {
  __resetForTest()
  vi.unstubAllEnvs()
  Object.defineProperty(window, 'parent', { value: realParent, configurable: true })
  history.pushState({}, '', '/')
})

describe('isEmbedded()', () => {
  it('standalone (window.parent === window, không query) → false', () => {
    expect(isEmbedded()).toBe(false)
  })

  it('window.parent !== window → true', () => {
    Object.defineProperty(window, 'parent', { value: fakeParentWindow(), configurable: true })
    expect(isEmbedded()).toBe(true)
  })

  it('?embed=neo-steam → true dù window.parent === window', () => {
    history.pushState({}, '', '/?embed=neo-steam')
    expect(isEmbedded()).toBe(true)
  })
})

describe('standalone — no-op tuyệt đối (bất biến bắt buộc)', () => {
  it('init() không add listener, không postMessage khi standalone', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    init()
    expect(addSpy).not.toHaveBeenCalledWith('message', expect.anything())
    addSpy.mockRestore()
  })

  it('emitLearningEvent() không làm gì khi standalone (không postMessage, không throw)', () => {
    const parent = fakeParentWindow()
    // Vẫn giữ window.parent === window (standalone thật) — không override.
    expect(() => emitLearningEvent({
      object: { type: 'project', id: 'lib_1' },
      result: { success: true, completion: true },
    })).not.toThrow()
    expect((parent.postMessage as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
    expect(getContext()).toBeNull()
  })
})

describe('embedded — handshake + origin-check 2 chiều', () => {
  function embed(): Window {
    const parent = fakeParentWindow()
    Object.defineProperty(window, 'parent', { value: parent, configurable: true })
    return parent
  }

  it('init() gửi PRACTICE_READY tới window.parent với targetOrigin \'*\'', () => {
    const parent = embed()
    init()
    expect(parent.postMessage).toHaveBeenCalledWith(
      { __ns: 'neo-practice', v: '0.1', type: 'PRACTICE_READY' },
      '*',
    )
  })

  it('init() gọi 2 lần vẫn chỉ gửi PRACTICE_READY 1 lần (idempotent)', () => {
    const parent = embed()
    init()
    init()
    expect(parent.postMessage).toHaveBeenCalledTimes(1)
  })

  it('PRACTICE_CONTEXT từ origin NGOÀI allowlist → bị bỏ qua, getContext() vẫn null', () => {
    const parent = embed()
    init()
    const context = { steamUserId: 'su_1', displayName: 'Bé An', lessonId: 'l1' }
    window.dispatchEvent(new MessageEvent('message', {
      data: { __ns: 'neo-practice', v: '0.1', type: 'PRACTICE_CONTEXT', context },
      origin: OTHER_ORIGIN,
      source: definePracticeContextEventSource(parent) as Window,
    }))
    expect(getContext()).toBeNull()
  })

  it('PRACTICE_CONTEXT đúng origin nhưng event.source SAI (không phải window.parent) → bị bỏ qua', () => {
    embed() // đặt window.parent thật (khác fakeParentWindow() dùng làm source giả bên dưới)
    init()
    const context = { steamUserId: 'su_1', displayName: 'Bé An', lessonId: 'l1' }
    window.dispatchEvent(new MessageEvent('message', {
      data: { __ns: 'neo-practice', v: '0.1', type: 'PRACTICE_CONTEXT', context },
      origin: HOST_ORIGIN,
      source: definePracticeContextEventSource(fakeParentWindow()) as Window, // window khác, không phải parent thật
    }))
    expect(getContext()).toBeNull()
  })

  it('PRACTICE_CONTEXT hợp lệ (origin ∈ allowlist + source === window.parent) → context được lưu + listener gọi', () => {
    const parent = embed()
    init()
    const context = { steamUserId: 'su_1', displayName: 'Bé An', lessonId: 'l1', locale: 'vi-VN' }
    const listener = vi.fn()
    onContext(listener)
    window.dispatchEvent(new MessageEvent('message', {
      data: { __ns: 'neo-practice', v: '0.1', type: 'PRACTICE_CONTEXT', context },
      origin: HOST_ORIGIN,
      source: definePracticeContextEventSource(parent) as Window,
    }))
    expect(getContext()).toEqual(context)
    expect(listener).toHaveBeenCalledWith(context)
  })

  it('message không đúng ns "neo-practice" → bị bỏ qua im lặng', () => {
    const parent = embed()
    init()
    window.dispatchEvent(new MessageEvent('message', {
      data: { __ns: 'steam-bridge', type: 'RPC_CALL' },
      origin: HOST_ORIGIN,
      source: definePracticeContextEventSource(parent) as Window,
    }))
    expect(getContext()).toBeNull()
  })

  it('emitLearningEvent() TRƯỚC khi có context đã verify → no-op (chưa biết origin host để nhắm)', () => {
    const parent = embed()
    init()
    emitLearningEvent({
      object: { type: 'project', id: 'lib_1' },
      result: { success: true, completion: true },
    })
    // Chỉ có lệnh gọi PRACTICE_READY từ init(), không có LEARNING_EVENT nào thêm.
    expect(parent.postMessage).toHaveBeenCalledTimes(1)
  })

  it('emitLearningEvent() SAU khi có context đã verify → postMessage đúng envelope, targetOrigin = origin host đã verify', () => {
    const parent = embed()
    init()
    const context = { steamUserId: 'su_1', displayName: 'Bé An', lessonId: 'l1' }
    window.dispatchEvent(new MessageEvent('message', {
      data: { __ns: 'neo-practice', v: '0.1', type: 'PRACTICE_CONTEXT', context },
      origin: HOST_ORIGIN,
      source: definePracticeContextEventSource(parent) as Window,
    }))

    emitLearningEvent({
      clientEventId: 'b3f1c2a4-5d6e-4f70-8a91-2c3d4e5f6a7b',
      occurredAt: '2026-07-17T09:12:44.000Z',
      object: { type: 'project', id: 'lib_2026071701', name: 'Chú mèo nhảy múa' },
      result: {
        success: true,
        completion: true,
        duration: 'PT3.5S',
        raw: { frameCount: 42, fps: 12, videoDurationSec: 3.5, format: 'mp4' },
      },
    })

    expect(parent.postMessage).toHaveBeenLastCalledWith(
      {
        __ns: 'neo-practice',
        v: '0.1',
        type: 'PRACTICE_LEARNING_EVENT',
        clientEventId: 'b3f1c2a4-5d6e-4f70-8a91-2c3d4e5f6a7b',
        occurredAt: '2026-07-17T09:12:44.000Z',
        verb: 'completed',
        object: { type: 'project', id: 'lib_2026071701', name: 'Chú mèo nhảy múa' },
        result: {
          success: true,
          completion: true,
          duration: 'PT3.5S',
          raw: { frameCount: 42, fps: 12, videoDurationSec: 3.5, format: 'mp4' },
        },
      },
      HOST_ORIGIN,
    )
  })

  it('emitLearningEvent() không truyền clientEventId → tự sinh UUID v4', () => {
    const parent = embed()
    init()
    const context = { steamUserId: 'su_1', displayName: 'Bé An', lessonId: 'l1' }
    window.dispatchEvent(new MessageEvent('message', {
      data: { __ns: 'neo-practice', v: '0.1', type: 'PRACTICE_CONTEXT', context },
      origin: HOST_ORIGIN,
      source: definePracticeContextEventSource(parent) as Window,
    }))

    emitLearningEvent({
      object: { type: 'project', id: 'lib_1' },
      result: { success: true, completion: true },
    })

    const calls = (parent.postMessage as ReturnType<typeof vi.fn>).mock.calls
    const sentMessage = calls[calls.length - 1]?.[0] as { clientEventId: string }
    expect(sentMessage.clientEventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })
})
