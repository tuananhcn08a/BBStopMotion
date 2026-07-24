/**
 * e2e/project-resume.test.mjs
 * Gate chuẩn cho QA (T-XW05) — kiểm chứng KEYSTONE của phase: Hub đa dự án + resume qua RELOAD
 * TRANG THẬT (không phải nav trong-phiên — đây là điểm khác biệt bắt buộc so với F5/TS-BS-14 cũ,
 * chứng minh frame thật sự nằm trong IndexedDB, không phải React state).
 *
 * Kịch bản:
 *  A. Hub rỗng lúc đầu (chưa có dự án nào) — chụp ảnh bằng chứng desktop + mobile 390×844.
 *  B. Tạo dự án Hoạt hình mặc định qua sheet ("+ Dự án mới" → "Bắt đầu chụp") → vào Capture.
 *  C. Chụp N=4 frame thật (camera giả).
 *  D. RELOAD TRANG (page.reload()) — mô phỏng đóng/mở lại tab.
 *  E. Hub hiện đúng dự án vừa tạo (card + số frame trong meta line).
 *  F. Mở lại dự án (bấm card) → Capture RESUME đủ N frame (frame-counter + filmstrip).
 *  G. Xoá dự án qua menu "⋯" → "Xoá dự án" (auto-accept `window.confirm` — HubScreen dùng
 *     confirm() gốc trình duyệt) → dự án biến mất khỏi Hub, quay lại empty state.
 *
 * Exit 0 khi PASS toàn bộ, Exit 1 khi có FAIL.
 * Chạy: node e2e/project-resume.test.mjs
 *       E2E_URL=http://localhost:4173 node e2e/project-resume.test.mjs
 */

import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.env.E2E_URL || 'http://localhost:5173'
const FRAME_COUNT = 4

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
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--no-sandbox',
  ],
})

/** Bấm qua Welcome (F6) — vào Hub (T-XW05 home=hub). */
async function dismissWelcome(page) {
  await page.waitForSelector('[data-landmark="welcome-cta"]', { timeout: 10000 }).catch(() => {})
  await page.click('[data-landmark="welcome-cta"]').catch(() => {})
  await sleep(300)
}

/** Hub → "+ Dự án mới" → sheet (🎭 Hoạt hình đã chọn sẵn) → "Bắt đầu chụp" → Capture. */
async function createProjectFromHub(page) {
  await page.waitForSelector('[data-testid="hub-new-project-card"]', { timeout: 10000 })
  await page.click('[data-testid="hub-new-project-card"]')
  await sleep(300)
  await page.waitForSelector('[data-testid="new-project-cta"]', { timeout: 10000 })
  await page.click('[data-testid="new-project-cta"]')
  await sleep(400)
}

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

async function readFrameCount(page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-landmark="frame-counter"]')
    const m = el?.textContent?.match(/^(\d+)/)
    return m ? parseInt(m[1], 10) : 0
  })
}

let exitCode = 1

try {
  // ===== Desktop (1100×900) — luồng chính đầy đủ A→G =====
  const page = await browser.newPage()
  await page.setViewport({ width: 1100, height: 900 })

  const logs = []
  page.on('console', m => logs.push(`[console.${m.type()}] ${m.text()}`))
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))
  // HubScreen dùng window.confirm() gốc cho xoá dự án (bước G) — auto-accept mọi dialog.
  page.on('dialog', async dialog => { await dialog.accept() })

  console.log('-> goto', URL)
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
  await dismissWelcome(page)

  // ===== A. Hub rỗng lúc đầu =====
  const emptyHintVisible = await page.evaluate(() => !!document.querySelector('[data-testid="hub-empty-hint"]'))
  report('A-hub-empty-on-first-open', emptyHintVisible)
  await page.screenshot({ path: path.join(SHOT_DIR, 'resume-A-hub-empty.png') })

  // ===== B. Tạo dự án =====
  await createProjectFromHub(page)
  const reachedCapture = await page.evaluate(() => !!document.querySelector('[data-landmark="capture-btn"]'))
  report('B-create-project-reaches-capture', reachedCapture)

  // ===== C. Chụp N frame thật =====
  const camReady = await waitCameraReady(page)
  report('C0-camera-ready', camReady)
  for (let i = 0; i < FRAME_COUNT; i++) {
    await page.click('[aria-label="Chụp frame — phím Space"]').catch(() => {})
    await sleep(400)
  }
  const capturedCount = await readFrameCount(page)
  report('C1-captured-n-frames', capturedCount === FRAME_COUNT, `expected=${FRAME_COUNT} actual=${capturedCount}`)
  await page.screenshot({ path: path.join(SHOT_DIR, 'resume-C-captured.png') })

  // T-XW09 — verify frame đã normalize NGAY LÚC CHỤP: đọc bytes THẬT từ IndexedDB (bỏ qua tầng
  // app, đọc thẳng record 'frames'), decode qua createImageBitmap (Chrome thật, không mock) để đo
  // kích thước pixel THẬT + kiểm magic bytes JPEG (FF D8 FF).
  const normalizeCheck = await page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('bbstopmotion-library')
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction('frames', 'readonly')
      const getAllReq = tx.objectStore('frames').getAll()
      getAllReq.onsuccess = async () => {
        const records = getAllReq.result
        if (records.length === 0) { resolve({ ok: false, reason: 'no frame records in IndexedDB' }); return }
        const first = records[0]
        const bytes = new Uint8Array(first.bytes)
        const magicOk = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        try {
          const blob = new Blob([first.bytes], { type: 'image/jpeg' })
          const bitmap = await createImageBitmap(blob)
          resolve({
            ok: true,
            recordCount: records.length,
            byteLength: first.bytes.byteLength,
            magicOk,
            width: bitmap.width,
            height: bitmap.height,
          })
        } catch (e) {
          resolve({ ok: false, reason: 'createImageBitmap failed: ' + e.message })
        }
      }
      getAllReq.onerror = () => reject(getAllReq.error)
    }
    req.onerror = () => reject(req.error)
  }))
  console.log('[T-XW09] Frame thực đo:', JSON.stringify(normalizeCheck))
  report(
    'C2-frame-normalized-1280x720-jpeg',
    normalizeCheck.ok && normalizeCheck.magicOk && normalizeCheck.width === 1280 && normalizeCheck.height === 720,
    JSON.stringify(normalizeCheck),
  )

  // Đọc project id đang mở để dùng lại testid sau reload (Hub liệt kê nhiều card nếu có).
  // Lấy qua URL không có — id chỉ tồn tại trong React state, nên dò card DUY NHẤT sau reload thay.

  // ===== D. RELOAD TRANG THẬT — mô phỏng đóng/mở lại tab =====
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 })
  await sleep(500)

  // Welcome KHÔNG hiện lại sau reload (F6 persist qua localStorage, T-XW05 vá lỗi web cũ).
  const welcomeGoneAfterReload = await page.evaluate(() => !document.querySelector('[data-landmark="welcome-cta"]'))
  report('D0-welcome-not-shown-again-after-reload', welcomeGoneAfterReload)

  // ===== E. Hub hiện đúng dự án + số frame trong meta line =====
  await page.waitForSelector('[data-landmark="hub-screen"]', { timeout: 10000 })
  const hubAfterReload = await page.evaluate((expectedCount) => {
    const cards = Array.from(document.querySelectorAll('[data-testid^="hub-project-proj-"]'))
    if (cards.length !== 1) return { ok: false, cardCount: cards.length }
    const meta = cards[0].querySelector('[class*="meta"]')?.textContent ?? ''
    return { ok: true, cardCount: cards.length, meta, hasExpectedCount: meta.includes(`${expectedCount} frame`) }
  }, FRAME_COUNT)
  report(
    'E-hub-shows-project-with-correct-frame-count-after-reload',
    hubAfterReload.ok && hubAfterReload.hasExpectedCount,
    JSON.stringify(hubAfterReload),
  )
  await page.screenshot({ path: path.join(SHOT_DIR, 'resume-E-hub-after-reload.png') })

  // ===== F. Mở lại dự án → Capture RESUME đủ N frame =====
  await page.click('[data-testid^="hub-project-proj-"]')
  await sleep(500)
  const resumedReachedCapture = await page.evaluate(() => !!document.querySelector('[data-landmark="capture-btn"]'))
  const resumedCount = await readFrameCount(page)
  report(
    'F-resume-shows-all-n-frames-in-order',
    resumedReachedCapture && resumedCount === FRAME_COUNT,
    `reachedCapture=${resumedReachedCapture} frameCount=${resumedCount}`,
  )
  const filmstripThumbCount = await page.evaluate(() => document.querySelectorAll('[data-testid^="thumb-"]').length)
  report('F1-resume-filmstrip-thumb-count', filmstripThumbCount === FRAME_COUNT, `thumbs=${filmstripThumbCount}`)
  await page.screenshot({ path: path.join(SHOT_DIR, 'resume-F-resumed-capture.png') })

  // ===== G. Xoá dự án qua menu ⋯ =====
  await page.click('[data-landmark="nav-hub"]').catch(() => {})
  await sleep(300)
  await page.waitForSelector('[data-testid^="hub-project-menu-"]', { timeout: 10000 })
  await page.click('[data-testid^="hub-project-menu-"]')
  await sleep(200)
  await page.click('[data-testid^="hub-project-delete-"]')
  await sleep(400) // window.confirm auto-accept qua page.on('dialog') ở trên
  const hubEmptyAfterDelete = await page.evaluate(() => !!document.querySelector('[data-testid="hub-empty-hint"]'))
  const cardGoneAfterDelete = await page.evaluate(() => document.querySelectorAll('[data-testid^="hub-project-proj-"]').length === 0)
  report('G-delete-project-removes-from-hub', hubEmptyAfterDelete && cardGoneAfterDelete, `empty=${hubEmptyAfterDelete} noCards=${cardGoneAfterDelete}`)
  await page.screenshot({ path: path.join(SHOT_DIR, 'resume-G-hub-after-delete.png') })

  await page.close()

  // ===== Mobile 390×844 — screenshot bằng chứng Hub (có dự án + empty) =====
  {
    const mPage = await browser.newPage()
    await mPage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
    // F6 — welcomeSeen persist qua localStorage (cùng origin, dùng CHUNG mọi page trong 1
    // browser instance) — desktop page ở trên đã dismiss Welcome rồi, xoá lại để mobile-page
    // này thấy đúng Welcome thật (mô phỏng người dùng MỚI, không chờ timeout vô ích).
    await mPage.evaluateOnNewDocument(() => localStorage.clear())
    await mPage.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await dismissWelcome(mPage)
    await mPage.screenshot({ path: path.join(SHOT_DIR_MOBILE, 'resume-hub-empty-390x844.png'), fullPage: true })

    await createProjectFromHub(mPage)
    await waitCameraReady(mPage, 10000)
    await mPage.click('[data-landmark="capture-btn"]').catch(() => {})
    await sleep(400)
    await mPage.click('[data-landmark="nav-hub"]').catch(() => {})
    await sleep(400)
    const mobileHasCard = await mPage.evaluate(() => document.querySelectorAll('[data-testid^="hub-project-proj-"]').length === 1)
    report('mobile-hub-shows-created-project', mobileHasCard)
    await mPage.screenshot({ path: path.join(SHOT_DIR_MOBILE, 'resume-hub-with-project-390x844.png'), fullPage: true })
    await mPage.close()
  }

  if (!overallPass) {
    console.log('\n===== CONSOLE / ERRORS (desktop page) =====')
    console.log(logs.slice(-40).join('\n') || '(không có)')
  }
  exitCode = overallPass ? 0 : 1
} catch (e) {
  console.log('SCRIPT ERROR:', e.message)
  exitCode = 1
} finally {
  await browser.close()
  console.log(overallPass
    ? '\n✅ PROJECT RESUME PASS — Hub + tạo dự án + chụp + reload thật + resume đủ frame + xoá dự án'
    : '\n❌ PROJECT RESUME FAIL — xem chi tiết ở trên')
  process.exit(exitCode)
}
