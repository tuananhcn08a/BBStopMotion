#!/usr/bin/env node
/**
 * verify/gate.mjs — Visual Diff Gate orchestrator (3 nền: web / qml / ios).
 *
 * Quy trình (theo miwiz): chụp bản chạy THẬT → đo hình học từng landmark →
 * bảng lệch `element | mockup | app | Δ | PASS?` + overlay side-by-side →
 * exit 0/1.
 *
 * --- platform web (app cũng là DOM — đo cả 2 bên bằng getBoundingClientRect) ---
 *   node gate.mjs --screen 2a --platform web \
 *     --mockup file:///.../mockups/2a-capture.html \
 *     --app-url http://localhost:5173 \
 *     [--viewport 1280x820] [--wait-selector "[data-ready]"] [--selectors sel.json] \
 *     [--threshold 2] [--out-dir verify/.out/2a-web]
 *
 * --- platform qml | ios (app chỉ có ảnh — đo bằng pixel-scan) ---
 *   node gate.mjs --screen 2a --platform qml \
 *     --mockup file:///.../mockups/2a-capture.html --mockup-viewport 1280x820 \
 *     --app-image /tmp/qml-2a.png --landmarks verify/fixtures/landmarks-image-example.json \
 *     [--threshold 4] [--out-dir verify/.out/2a-qml]
 *
 * Self-test (AC1/AC2 — dùng qua `npm run verify:selftest` trong web/):
 *   node gate.mjs --screen selftest --platform web \
 *     --mockup verify/fixtures/self-test.html --app-url verify/fixtures/self-test.html
 *   (mọi Δ=0 → PASS, exit 0)
 */
import path from 'path'
import { fileURLToPath } from 'url'
import { parseArgs, parseViewport } from './lib/args.mjs'
import { capture } from './capture.mjs'
import { measureDom } from './measure.mjs'
import { measureImage } from './measure-image.mjs'
import { writeReport } from './report.mjs'
import fs from 'fs'

function usage() {
  return `Usage:
  node gate.mjs --screen <id> --platform web --mockup <url> --app-url <url> [--viewport 1280x820] [--wait-selector <css>] [--selectors <json>] [--threshold 2] [--out-dir <dir>]
  node gate.mjs --screen <id> --platform qml|ios --mockup <url> [--mockup-viewport 1280x820|390x844] --app-image <png> --landmarks <json> [--threshold 4] [--out-dir <dir>]

Options:
  --expect-fail   (self-test only) đảo exit code — dùng khi CỐ Ý so 2 bản lệch nhau để kiểm harness tự phát hiện FAIL.
`
}

async function runWeb(args) {
  const viewport = parseViewport(args.viewport)
  const outDir = args['out-dir'] || path.join('verify', '.out', `${args.screen}-${args.platform}`)
  const selectors = args.selectors ? JSON.parse(fs.readFileSync(args.selectors, 'utf8')) : {}
  const waitSelector = args['wait-selector'] || null

  fs.mkdirSync(outDir, { recursive: true })
  const mockupShot = path.join(outDir, 'mockup.png')
  const appShot = path.join(outDir, 'app.png')

  console.log(`[gate] chụp mockup: ${args.mockup}`)
  await capture({ url: args.mockup, out: mockupShot, viewport, waitSelector })
  console.log(`[gate] chụp app:    ${args['app-url']}`)
  await capture({ url: args['app-url'], out: appShot, viewport, waitSelector })

  console.log('[gate] đo mockup (DOM)')
  const mockupLandmarks = await measureDom({ url: args.mockup, viewport, waitSelector, selectors })
  console.log('[gate] đo app (DOM)')
  const appLandmarks = await measureDom({ url: args['app-url'], viewport, waitSelector, selectors })

  return writeReport({
    mockupLandmarks,
    appLandmarks,
    scale: 1, // web: cùng viewport cả 2 bên → không cần chuẩn hoá
    threshold: args.threshold ? Number(args.threshold) : 2,
    outDir,
    mockupImagePath: mockupShot,
    appImagePath: appShot,
    meta: { screen: args.screen, platform: args.platform, mockup: args.mockup, app: args['app-url'] },
  })
}

async function runImageBacked(args) {
  if (!args['app-image']) throw new Error(`--app-image bắt buộc cho --platform ${args.platform}`)
  if (!args.landmarks) throw new Error('--landmarks (JSON searchBox+color per landmark) bắt buộc cho platform ảnh')

  const defaultViewport = args.platform === 'ios' ? { width: 390, height: 844 } : { width: 1280, height: 820 }
  const mockupViewport = parseViewport(args['mockup-viewport'] || args.viewport, defaultViewport)
  const outDir = args['out-dir'] || path.join('verify', '.out', `${args.screen}-${args.platform}`)
  const waitSelector = args['wait-selector'] || null

  fs.mkdirSync(outDir, { recursive: true })
  const mockupShot = path.join(outDir, 'mockup.png')

  console.log(`[gate] chụp mockup: ${args.mockup} @ ${mockupViewport.width}x${mockupViewport.height}`)
  await capture({ url: args.mockup, out: mockupShot, viewport: mockupViewport, waitSelector })
  console.log('[gate] đo mockup (DOM)')
  const mockupLandmarks = await measureDom({ url: args.mockup, viewport: mockupViewport, waitSelector })

  console.log(`[gate] đo app (pixel-scan ảnh thật): ${args['app-image']}`)
  const landmarksSpec = JSON.parse(fs.readFileSync(args.landmarks, 'utf8'))
  const { landmarks: appLandmarks, imageWidth } = await measureImage({
    imagePath: args['app-image'],
    landmarksSpec,
  })

  const scale = mockupViewport.width / imageWidth
  console.log(
    `[gate] chuẩn hoá theo chiều rộng: mockup=${mockupViewport.width}px / app-image=${imageWidth}px → scale=${scale.toFixed(4)}`
  )

  return writeReport({
    mockupLandmarks,
    appLandmarks,
    scale,
    threshold: args.threshold ? Number(args.threshold) : 4,
    outDir,
    mockupImagePath: mockupShot,
    appImagePath: args['app-image'],
    meta: { screen: args.screen, platform: args.platform, mockup: args.mockup, app: args['app-image'] },
  })
}

function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
}

if (isMain()) {
  const args = parseArgs(process.argv.slice(2), ['expect-fail'])

  if (args.help) {
    console.log(usage())
    process.exit(0)
  }
  if (!args.screen || !args.platform || !args.mockup) {
    console.error(usage())
    process.exit(1)
  }
  if (!['web', 'qml', 'ios'].includes(args.platform)) {
    console.error(`--platform không hợp lệ: ${args.platform} (web|qml|ios)`)
    process.exit(1)
  }
  if (args.platform === 'web' && !args['app-url']) {
    console.error('--app-url bắt buộc cho --platform web')
    process.exit(1)
  }

  try {
    const result =
      args.platform === 'web' ? await runWeb(args) : await runImageBacked(args)

    console.log('')
    console.log(fs.readFileSync(result.reportPath, 'utf8'))
    console.log('')
    console.log(`report:  ${result.reportPath}`)
    if (result.overlayPath) console.log(`overlay: ${result.overlayPath}`)
    console.log(`Tổng: ${result.allPass ? 'PASS ✅' : 'FAIL ❌'}`)

    const expectFail = !!args['expect-fail']
    const gatePassed = expectFail ? !result.allPass : result.allPass
    if (expectFail) {
      console.log(
        `[gate] --expect-fail: mong đợi FAIL để chứng minh harness phát hiện lệch → ${gatePassed ? 'đúng như kỳ vọng ✅' : 'SAI KỲ VỌNG ❌ (lẽ ra phải FAIL nhưng lại PASS)'}`
      )
    }
    process.exit(gatePassed ? 0 : 1)
  } catch (err) {
    console.error(`[gate.mjs] LỖI: ${err.stack || err.message}`)
    process.exit(1)
  }
}
