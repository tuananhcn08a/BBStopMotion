/**
 * neoSteamEmbed — client bridge lite cho giao thức `neo-practice` (Embedded Practice App Contract
 * v0.1: docs/02-architecture/contracts/embedded-practice-app-contract.md trong repo `steamstudio-docs`,
 * §3 giao thức postMessage / §4 Learning Event / T-218).
 *
 * QUAN TRỌNG — bất biến no-op: khi app chạy STANDALONE (không có parent iframe, tức domain
 * bb-stopmotion.bapbean.com mở trực tiếp) thì MỌI hàm public ở đây là no-op tuyệt đối — không
 * `addEventListener`, không `postMessage`, không side effect nào. Hành vi cũ của app giữ nguyên 100%.
 *
 * Khi app chạy nhúng trong iframe do HOST Neo Steam sở hữu (contract §1.1 — iframe host-owned,
 * origin thật, KHÔNG phải mini app null-origin):
 *   (1) app → host   PRACTICE_READY         targetOrigin '*' (bản tin không nhạy cảm — §3.2)
 *   (2) host → app   PRACTICE_CONTEXT       app verify event.origin ∈ allowlist VÀ
 *                                            event.source === window.parent (§3.2) trước khi tin
 *   (3) app → host   PRACTICE_LEARNING_EVENT  targetOrigin = origin host ĐÃ verify ở bước (2)
 *   (4) host → app   PRACTICE_EVENT_ACK
 *
 * App KHÔNG nhận token Neo Steam (contract §2) — chỉ context hiển thị. `steamUserId` trong context
 * chỉ để hiển thị/echo, KHÔNG dùng để gọi API nào (app không có API nào để gọi).
 */

const NS = 'neo-practice' as const
const PROTOCOL_VERSION = '0.1' as const

/** PRACTICE_CONTEXT.context (host→app) — contract §2. Chỉ context hiển thị, KHÔNG có token. */
export interface PracticeContext {
  steamUserId: string
  displayName: string
  lessonId: string
  courseId?: string
  sessionId?: string
  locale?: string
}

/** `result.raw` telemetry stop motion — contract §4.1. */
export interface PracticeLearningEventRaw {
  frameCount?: number
  fps?: number
  videoDurationSec?: number
  fileSizeBytes?: number
  format?: 'mp4' | 'gif'
}

/** Trường app ĐƯỢC set khi phát Learning Event partial (contract §4.1). Host tự đóng dấu phần còn lại. */
export interface PracticeLearningEventInput {
  /** UUID v4. Không truyền → tự sinh bằng crypto.randomUUID(). */
  clientEventId?: string
  /** ISO-8601 thời điểm hoàn thành. Không truyền → dùng thời điểm gọi hàm. */
  occurredAt?: string
  object: {
    type: 'project'
    id: string
    name?: string
  }
  result: {
    success: true
    completion: true
    duration?: string
    raw?: PracticeLearningEventRaw
  }
}

type ContextListener = (context: PracticeContext) => void

interface RawPracticeMessage {
  __ns?: unknown
  v?: unknown
  type?: unknown
  context?: unknown
  clientEventId?: unknown
  ok?: unknown
  reason?: unknown
}

// ---- module state (singleton — 1 instance / tab / iframe) ----
let embeddedDetected: boolean | null = null
let verifiedHostOrigin: string | null = null
let latestContext: PracticeContext | null = null
let messageListenerAttached = false
const contextListeners = new Set<ContextListener>()

/** Đọc allowlist origin Neo Steam từ ENV `VITE_NEO_STEAM_ORIGINS` (comma-separated) — contract §3.2. */
function readAllowlist(): string[] {
  const raw = import.meta.env.VITE_NEO_STEAM_ORIGINS ?? ''
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

/**
 * Có đang chạy nhúng trong iframe hay không (§C2 — `window.parent !== window`).
 * Query `?embed=neo-steam` cũng được coi là tín hiệu nhúng (cho phép test/preview thủ công).
 * Kết quả cache lại (không đổi trong vòng đời 1 trang).
 */
export function isEmbedded(): boolean {
  if (embeddedDetected !== null) return embeddedDetected
  if (typeof window === 'undefined') {
    embeddedDetected = false
    return embeddedDetected
  }
  const hasParent = window.parent !== window
  const hasEmbedQuery = new URLSearchParams(window.location.search).get('embed') === 'neo-steam'
  embeddedDetected = hasParent || hasEmbedQuery
  return embeddedDetected
}

function handleMessage(event: MessageEvent): void {
  const data = event.data as RawPracticeMessage | null
  if (!data || typeof data !== 'object' || data.__ns !== NS) return // không phải bản tin của ta — bỏ qua im lặng

  if (data.type === 'PRACTICE_CONTEXT') {
    // Origin-check 2 chiều bắt buộc (§3.2): allowlist ENV + event.source === window.parent.
    // Thất bại 1 trong 2 → KHÔNG tin bản tin, bỏ qua im lặng (không log nội dung nhạy cảm).
    const allowlist = readAllowlist()
    if (!allowlist.includes(event.origin) || event.source !== window.parent) return
    verifiedHostOrigin = event.origin
    latestContext = data.context as PracticeContext
    contextListeners.forEach(listener => listener(latestContext!))
  }
  // PRACTICE_EVENT_ACK: v0.1 chưa wiring retry UI (§4.3 để ngỏ cho app tự thử lại nếu cần) — bỏ qua.
}

/**
 * Khởi tạo bridge. CHỈ có side effect khi `isEmbedded()` === true — standalone là no-op tuyệt đối
 * (không add listener, không postMessage). Idempotent — gọi nhiều lần vô hại.
 */
export function init(): void {
  if (!isEmbedded()) return
  if (messageListenerAttached) return
  window.addEventListener('message', handleMessage)
  messageListenerAttached = true
  // (1) PRACTICE_READY — targetOrigin '*' hợp lệ (ngoại lệ §3.2): bản tin không nhạy cảm, app
  // chưa xác nhận origin host ở bước này nên không có origin cụ thể để nhắm.
  window.parent.postMessage({ __ns: NS, v: PROTOCOL_VERSION, type: 'PRACTICE_READY' }, '*')
}

/** Context host gửi xuống đã verify origin (§3.2), hoặc `null` nếu chưa nhận / standalone. */
export function getContext(): PracticeContext | null {
  return latestContext
}

/**
 * Đăng ký callback khi context xác thực xong (§C4 — hiển thị lời chào/chọn locale). Gọi ngay nếu
 * context đã có sẵn. Trả về hàm unsubscribe.
 */
export function onContext(listener: ContextListener): () => void {
  contextListeners.add(listener)
  if (latestContext) listener(latestContext)
  return () => contextListeners.delete(listener)
}

/**
 * Phát Learning Event partial lên host (contract §4.1) — gọi sau khi export xuất phim thành công
 * (App.tsx `handleExport`). Standalone HOẶC chưa nhận được `PRACTICE_CONTEXT` đã verify → no-op
 * tuyệt đối (không throw, không postMessage) — không ảnh hưởng luồng export cũ.
 */
export function emitLearningEvent(input: PracticeLearningEventInput): void {
  if (!isEmbedded() || !verifiedHostOrigin) return
  const message = {
    __ns: NS,
    v: PROTOCOL_VERSION,
    type: 'PRACTICE_LEARNING_EVENT' as const,
    clientEventId: input.clientEventId ?? crypto.randomUUID(),
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    verb: 'completed' as const,
    object: input.object,
    result: input.result,
  }
  // targetOrigin = origin host ĐÃ verify ở bước PRACTICE_CONTEXT — KHÔNG '*' (§3.2, sau READY).
  window.parent.postMessage(message, verifiedHostOrigin)
}

/**
 * Test-only: reset toàn bộ state module giữa các test case (singleton module-level state không tự
 * reset giữa `describe`/`it`). KHÔNG gọi trong app code thật.
 */
export function __resetForTest(): void {
  embeddedDetected = null
  verifiedHostOrigin = null
  latestContext = null
  if (messageListenerAttached && typeof window !== 'undefined') {
    window.removeEventListener('message', handleMessage)
  }
  messageListenerAttached = false
  contextListeners.clear()
}
