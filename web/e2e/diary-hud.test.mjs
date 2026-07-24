/**
 * e2e/diary-hud.test.mjs
 * Gate chuẩn cho QA (T-XW10) — tạo dự án 🌱 Nhật ký thật → chụp → verify HUD 3 dải + onion inline
 * + todayLine + phim nháp S4 + chip Hub streak, trên Chrome thật (camera giả).
 *
 * Kịch bản:
 *  A. Hub → "+ Dự án mới" → chọn 🌱 Nhật ký → CTA → vào Capture của dự án 🌱 vừa tạo.
 *  B. Ngày 1 (chưa có ảnh hôm qua): dải trên "🌱 Ảnh 1 / 1", hint "📍 Đây là ảnh đầu tiên!", onion
 *     inline gọn "👻 40%" (mặc định).
 *  C. Chạm onion inline → bung slider → chụp gọn lại.
 *  D. Chụp 1 frame thật → dải trên "🌱 Ảnh 2 / 2", frame-counter="1", todayLine "Hôm nay: 1 ảnh".
 *  E. Mở phim nháp (S4) → CTA chính "Chụp tiếp ngày mai" (đã chụp hôm nay) → bấm quay lại Capture
 *     → dự án VẪN mở, đủ 1 frame (không mất dữ liệu, không đóng dự án).
 *  F. Về Hub → card dự án 🌱 hiện chip "🔥 1 ngày liền" (đã chụp hôm nay, streak=1).
 *  G. Screenshot HUD desktop + mobile 390×844 + onion inline expanded.
 *
 * Exit 0 khi PASS toàn bộ, Exit 1 khi có FAIL.
 * Chạy: node e2e/diary-hud.test.mjs
 *       E2E_URL=http://localhost:4173 node e2e/diary-hud.test.mjs
 */

import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.env.E2E_URL || 'http://localhost:5173'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SHOT_DIR = path.join(__dirname, 'screenshots')
const SHOT_DIR_MOBILE = path.join(__dirname, 'screenshots', 'mobile')
fs.mkdirSync(SHOT_DIR, { recursive: true })
fs.mkdirSync(SHOT_DIR_MOBILE, { recursive: true })

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

let overallPass = true
function report(name, pass, detail = '') {
  if (!pass) overallPass = false
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`)
  return pass
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--no-sandbox'],
})

async function waitCameraReady(page, timeoutMs = 15000) {
  const iterations = Math.ceil(timeoutMs / 500)
  for (let i = 0; i < iterations; i++) {
    const ready = await page.evaluate(() => {
      const v = document.querySelector('[data-testid="camera-video"]')
      return !!v && v.readyState === 4 && v.videoWidth > 0
    })
    if (ready) return true
    await sleep(500)
  }
  return false
}

let exitCode = 1

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1100, height: 900 })
  page.on('pageerror', e => console.log(`[PAGEERROR] ${e.message}`))

  console.log('-> goto', URL)
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
  await page.waitForSelector('[data-landmark="welcome-cta"]', { timeout: 10000 }).catch(() => {})
  await page.click('[data-landmark="welcome-cta"]').catch(() => {})
  await sleep(300)

  // ===== A. Tạo dự án 🌱 Nhật ký =====
  await page.waitForSelector('[data-testid="hub-new-project-card"]', { timeout: 10000 })
  await page.click('[data-testid="hub-new-project-card"]')
  await sleep(300)
  await page.waitForSelector('[data-testid="new-project-type-diary"]', { timeout: 10000 })
  await page.click('[data-testid="new-project-type-diary"]')
  await sleep(200)
  await page.click('[data-testid="new-project-cta"]')
  await sleep(400)
  const reachedCapture = await page.evaluate(() => !!document.querySelector('[data-landmark="capture-btn"]'))
  report('A-create-diary-project-reaches-capture', reachedCapture)

  // T-XW21 — S5 "Giới thiệu app iOS" giờ tự hiện NGAY sau khi tạo dự án 🌱 Nhật ký ĐẦU TIÊN (phủ
  // toàn màn hình) — PHẢI đóng trước khi thao tác HUD bên dưới, nếu không mọi click sau đó (vd
  // "onion-inline-compact") sẽ trúng nhầm overlay này thay vì control HUD thật.
  await page.waitForSelector('[data-testid="app-intro-screen"]', { timeout: 5000 }).catch(() => {})
  await page.click('[data-testid="app-intro-later-btn"]').catch(() => {})
  await sleep(200)

  const camReady = await waitCameraReady(page)
  report('A1-camera-ready', camReady)

  // ===== B. Ngày 1 — HUD ban đầu =====
  await sleep(300)
  const statusText0 = await page.evaluate(() => document.querySelector('[data-testid="diary-status-text"]')?.textContent ?? '')
  report('B1-status-ảnh-1-1', /Ảnh\s*1\s*\/\s*1/.test(statusText0), statusText0)

  const hintText0 = await page.evaluate(() => document.querySelector('[data-testid="diary-hint-text"]')?.textContent ?? '')
  report('B2-hint-first-day', hintText0.includes('Đây là ảnh đầu tiên'), hintText0)

  const onionCompact0 = await page.evaluate(() => document.querySelector('[data-testid="onion-inline-compact"]')?.textContent ?? '')
  report('B3-onion-inline-compact-40pct', onionCompact0.includes('40%'), onionCompact0)

  await page.screenshot({ path: path.join(SHOT_DIR, 'diary-B-day1-hud.png') })

  // ===== C. Bung/thu onion inline =====
  await page.click('[data-testid="onion-inline-compact"]')
  await sleep(200)
  const expandedVisible = await page.evaluate(() => !!document.querySelector('[data-testid="onion-inline-expanded"]'))
  report('C1-onion-inline-expands', expandedVisible)
  await page.screenshot({ path: path.join(SHOT_DIR, 'diary-C-onion-expanded.png') })

  await page.click('[data-testid="onion-inline-collapse"]')
  await sleep(200)
  const collapsedBack = await page.evaluate(() => !!document.querySelector('[data-testid="onion-inline-compact"]'))
  report('C2-onion-inline-collapses-back', collapsedBack)

  // ===== D. Chụp 1 frame thật =====
  await page.click('[aria-label="Chụp frame — phím Space"]')
  await sleep(500)
  const frameCount1 = await page.evaluate(() => document.querySelector('[data-landmark="frame-counter"]')?.textContent?.match(/^(\d+)/)?.[1])
  report('D1-frame-counter-1', frameCount1 === '1', `frameCount=${frameCount1}`)

  const statusText1 = await page.evaluate(() => document.querySelector('[data-testid="diary-status-text"]')?.textContent ?? '')
  report('D2-status-ảnh-2-2', /Ảnh\s*2\s*\/\s*2/.test(statusText1), statusText1)

  const todayLine = await page.evaluate(() => document.querySelector('[data-testid="diary-today-line"]')?.textContent ?? '')
  report('D3-today-line-1-photo', todayLine.includes('1') && todayLine.toLowerCase().includes('ảnh'), todayLine)

  await page.screenshot({ path: path.join(SHOT_DIR, 'diary-D-after-capture.png') })

  // ===== E. Phim nháp S4 =====
  await page.waitForSelector('[data-testid="view-draft-btn"]', { timeout: 10000 })
  await page.click('[data-testid="view-draft-btn"]')
  await sleep(300)
  const draftReached = await page.evaluate(() => !!document.querySelector('[data-landmark="draft-film-screen"]'))
  report('E0-draft-screen-reached', draftReached)

  const ctaText = await page.evaluate(() => document.querySelector('[data-testid="draft-cta-primary"]')?.textContent ?? '')
  report('E1-cta-shoot-tomorrow (đã chụp hôm nay)', ctaText.includes('ngày mai'), ctaText)

  await page.click('[data-testid="draft-cta-primary"]')
  await sleep(300)
  const backInCapture = await page.evaluate(() => !!document.querySelector('[data-landmark="capture-btn"]'))
  const frameCountAfterDraft = await page.evaluate(() => document.querySelector('[data-landmark="frame-counter"]')?.textContent?.match(/^(\d+)/)?.[1])
  report('E2-back-to-capture-keeps-frame', backInCapture && frameCountAfterDraft === '1', `back=${backInCapture} frameCount=${frameCountAfterDraft}`)

  // ===== F. Hub — chip streak =====
  await page.click('[data-testid="nav-hub"]')
  await sleep(500)
  const chipText = await page.evaluate(() => {
    const el = document.querySelector('[data-testid^="hub-chip-"]')
    return el ? { testid: el.getAttribute('data-testid'), text: el.textContent } : null
  })
  report('F1-hub-chip-streak-1', chipText?.testid === 'hub-chip-streak' && chipText.text.includes('1'), JSON.stringify(chipText))

  const dayBadge = await page.evaluate(() => document.querySelector('[data-testid^="hub-thumb-day-"]')?.textContent ?? null)
  report('F2-hub-day-badge-N1', dayBadge === 'N1', dayBadge)

  await page.screenshot({ path: path.join(SHOT_DIR, 'diary-F-hub-streak-chip.png') })

  await page.close()

  // ===== G. Mobile 390×844 — screenshot HUD diary =====
  {
    const mPage = await browser.newPage()
    await mPage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
    await mPage.evaluateOnNewDocument(() => localStorage.clear())
    await mPage.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await mPage.waitForSelector('[data-landmark="welcome-cta"]', { timeout: 10000 }).catch(() => {})
    await mPage.click('[data-landmark="welcome-cta"]').catch(() => {})
    await sleep(300)
    await mPage.waitForSelector('[data-testid="hub-new-project-card"]', { timeout: 10000 })
    await mPage.click('[data-testid="hub-new-project-card"]')
    await sleep(300)
    await mPage.click('[data-testid="new-project-type-diary"]')
    await sleep(200)
    await mPage.click('[data-testid="new-project-cta"]')
    // T-XW21 — đóng S5 nudge tự động (dự án Nhật ký đầu) trước khi chụp ảnh HUD, để screenshot
    // "diary-hud" vẫn đúng nội dung HUD (không phải màn giới thiệu app iPhone che mất).
    await mPage.waitForSelector('[data-testid="app-intro-screen"]', { timeout: 5000 }).catch(() => {})
    await mPage.click('[data-testid="app-intro-later-btn"]').catch(() => {})
    await sleep(300)
    await waitCameraReady(mPage, 10000)
    await sleep(300)
    const mobileHud = await mPage.evaluate(() => !!document.querySelector('[data-testid="diary-status-text"]'))
    report('G-mobile-diary-hud-visible', mobileHud)
    await mPage.screenshot({ path: path.join(SHOT_DIR_MOBILE, 'diary-hud-390x844.png'), fullPage: true })
    await mPage.close()
  }

  exitCode = overallPass ? 0 : 1
} catch (e) {
  console.log('SCRIPT ERROR:', e.message, e.stack)
  exitCode = 1
} finally {
  await browser.close()
  console.log(overallPass
    ? '\n✅ DIARY HUD PASS — HUD 3 dải + onion inline + todayLine + phim nháp S4 + chip Hub streak'
    : '\n❌ DIARY HUD FAIL — xem chi tiết ở trên')
  process.exit(exitCode)
}
