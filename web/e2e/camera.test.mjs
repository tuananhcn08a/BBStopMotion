/**
 * e2e/camera.test.mjs
 * Gate chuẩn cho QA — phải PASS trước khi báo Coordinator DONE.
 *
 * Kịch bản: mở app → camera hiện live feed (nút Chụp xuất hiện)
 *           → chụp 6 frame → filmstrip hiển thị đúng số frame.
 *
 * Exit 0 khi PASS (camera active + filmstrip đúng số)
 * Exit 1 khi FAIL (camera không khởi động, hoặc số frame sai)
 *
 * Chạy: node e2e/camera.test.mjs
 *       E2E_URL=http://localhost:4173 node e2e/camera.test.mjs
 */

import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.env.E2E_URL || 'http://localhost:5173'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SHOT_DIR = path.join(__dirname, 'screenshots')
fs.mkdirSync(SHOT_DIR, { recursive: true })

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

let exitCode = 1

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--no-sandbox',
  ],
})

const page = await browser.newPage()
await page.setViewport({ width: 1100, height: 900 })

const logs = []
page.on('console', m => logs.push(`[console.${m.type()}] ${m.text()}`))
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))
page.on('requestfailed', r => logs.push(`[reqfailed] ${r.url()} — ${r.failure()?.errorText}`))

async function screenshot(label) {
  const txt = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 200))
  console.log(`\n=== ${label} ===\nVISIBLE: ${txt}`)
  await page.screenshot({ path: path.join(SHOT_DIR, `cam-${label}.png`) })
}

try {
  console.log('-> goto', URL)
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
  await screenshot('01-initial')

  // Bright Studio redesign (T-BS10): app mở màn Welcome (F6) trước khi vào Hub — bấm qua.
  await page.waitForSelector('[data-landmark="welcome-cta"]', { timeout: 10000 }).catch(() => {})
  await page.click('[data-landmark="welcome-cta"]').catch(() => {})
  await sleep(200)
  await screenshot('01b-after-welcome')

  // T-XW05 — home giờ là Hub (Xưởng phim), Capture chỉ tới được qua tạo/mở dự án. Tạo 1 dự án
  // Hoạt hình mặc định (🎭 đã chọn sẵn trong sheet) rồi bấm "Bắt đầu chụp" để vào Capture.
  await page.waitForSelector('[data-testid="hub-new-project-card"]', { timeout: 10000 }).catch(() => {})
  await page.click('[data-testid="hub-new-project-card"]').catch(() => {})
  await sleep(200)
  await page.waitForSelector('[data-testid="new-project-cta"]', { timeout: 10000 }).catch(() => {})
  await page.click('[data-testid="new-project-cta"]').catch(() => {})
  await sleep(300)
  await screenshot('01c-after-create-project')

  // Chờ camera active — nút Chụp xuất hiện, tối đa 12s
  let camActive = false
  for (let i = 0; i < 24; i++) {
    const ok = await page.$('[aria-label="Chụp frame — phím Space"]')
    if (ok) { camActive = true; break }
    await sleep(500)
  }
  console.log('CAMERA active (nút Chụp hiện):', camActive)
  await screenshot('02-camera')

  if (!camActive) {
    console.log('❌ CAMERA FAIL — nút Chụp không xuất hiện sau 12s')
    exitCode = 1
  } else {
    // Chụp 6 frame (vượt mức tối thiểu 5)
    for (let i = 0; i < 6; i++) {
      await page.click('[aria-label="Chụp frame — phím Space"]').catch(() => {})
      await sleep(500)
    }

    // Đọc số frame từ frame-counter trên camera preview — KHÔNG quét regex toàn body
    // (sidebar Bright Studio cũng có chữ "N / 30 frame" gây nhầm match).
    const frameCount = await page.evaluate(() => {
      const el = document.querySelector('[data-landmark="frame-counter"]')
      const m = el?.textContent?.match(/^(\d+)/)
      return m ? parseInt(m[1]) : 0
    })
    console.log('Số FRAME sau khi chụp:', frameCount)
    await screenshot('03-frames')

    if (frameCount >= 6) {
      console.log('✅ CAMERA PASS — camera live + filmstrip đúng số frame (' + frameCount + ')')
      exitCode = 0
    } else {
      console.log(`❌ CAMERA FAIL — filmstrip hiện ${frameCount} frame, kỳ vọng >= 6`)
      exitCode = 1
    }
  }
} catch (e) {
  console.log('SCRIPT ERROR:', e.message)
  await screenshot('99-error').catch(() => {})
  exitCode = 1
} finally {
  console.log('\n===== CONSOLE / ERRORS =====')
  console.log(logs.slice(-40).join('\n') || '(không có)')
  await browser.close()
  process.exit(exitCode)
}
