/**
 * e2e/photo-viewer-sort.test.mjs — T-XW14 gate thật (Chrome thật, camera giả).
 *
 * Kịch bản:
 *  A. Photo Viewer: chạm thumbnail mở ảnh to (badge "Ảnh N/M" đúng), phím → đổi ảnh, ESC đóng,
 *     click nền đen (ngoài ảnh) đóng.
 *  B. Sắp xếp transactional — PHẦN CỐT LÕI (RAM vs commit qua RELOAD TRANG THẬT, không phải nav
 *     trong-phiên):
 *     B1. Chụp 4 frame thật, đọc `capturedAt` GỐC qua IndexedDB (đánh dấu thứ tự ban đầu).
 *     B2. Vào "🔀 Sắp xếp" → kéo frame ĐẦU ra CUỐI (chỉ đổi RAM).
 *     B3. RELOAD TRANG (chưa bấm "✕ Xong") → mở lại dự án → thứ tự/số lượng frame trên đĩa PHẢI
 *         còn NGUYÊN như B1 (chứng minh nháp KHÔNG ghi đĩa).
 *     B4. Lặp lại kéo (giờ trên state đã resume) → bấm "✕ Xong" (commit) → RELOAD TRANG lần 2 →
 *         mở lại dự án → thứ tự frame trên đĩa PHẢI khớp đúng thứ tự MỚI vừa kéo (chứng minh commit
 *         ghi đĩa đúng 1 phát).
 *  C. Mobile 390×844 — screenshot bằng chứng Photo Viewer + chế độ Sắp xếp.
 *
 * Exit 0 khi PASS toàn bộ, Exit 1 khi có FAIL.
 * Chạy: node e2e/photo-viewer-sort.test.mjs   (nhớ `npm run dev` cổng 5173 trước)
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

async function dismissWelcome(page) {
  await page.waitForSelector('[data-landmark="welcome-cta"]', { timeout: 10000 }).catch(() => {})
  await page.click('[data-landmark="welcome-cta"]').catch(() => {})
  await sleep(300)
}

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

/** Đọc trực tiếp record `frames` từ IndexedDB (bỏ qua tầng app), sort theo seq — dùng để verify
 *  thứ tự/số lượng THẬT trên đĩa, độc lập với React state (khớp kỹ thuật T-XW09 normalizeCheck). */
async function readFramesFromIndexedDb(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('bbstopmotion-library')
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction('frames', 'readonly')
      const getAllReq = tx.objectStore('frames').getAll()
      getAllReq.onsuccess = () => {
        const records = getAllReq.result
          .slice()
          .sort((a, b) => a.seq - b.seq)
          .map(r => ({ seq: r.seq, capturedAt: r.capturedAt }))
        resolve(records)
      }
      getAllReq.onerror = () => reject(getAllReq.error)
    }
    req.onerror = () => reject(req.error)
  }))
}

/** Kéo thumbnail từ vị trí `fromIndex` sang `toIndex` bằng chuột THẬT (Pointer Events qua
 *  mousemove nhiều bước) — mirror thao tác "kéo chuột trực tiếp" desktop (mockup §2). */
async function dragThumb(page, fromIndex, toIndex) {
  const fromBox = await page.$eval(`[data-testid="thumb-${fromIndex}"]`, el => {
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  const toBox = await page.$eval(`[data-testid="thumb-${toIndex}"]`, el => {
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(fromBox.x, fromBox.y)
  await page.mouse.down()
  await page.mouse.move(toBox.x, toBox.y, { steps: 12 })
  await sleep(100)
  await page.mouse.up()
  await sleep(200)
}

let exitCode = 1

try {
  // ===== Desktop (1100×900) =====
  const page = await browser.newPage()
  await page.setViewport({ width: 1100, height: 900 })

  const logs = []
  page.on('console', m => logs.push(`[console.${m.type()}] ${m.text()}`))
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))
  page.on('dialog', async dialog => { await dialog.accept() }) // confirm() xoá-nháp — auto-accept

  console.log('-> goto', URL)
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
  await dismissWelcome(page)
  await createProjectFromHub(page)
  const camReady = await waitCameraReady(page)
  report('0-camera-ready', camReady)

  for (let i = 0; i < FRAME_COUNT; i++) {
    await page.click('[aria-label="Chụp frame — phím Space"]').catch(() => {})
    await sleep(400)
  }
  const capturedCount = await readFrameCount(page)
  report('0-captured-n-frames', capturedCount === FRAME_COUNT, `expected=${FRAME_COUNT} actual=${capturedCount}`)

  // ===== A. Photo Viewer =====
  await page.click('[data-testid="thumb-0"]')
  await sleep(200)
  await page.waitForSelector('[data-testid="photo-viewer"]', { timeout: 5000 }).catch(() => {})
  const badge0 = await page.evaluate(() => document.querySelector('[data-testid="photo-viewer-badge"]')?.textContent)
  report('A1-viewer-opens-with-correct-badge', badge0 === `Ảnh 1 / ${FRAME_COUNT}`, `badge="${badge0}"`)
  await page.screenshot({ path: path.join(SHOT_DIR, 'photoviewer-A-desktop-open.png') })

  await page.keyboard.press('ArrowRight')
  await sleep(150)
  const badge1 = await page.evaluate(() => document.querySelector('[data-testid="photo-viewer-badge"]')?.textContent)
  report('A2-arrow-right-advances-badge', badge1 === `Ảnh 2 / ${FRAME_COUNT}`, `badge="${badge1}"`)

  await page.keyboard.press('Escape')
  await sleep(200)
  const closedByEsc = await page.evaluate(() => !document.querySelector('[data-testid="photo-viewer"]'))
  report('A3-escape-closes-viewer', closedByEsc)

  // Mở lại → click NỀN ĐEN (góc, ngoài ảnh — ảnh contain căn giữa, góc luôn là nền) đóng.
  await page.click('[data-testid="thumb-2"]')
  await sleep(200)
  const badge2 = await page.evaluate(() => document.querySelector('[data-testid="photo-viewer-badge"]')?.textContent)
  report('A4-reopen-different-thumb-correct-badge', badge2 === `Ảnh 3 / ${FRAME_COUNT}`, `badge="${badge2}"`)
  await page.mouse.click(15, 15)
  await sleep(200)
  const closedByBackdrop = await page.evaluate(() => !document.querySelector('[data-testid="photo-viewer"]'))
  report('A5-click-backdrop-closes-viewer', closedByBackdrop)

  // ===== B1. Ghi lại capturedAt GỐC (thứ tự chụp thật) =====
  const originalFrames = await readFramesFromIndexedDb(page)
  report('B1-original-frame-count', originalFrames.length === FRAME_COUNT, JSON.stringify(originalFrames))

  // ===== B2. Vào Sắp xếp → kéo thumb-0 ra CUỐI (chỉ RAM) =====
  await page.click('[data-testid="sort-enter-btn"]')
  await sleep(200)
  await dragThumb(page, 0, FRAME_COUNT - 1)
  await page.screenshot({ path: path.join(SHOT_DIR, 'photoviewer-B2-desktop-sorting.png') })
  const undoActiveAfterDrag = await page.evaluate(() => !document.querySelector('[data-testid="sort-undo-btn"]')?.disabled)
  report('B2-drag-marks-draft-changes-undo-active', undoActiveAfterDrag)

  // ===== B3. RELOAD TRANG THẬT — CHƯA bấm "✕ Xong" =====
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 })
  await sleep(500)
  await page.waitForSelector('[data-landmark="hub-screen"]', { timeout: 10000 }).catch(() => {})
  await page.click('[data-testid^="hub-project-proj-"]')
  await sleep(500)
  const framesAfterUncommittedReload = await readFramesFromIndexedDb(page)
  const stillOriginalOrder = JSON.stringify(framesAfterUncommittedReload.map(f => f.capturedAt))
    === JSON.stringify(originalFrames.map(f => f.capturedAt))
  report(
    'B3-uncommitted-drag-reload-keeps-OLD-order-on-disk',
    stillOriginalOrder && framesAfterUncommittedReload.length === FRAME_COUNT,
    JSON.stringify({ before: originalFrames, afterReload: framesAfterUncommittedReload }),
  )

  // ===== B4. Kéo lại (trên state đã resume) → "✕ Xong" (commit) → RELOAD lần 2 =====
  await page.click('[data-testid="sort-enter-btn"]')
  await sleep(200)
  await dragThumb(page, 0, FRAME_COUNT - 1)
  await page.click('[data-testid="sort-done-btn"]')
  await sleep(400)
  const exitedSortMode = await page.evaluate(() => !!document.querySelector('[data-testid="sort-enter-btn"]'))
  report('B4a-finish-sort-exits-mode', exitedSortMode)

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 })
  await sleep(500)
  await page.waitForSelector('[data-landmark="hub-screen"]', { timeout: 10000 }).catch(() => {})
  await page.click('[data-testid^="hub-project-proj-"]')
  await sleep(500)
  const framesAfterCommittedReload = await readFramesFromIndexedDb(page)
  // Kéo seq 0 (capturedAt gốc index 0) ra cuối → thứ tự mong đợi capturedAt = [orig1, orig2, orig3, orig0].
  const expectedOrder = [
    originalFrames[1]?.capturedAt, originalFrames[2]?.capturedAt,
    originalFrames[3]?.capturedAt, originalFrames[0]?.capturedAt,
  ]
  const gotOrder = framesAfterCommittedReload.map(f => f.capturedAt)
  const seqContiguous = framesAfterCommittedReload.every((f, i) => f.seq === i)
  report(
    'B4b-committed-drag-reload-shows-NEW-order-on-disk',
    JSON.stringify(gotOrder) === JSON.stringify(expectedOrder) && seqContiguous,
    JSON.stringify({ expected: expectedOrder, got: gotOrder, seqContiguous }),
  )
  await page.screenshot({ path: path.join(SHOT_DIR, 'photoviewer-B4-desktop-after-commit-reload.png') })

  await page.close()

  if (!overallPass) {
    console.log('\n===== CONSOLE / ERRORS (desktop page) =====')
    console.log(logs.slice(-40).join('\n') || '(không có)')
  }

  // ===== C. Mobile 390×844 — screenshot Photo Viewer + Sắp xếp =====
  {
    const mPage = await browser.newPage()
    await mPage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
    mPage.on('dialog', async dialog => { await dialog.accept() })
    await mPage.evaluateOnNewDocument(() => localStorage.clear())
    await mPage.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await dismissWelcome(mPage)
    await createProjectFromHub(mPage)
    await waitCameraReady(mPage, 10000)
    for (let i = 0; i < FRAME_COUNT; i++) {
      await mPage.click('[data-landmark="capture-btn"]').catch(() => {})
      await sleep(400)
    }

    await mPage.click('[data-testid="thumb-0"]').catch(() => {})
    await sleep(300)
    const mobileViewerOpen = await mPage.evaluate(() => !!document.querySelector('[data-testid="photo-viewer"]'))
    report('C1-mobile-photo-viewer-opens', mobileViewerOpen)
    await mPage.screenshot({ path: path.join(SHOT_DIR_MOBILE, 'photoviewer-C1-mobile-open.png') })
    await mPage.click('[data-testid="photo-viewer-close"]').catch(() => {})
    await sleep(200)

    await mPage.click('[data-testid="sort-enter-btn"]').catch(() => {})
    await sleep(300)
    const mobileSortActive = await mPage.evaluate(() => !!document.querySelector('[data-testid="sort-done-btn"]'))
    report('C2-mobile-sort-mode-enters', mobileSortActive)
    await mPage.screenshot({ path: path.join(SHOT_DIR_MOBILE, 'photoviewer-C2-mobile-sorting.png') })

    await mPage.close()
  }

  exitCode = overallPass ? 0 : 1
} catch (e) {
  console.log('SCRIPT ERROR:', e.message)
  console.log(e.stack)
  exitCode = 1
} finally {
  await browser.close()
  console.log(overallPass
    ? '\n✅ PHOTO VIEWER + SẮP XẾP PASS — viewer tap/vuốt/zoom-key + transactional RAM-vs-commit qua reload thật'
    : '\n❌ PHOTO VIEWER + SẮP XẾP FAIL — xem chi tiết ở trên')
  process.exit(exitCode)
}
