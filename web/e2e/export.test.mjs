/**
 * e2e/export.test.mjs
 * Gate chuẩn cho QA — phải PASS trước khi báo Coordinator DONE.
 *
 * Kịch bản: mở app → chờ camera live → chụp 6 frame → bấm Xuất phim
 *           → chờ tối đa 24s → kiểm nút "Tải phim về máy" hiện.
 *
 * Exit 0 khi PASS (✅ EXPORT XONG — có nút Tải phim)
 * Exit 1 khi FAIL (timeout hoặc lỗi script)
 *
 * Chạy: node e2e/export.test.mjs
 *       E2E_URL=http://localhost:4173 node e2e/export.test.mjs
 */

import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.env.E2E_URL || 'http://localhost:5173'

// Screenshots go to web/e2e/screenshots/ — relative to this file
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SHOT_DIR = path.join(__dirname, 'screenshots')
fs.mkdirSync(SHOT_DIR, { recursive: true })

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

let exitCode = 1  // default FAIL; set to 0 on PASS

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--use-fake-device-for-media-stream',  // camera giả (không cần webcam thật)
    '--use-fake-ui-for-media-stream',      // tự cho phép quyền camera
    '--no-sandbox',
  ],
})

const page = await browser.newPage()
await page.setViewport({ width: 1100, height: 900 })

// Log browser console, errors, failed requests
page.on('console', m => console.log(`[c.${m.type()}] ${m.text()}`.slice(0, 300)))
page.on('pageerror', e => console.log(`[PAGEERROR] ${e.message}`))
page.on('requestfailed', r => console.log(`[REQFAIL] ${r.url().slice(0, 80)} — ${r.failure()?.errorText}`))

await page.goto(URL, { waitUntil: 'domcontentloaded' })

// Hook lỗi JS async (unhandledRejection / error)
await page.evaluate(() => {
  window.__err = []
  window.addEventListener('unhandledrejection', e =>
    window.__err.push('UNHANDLED: ' + (e.reason?.message || e.reason)))
  window.addEventListener('error', e =>
    window.__err.push('ERROR: ' + e.message))
})

// Bright Studio redesign (T-BS10): app mở màn Welcome (F6) trước khi vào Capture — bấm qua.
await page.waitForSelector('[data-landmark="welcome-cta"]', { timeout: 10000 }).catch(() => {})
await page.click('[data-landmark="welcome-cta"]').catch(() => {})
await sleep(200)

// Chờ camera THẬT SỰ sẵn sàng (readyState 4 + có kích thước) — tối đa 20s
for (let i = 0; i < 40; i++) {
  const ready = await page.evaluate(() => {
    const v = document.querySelector('[data-testid="camera-video"]')
    return !!v && v.readyState === 4 && v.videoWidth > 0
  })
  if (ready) { console.log(`camera READY sau ${(i + 1) * 0.5}s`); break }
  await sleep(500)
}

// Chụp 6 frame
for (let i = 0; i < 6; i++) {
  await page.click('[aria-label="Chụp frame — phím Space"]').catch(() => {})
  await sleep(400)
}

// Đọc số frame từ frame-counter trên camera preview (data-landmark), KHÔNG dùng regex quét
// toàn body — sidebar (Card Tiến độ Bright Studio) cũng có chữ "N / 30 frame" gây nhầm match.
const fc = await page.evaluate(() => {
  const el = document.querySelector('[data-landmark="frame-counter"]')
  const m = el?.textContent?.match(/^(\d+)/)
  return m ? m[1] : '?'
})
console.log('FRAME đã chụp:', fc)

// Bấm Xuất phim
const btn = await page.$('[aria-label="Xuất phim — phím Enter"]')
console.log('NÚT XUẤT tồn tại:', !!btn, '| disabled:', btn ? await page.evaluate(b => b.disabled, btn) : 'n/a')
await page.click('[aria-label="Xuất phim — phím Enter"]').catch(e => console.log('CLICK ERR', e.message))

// Chờ tối đa 24s cho nút Tải phim xuất hiện
for (let i = 0; i < 24; i++) {
  await sleep(1000)
  const snap = await page.evaluate(() => ({
    txt: document.body.innerText.replace(/\s+/g, ' ').slice(0, 90),
    dl: !!document.querySelector('[aria-label="Tải phim về máy"]'),
    err: window.__err.slice(),
  }))
  console.log(`t+${i + 1}s | dl=${snap.dl} | ${snap.txt}`)
  if (snap.err.length) console.log('   JS-ERR:', JSON.stringify(snap.err))
  if (snap.dl) {
    console.log('✅ EXPORT XONG — có nút Tải phim')
    exitCode = 0
    break
  }
}

if (exitCode !== 0) {
  console.log('❌ EXPORT FAIL — không thấy nút Tải phim sau 24s')
}

await page.screenshot({ path: path.join(SHOT_DIR, 'export-final.png') })
await browser.close()
process.exit(exitCode)
