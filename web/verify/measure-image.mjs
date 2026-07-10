#!/usr/bin/env node
/**
 * verify/measure-image.mjs — đo hình học bằng PIXEL-SCAN trên ảnh PNG THẬT.
 *
 * Dùng khi không có DOM để đo (QML/NEO One, iPhone native): ảnh PNG phải là
 * `xcrun simctl io screenshot` hoặc `QQuickWindow.grabWindow()` — chụp cửa sổ
 * app đang chạy thật (xem grab-qml.sh / grab-ios.sh). KHÔNG dùng ảnh ghép/mock.
 *
 * Cách đo: với mỗi landmark, cấp một `searchBox` (vùng tìm sơ bộ trên ảnh,
 * toạ độ px thật của ảnh) + `color` mục tiêu (hex hoặc {r,g,b}, dung sai
 * `tolerance` mặc định 24/kênh). Quét toàn bộ searchBox, gom các pixel khớp
 * màu, trả bounding box của vùng khớp → đó là rect đo được của landmark.
 *
 * Đây là kỹ thuật "biên/màu" nêu trong T-BS03 — độ chính xác phụ thuộc vào
 * searchBox/color khai đúng trong file landmarks JSON (xem fixtures/landmarks-image-example.json).
 *
 * CLI:
 *   node measure-image.mjs --image <shot.png> --landmarks <landmarks.json> [--out measured.json]
 *
 * Module:
 *   import { measureImage } from './measure-image.mjs'
 *   const landmarks = await measureImage({ imagePath, landmarksSpec })
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PNG } from 'pngjs'
import { parseArgs } from './lib/args.mjs'

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) throw new Error(`Màu hex không hợp lệ: ${hex}`)
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function normalizeColor(color) {
  if (typeof color === 'string') return hexToRgb(color)
  return color
}

function loadPng(imagePath) {
  const buf = fs.readFileSync(imagePath)
  return PNG.sync.read(buf)
}

/**
 * Quét 1 landmark trong 1 PNG đã load. Trả về rect đo được (px thật của ảnh)
 * hoặc null nếu không tìm thấy pixel nào khớp màu trong searchBox.
 */
export function scanLandmark(png, spec) {
  const { searchBox, color, tolerance = 24 } = spec
  const target = normalizeColor(color)
  const x0 = Math.max(0, Math.round(searchBox.x))
  const y0 = Math.max(0, Math.round(searchBox.y))
  const x1 = Math.min(png.width, Math.round(searchBox.x + searchBox.w))
  const y1 = Math.min(png.height, Math.round(searchBox.y + searchBox.h))

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let matched = 0

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (png.width * y + x) << 2
      const r = png.data[idx]
      const g = png.data[idx + 1]
      const b = png.data[idx + 2]
      if (
        Math.abs(r - target.r) <= tolerance &&
        Math.abs(g - target.g) <= tolerance &&
        Math.abs(b - target.b) <= tolerance
      ) {
        matched++
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }

  if (matched === 0) return null

  return {
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    bg: '#' + [target.r, target.g, target.b].map((v) => v.toString(16).padStart(2, '0')).join(''),
    color: null,
    matchedPixels: matched,
  }
}

export async function measureImage({ imagePath, landmarksSpec }) {
  if (!imagePath) throw new Error('measureImage(): thiếu imagePath')
  if (!fs.existsSync(imagePath)) throw new Error(`Không tìm thấy ảnh: ${imagePath}`)
  const png = loadPng(imagePath)

  const result = {}
  for (const [name, spec] of Object.entries(landmarksSpec)) {
    if (name.startsWith('_')) continue // "_comment" etc — không phải landmark
    const rect = scanLandmark(png, spec)
    if (!rect) {
      console.warn(`[measure-image.mjs] CẢNH BÁO: không thấy landmark "${name}" trong searchBox đã khai.`)
      continue
    }
    result[name] = rect
  }
  return { landmarks: result, imageWidth: png.width, imageHeight: png.height }
}

function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
}

if (isMain()) {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || !args.image || !args.landmarks) {
    console.log(
      'Usage: node measure-image.mjs --image <shot.png> --landmarks <landmarks.json> [--out measured.json]'
    )
    process.exit(args.help ? 0 : 1)
  }
  const landmarksSpec = JSON.parse(fs.readFileSync(args.landmarks, 'utf8'))
  try {
    const { landmarks, imageWidth, imageHeight } = await measureImage({
      imagePath: args.image,
      landmarksSpec,
    })
    const payload = { imageWidth, imageHeight, landmarks }
    const json = JSON.stringify(payload, null, 2)
    if (args.out) {
      fs.mkdirSync(path.dirname(args.out), { recursive: true })
      fs.writeFileSync(args.out, json)
      console.log(`Đã đo ${Object.keys(landmarks).length} landmark → ${args.out}`)
    } else {
      console.log(json)
    }
  } catch (err) {
    console.error(`[measure-image.mjs] LỖI: ${err.message}`)
    process.exit(1)
  }
}
