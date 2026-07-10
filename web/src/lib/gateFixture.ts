import { CapturedFrame, ExportResult, LibraryEntry } from '../types'

/**
 * Fixture chỉ dùng cho Visual Diff Gate (T-BS10 AC4 / T-BS11 QA) — KHÔNG dùng trong luồng thật.
 *
 * `verify/gate.mjs` chụp app bằng cách load 1 URL rồi đo DOM ngay — không có bước bấm
 * qua Welcome / chụp N frame / chờ export thật. Query param `?gate=<id>` (chỉ đọc 1 lần lúc
 * mount App) cho phép dựng sẵn state khớp với số liệu mock trong mockup gốc để so khớp hình
 * học pixel-đúng. Không set param này thì app chạy y hệt luồng thật — không ảnh hưởng người dùng.
 */
export type GateFixtureId = 'capture' | 'success' | 'library' | 'exporting' | 'denied' | 'disabled'

const GATE_FIXTURE_IDS: GateFixtureId[] = ['capture', 'success', 'library', 'exporting', 'denied', 'disabled']

const PLACEHOLDER_FRAME_DATA_URL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ycACwAAAAABAAEAAAIBTAA7'

export function readGateFixtureParam(): GateFixtureId | null {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('gate')
  return (GATE_FIXTURE_IDS as string[]).includes(value ?? '') ? (value as GateFixtureId) : null
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

/**
 * 4 phim mẫu khớp bảng "Ví dụ dữ liệu" trong redline 1g-library.md — 2 hôm nay (giờ giảm dần
 * để đúng thứ tự hiển thị của mockup), 2 hôm qua. Dùng cho `?gate=library`.
 */
export function buildGateLibraryEntries(): LibraryEntry[] {
  const now = new Date()
  const today10h24 = new Date(now)
  today10h24.setHours(10, 24, 0, 0)
  const today9h51 = new Date(now)
  today9h51.setHours(9, 51, 0, 0)
  const yesterday16h02 = new Date(now)
  yesterday16h02.setDate(yesterday16h02.getDate() - 1)
  yesterday16h02.setHours(16, 2, 0, 0)
  const yesterday14h30 = new Date(now)
  yesterday14h30.setDate(yesterday14h30.getDate() - 1)
  yesterday14h30.setHours(14, 30, 0, 0)

  return [
    {
      id: 'gate-lib-1',
      title: 'Robot bay vào vũ trụ 🚀',
      childName: 'Minh',
      thumbnailDataUrl: PLACEHOLDER_FRAME_DATA_URL,
      frameCount: 42,
      durationSeconds: 4.2,
      createdAt: today10h24.getTime(),
      uploadUrl: 'https://example.com/gate-fixture/robot.mp4',
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    },
    {
      id: 'gate-lib-2',
      title: 'Bữa tiệc bí ngô 🎃',
      childName: 'Lan',
      thumbnailDataUrl: PLACEHOLDER_FRAME_DATA_URL,
      frameCount: 68,
      durationSeconds: 6.8,
      createdAt: today9h51.getTime(),
      uploadUrl: 'https://example.com/gate-fixture/pumpkin.mp4',
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    },
    {
      id: 'gate-lib-3',
      title: 'Nhật thực 🌒',
      childName: 'Huy',
      thumbnailDataUrl: PLACEHOLDER_FRAME_DATA_URL,
      frameCount: 96,
      durationSeconds: 9.6,
      createdAt: yesterday16h02.getTime(),
      // Chưa tải lên — khớp mockup badge "⚠ Chưa tải lên" cho phim này.
    },
    {
      id: 'gate-lib-4',
      title: 'Chú mèo học bay 🐱',
      childName: 'An',
      thumbnailDataUrl: PLACEHOLDER_FRAME_DATA_URL,
      frameCount: 35,
      durationSeconds: 3.5,
      createdAt: yesterday14h30.getTime(),
      uploadUrl: 'https://example.com/gate-fixture/cat.mp4',
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    },
  ]
}
