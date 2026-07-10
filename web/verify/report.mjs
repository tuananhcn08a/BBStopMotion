#!/usr/bin/env node
/**
 * verify/report.mjs — nhận 2 bộ landmark đo được (mockup vs app) → sinh:
 *   1. bảng lệch Markdown  `element | mockup | app | Δ | PASS?`
 *   2. overlay.png         mockup | app cạnh nhau, cùng chiều rộng
 *   3. exit code           0 nếu mọi Δ PASS, 1 nếu có FAIL
 *
 * Chuẩn hoá theo CHIỀU RỘNG: app đo trên viewport/ảnh có thể khác chiều rộng
 * mockup (vd QML window khác 1280px, iPhone screenshot @3x). Trước khi so,
 * nhân toạ độ/kích thước đo được của app với `scale = mockupWidth / appWidth`
 * để đưa về cùng hệ quy chiếu mockup. Với web (DOM đo cả 2 bên ở CÙNG
 * viewport) scale mặc định = 1.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PNG } from 'pngjs'
import { parseArgs } from './lib/args.mjs'

const NUMERIC_FIELDS = ['x', 'y', 'w', 'h']

function scaleRect(rect, scale) {
  if (!rect) return null
  const scaled = { ...rect }
  for (const f of NUMERIC_FIELDS) {
    if (typeof rect[f] === 'number') scaled[f] = Math.round(rect[f] * scale * 100) / 100
  }
  return scaled
}

function fmtRect(rect) {
  if (!rect) return '—'
  const { x, y, w, h } = rect
  return `x${x} y${y} w${w} h${h}`
}

function fmtDelta(delta) {
  if (!delta) return '—'
  return NUMERIC_FIELDS.map((f) => `Δ${f}=${delta[f]}`).join(' ')
}

/**
 * So mockup vs app (đã chuẩn hoá theo width) → bảng lệch từng landmark.
 * `threshold` tính bằng px trên hệ quy chiếu mockup — mặc định 2px
 * (web/desktop khung cố định, theo ui-verification-checklist của miwiz).
 */
export function computeDiff({ mockupLandmarks, appLandmarks, scale = 1, threshold = 2 }) {
  const names = new Set([...Object.keys(mockupLandmarks || {}), ...Object.keys(appLandmarks || {})])
  const rows = []
  let allPass = true

  for (const name of [...names].sort()) {
    const mockup = mockupLandmarks?.[name] || null
    const appRaw = appLandmarks?.[name] || null
    const app = scaleRect(appRaw, scale)

    if (!mockup || !app) {
      rows.push({
        landmark: name,
        mockup,
        app,
        delta: null,
        pass: false,
        note: !mockup ? 'THIẾU trong mockup' : 'THIẾU trong app (chưa implement / selector sai)',
      })
      allPass = false
      continue
    }

    const delta = {}
    let pass = true
    for (const f of NUMERIC_FIELDS) {
      const d = Math.round((app[f] - mockup[f]) * 100) / 100
      delta[f] = d
      if (Math.abs(d) > threshold) pass = false
    }
    if (!pass) allPass = false
    rows.push({ landmark: name, mockup, app, delta, pass, note: '' })
  }

  return { rows, allPass, threshold, scale }
}

export function renderMarkdown({ rows, allPass, threshold, scale, meta = {} }) {
  const lines = []
  lines.push(`# Visual Diff Gate — ${meta.screen || '(screen)'} · ${meta.platform || '(platform)'}`)
  lines.push('')
  lines.push(`- Ngưỡng (Δ tối đa): **${threshold}px**`)
  lines.push(`- Hệ số chuẩn hoá theo chiều rộng (app→mockup): **${scale}**`)
  lines.push(`- Mockup: \`${meta.mockup || '?'}\``)
  lines.push(`- App: \`${meta.app || '?'}\``)
  lines.push(`- Kết quả tổng: **${allPass ? 'PASS ✅' : 'FAIL ❌'}**`)
  lines.push('')
  lines.push('| element | mockup | app | Δ | PASS? |')
  lines.push('|---|---|---|---|---|')
  for (const row of rows) {
    const pass = row.pass ? '✅' : '❌'
    const note = row.note ? ` (${row.note})` : ''
    lines.push(
      `| ${row.landmark} | ${fmtRect(row.mockup)} | ${fmtRect(row.app)} | ${fmtDelta(row.delta)}${note} | ${pass} |`
    )
  }
  lines.push('')
  if (rows.length === 0) {
    lines.push('> CẢNH BÁO: không có landmark nào để so — kiểm tra `[data-landmark]` / landmarks.json.')
  }
  return lines.join('\n')
}

// ---- overlay.png: mockup | app cạnh nhau, cùng chiều rộng (nearest-neighbor resize) ----

function resizeToWidth(png, targetWidth) {
  if (png.width === targetWidth) return png
  const scale = targetWidth / png.width
  const targetHeight = Math.max(1, Math.round(png.height * scale))
  const out = new PNG({ width: targetWidth, height: targetHeight })
  for (let y = 0; y < targetHeight; y++) {
    const srcY = Math.min(png.height - 1, Math.floor(y / scale))
    for (let x = 0; x < targetWidth; x++) {
      const srcX = Math.min(png.width - 1, Math.floor(x / scale))
      const srcIdx = (png.width * srcY + srcX) << 2
      const dstIdx = (targetWidth * y + x) << 2
      out.data[dstIdx] = png.data[srcIdx]
      out.data[dstIdx + 1] = png.data[srcIdx + 1]
      out.data[dstIdx + 2] = png.data[srcIdx + 2]
      out.data[dstIdx + 3] = png.data[srcIdx + 3]
    }
  }
  return out
}

const OVERLAY_GAP = 8
const OVERLAY_GAP_COLOR = [255, 0, 200, 255] // magenta divider — dễ nhận ra ranh giới 2 ảnh

export function renderOverlay({ mockupImagePath, appImagePath, outPath, columnWidth = 640 }) {
  const mockupPng = resizeToWidth(PNG.sync.read(fs.readFileSync(mockupImagePath)), columnWidth)
  const appPng = resizeToWidth(PNG.sync.read(fs.readFileSync(appImagePath)), columnWidth)

  const height = Math.max(mockupPng.height, appPng.height)
  const width = columnWidth * 2 + OVERLAY_GAP
  const out = new PNG({ width, height })
  out.data.fill(255) // nền trắng cho phần thừa (ảnh thấp hơn height chung)

  function blit(src, xOffset) {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const srcIdx = (src.width * y + x) << 2
        const dstIdx = (width * y + (x + xOffset)) << 2
        out.data[dstIdx] = src.data[srcIdx]
        out.data[dstIdx + 1] = src.data[srcIdx + 1]
        out.data[dstIdx + 2] = src.data[srcIdx + 2]
        out.data[dstIdx + 3] = src.data[srcIdx + 3]
      }
    }
  }
  blit(mockupPng, 0)
  blit(appPng, columnWidth + OVERLAY_GAP)
  for (let y = 0; y < height; y++) {
    for (let gx = 0; gx < OVERLAY_GAP; gx++) {
      const dstIdx = (width * y + (columnWidth + gx)) << 2
      out.data[dstIdx] = OVERLAY_GAP_COLOR[0]
      out.data[dstIdx + 1] = OVERLAY_GAP_COLOR[1]
      out.data[dstIdx + 2] = OVERLAY_GAP_COLOR[2]
      out.data[dstIdx + 3] = OVERLAY_GAP_COLOR[3]
    }
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, PNG.sync.write(out))
  return outPath
}

/** Tiện ích tổng: ghi report.md (+ overlay.png nếu có ảnh) → { exitCode, reportPath, overlayPath, allPass } */
export function writeReport({
  mockupLandmarks,
  appLandmarks,
  scale = 1,
  threshold = 2,
  meta = {},
  outDir,
  mockupImagePath = null,
  appImagePath = null,
}) {
  const diff = computeDiff({ mockupLandmarks, appLandmarks, scale, threshold })
  const md = renderMarkdown({ ...diff, meta })

  fs.mkdirSync(outDir, { recursive: true })
  const reportPath = path.join(outDir, 'report.md')
  fs.writeFileSync(reportPath, md)

  let overlayPath = null
  if (mockupImagePath && appImagePath && fs.existsSync(mockupImagePath) && fs.existsSync(appImagePath)) {
    overlayPath = renderOverlay({
      mockupImagePath,
      appImagePath,
      outPath: path.join(outDir, 'overlay.png'),
    })
  }

  return { exitCode: diff.allPass ? 0 : 1, reportPath, overlayPath, allPass: diff.allPass, rows: diff.rows }
}

function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
}

if (isMain()) {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || !args['mockup-landmarks'] || !args['app-landmarks'] || !args['out-dir']) {
    console.log(
      'Usage: node report.mjs --mockup-landmarks <json> --app-landmarks <json> --out-dir <dir> ' +
        '[--scale 1] [--threshold 2] [--mockup-image <png>] [--app-image <png>] ' +
        '[--screen 2a] [--platform web]'
    )
    process.exit(args.help ? 0 : 1)
  }
  const mockupLandmarks = JSON.parse(fs.readFileSync(args['mockup-landmarks'], 'utf8'))
  const appLandmarks = JSON.parse(fs.readFileSync(args['app-landmarks'], 'utf8'))
  const result = writeReport({
    mockupLandmarks,
    appLandmarks,
    scale: args.scale ? Number(args.scale) : 1,
    threshold: args.threshold ? Number(args.threshold) : 2,
    outDir: args['out-dir'],
    mockupImagePath: args['mockup-image'] || null,
    appImagePath: args['app-image'] || null,
    meta: { screen: args.screen, platform: args.platform },
  })
  console.log(fs.readFileSync(result.reportPath, 'utf8'))
  console.log(`\n${result.allPass ? 'PASS ✅' : 'FAIL ❌'} — report: ${result.reportPath}`)
  process.exit(result.exitCode)
}
