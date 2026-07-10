import { CapturedFrame, ExportResult } from '../types'

/**
 * Fixture chỉ dùng cho Visual Diff Gate (T-BS10 AC4) — KHÔNG dùng trong luồng thật.
 *
 * `verify/gate.mjs` chụp app bằng cách load 1 URL rồi đo DOM ngay — không có bước bấm
 * qua Welcome / chụp N frame / chờ export thật. Query param `?gate=capture|success`
 * (chỉ đọc 1 lần lúc mount App) cho phép dựng sẵn state khớp với số liệu mock trong
 * mockup gốc (18/30 frame ở 2a, 42 frame · 4.2s ở 2c) để so khớp hình học pixel-đúng.
 * Không set param này thì app chạy y hệt luồng thật — không ảnh hưởng người dùng.
 */
export type GateFixtureId = 'capture' | 'success'

const PLACEHOLDER_FRAME_DATA_URL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ycACwAAAAABAAEAAAIBTAA7'

export function readGateFixtureParam(): GateFixtureId | null {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('gate')
  return value === 'capture' || value === 'success' ? value : null
}

export function buildGateFrames(count: number): CapturedFrame[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `gate-frame-${i}`,
    dataUrl: PLACEHOLDER_FRAME_DATA_URL,
    timestamp: i,
  }))
}

export function buildGateExportResult(): ExportResult {
  const expires = new Date(Date.now() + 7 * 86400000).toISOString()
  return {
    blob: new Blob(['gate-fixture'], { type: 'video/mp4' }),
    filename: 'gate-fixture.mp4',
    uploadUrl: 'https://example.com/gate-fixture-qr',
    expiresAt: expires,
  }
}
