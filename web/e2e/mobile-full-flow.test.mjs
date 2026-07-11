/**
 * e2e/mobile-full-flow.test.mjs
 * Gate QA (T-BS61) — luồng đầy đủ THẬT trên viewport mobile 390×844 (không dùng gate fixture):
 * Welcome → bấm "Bắt đầu" → Capture (camera giả) → chụp 6 frame thật → bấm Xuất phim
 * → chờ Export progress → nút Tải phim xuất hiện = vào Success.
 *
 * Exit 0 khi PASS, Exit 1 khi FAIL (timeout hoặc lỗi ở bất kỳ bước nào).
 * Chạy: E2E_URL=http://localhost:4173 node e2e/mobile-full-flow.test.mjs
 */

import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.env.E2E_URL || 'http://localhost:5173'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SHOT_DIR = path.join(__dirname, 'screenshots', 'mobile')
fs.mkdirSync(SHOT_DIR, { recursive: true })

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
let exitCode = 1

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--no-sandbox'],
})

const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })

page.on('pageerror', e => console.log(`[PAGEERROR] ${e.message}`))

try {
  console.log('-> goto', URL)
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
  await page.screenshot({ path: path.join(SHOT_DIR, 'flow-01-welcome.png'), fullPage: true })

  // 1. Welcome — cuộn tới CTA + bấm
  await page.waitForSelector('[data-landmark="welcome-cta"]', { timeout: 10000 })
  await page.evaluate(() => document.querySelector('[data-landmark="welcome-cta"]').scrollIntoView({ block: 'center' }))
  await page.click('[data-landmark="welcome-cta"]')
  await sleep(400)
  const reachedCapture = await page.evaluate(() => !!document.querySelector('[data-landmark="capture-btn"]'))
  console.log('BƯỚC 1 — vào Capture:', reachedCapture)
  if (!reachedCapture) throw new Error('Không vào được Capture sau khi bấm CTA')

  // 2. Chờ camera thật + chụp 6 frame
  let camReady = false
  for (let i = 0; i < 40; i++) {
    camReady = await page.evaluate(() => {
      const v = document.querySelector('[data-testid="camera-video"]')
      return !!v && v.readyState === 4 && v.videoWidth > 0
    })
    if (camReady) break
    await sleep(500)
  }
  console.log('BƯỚC 2 — camera ready:', camReady)
  if (!camReady) throw new Error('Camera không sẵn sàng sau 20s')

  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => document.querySelector('[data-landmark="capture-btn"]')?.scrollIntoView({ block: 'center' }))
    await page.click('[data-landmark="capture-btn"]').catch(() => {})
    await sleep(400)
  }
  const frameCount = await page.evaluate(() => {
    const el = document.querySelector('[data-landmark="frame-counter"]')
    const m = el?.textContent?.match(/^(\d+)/)
    return m ? parseInt(m[1]) : 0
  })
  console.log('BƯỚC 2 — số frame đã chụp:', frameCount)
  await page.screenshot({ path: path.join(SHOT_DIR, 'flow-02-captured.png'), fullPage: true })
  if (frameCount < 6) throw new Error(`Chụp thiếu frame, chỉ có ${frameCount}`)

  // 3. Bấm Xuất phim
  await page.evaluate(() => document.querySelector('[data-landmark="export-btn"]')?.scrollIntoView({ block: 'center' }))
  const exportBtn = await page.$('[data-landmark="export-btn"]')
  const exportDisabled = exportBtn ? await page.evaluate(b => b.disabled, exportBtn) : true
  console.log('BƯỚC 3 — nút Xuất tồn tại + không bị disable:', !!exportBtn, !exportDisabled)
  await page.click('[data-landmark="export-btn"]').catch(e => console.log('CLICK ERR', e.message))
  await sleep(400)
  await page.screenshot({ path: path.join(SHOT_DIR, 'flow-03-exporting.png'), fullPage: true })

  // 4. Chờ tới khi nút Tải phim xuất hiện (vào Success) — tối đa 24s
  let reachedSuccess = false
  for (let i = 0; i < 24; i++) {
    await sleep(1000)
    reachedSuccess = await page.evaluate(() => !!document.querySelector('[aria-label="Tải phim về máy"]'))
    if (reachedSuccess) { console.log(`BƯỚC 4 — vào Success sau ${i + 1}s`); break }
  }
  await page.screenshot({ path: path.join(SHOT_DIR, 'flow-04-success.png'), fullPage: true })

  if (!reachedSuccess) throw new Error('Không vào Success sau 24s chờ export')

  // Success buttons trong viewport (không tràn/che)
  await page.evaluate(() => document.querySelector('[aria-label="Tải phim về máy"]')?.scrollIntoView({ block: 'center' }))
  const dlVisible = await page.evaluate(() => {
    const el = document.querySelector('[aria-label="Tải phim về máy"]')
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight
  })
  console.log('BƯỚC 4 — nút Tải phim trong viewport:', dlVisible)

  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
  console.log('Không tràn ngang ở Success:', noOverflow)

  if (dlVisible && noOverflow) {
    console.log('✅ MOBILE FULL FLOW PASS — Welcome→Capture→chụp 6 frame→Export→Success chạy được trên mobile')
    exitCode = 0
  } else {
    console.log('❌ MOBILE FULL FLOW FAIL — Success có vấn đề layout')
  }
} catch (e) {
  console.log('❌ MOBILE FULL FLOW FAIL —', e.message)
  await page.screenshot({ path: path.join(SHOT_DIR, 'flow-99-error.png') }).catch(() => {})
} finally {
  await browser.close()
  process.exit(exitCode)
}
