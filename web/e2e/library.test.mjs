/**
 * e2e/library.test.mjs
 * Gate chuẩn cho QA — chặn tái diễn bug "nút QR chết" (T-BS12 architect FAIL, TS-BS-21 P0).
 *
 * Kịch bản: mở app với `?gate=library` (fixture seed 4 phim mẫu, đã có sẵn cho Visual Diff Gate)
 *           → bấm nút "QR" trên 1 phim đã upload → modal QR phải mở, chứa ảnh mã QR
 *           → bấm nút × → modal phải đóng lại.
 *
 * Exit 0 khi PASS (modal QR mở đúng + đóng được)
 * Exit 1 khi FAIL (nút QR không phản hồi / modal không mở / không đóng được)
 *
 * Chạy: node e2e/library.test.mjs
 *       E2E_URL=http://localhost:4173 node e2e/library.test.mjs
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
  args: ['--no-sandbox'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1100, height: 900 })

const logs = []
page.on('console', m => logs.push(`[console.${m.type()}] ${m.text()}`))
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))

async function screenshot(label) {
  await page.screenshot({ path: path.join(SHOT_DIR, `lib-${label}.png`) })
}

try {
  console.log('-> goto', `${URL}/?gate=library`)
  await page.goto(`${URL}/?gate=library`, { waitUntil: 'domcontentloaded', timeout: 15000 })
  await page.waitForSelector('[data-landmark="library-screen"]', { timeout: 10000 })
  await screenshot('01-library')

  // Fixture gate-lib-1 ("Robot bay vào vũ trụ") đã có uploadUrl sẵn (xem src/lib/gateFixture.ts)
  // → nút QR phải hiện diện và bấm được.
  const qrBtn = await page.$('[data-testid="qr-gate-lib-1"]')
  console.log('NÚT QR tồn tại:', !!qrBtn)

  if (!qrBtn) {
    console.log('❌ LIBRARY FAIL — không tìm thấy nút QR cho phim đã upload')
  } else {
    await qrBtn.click()
    await sleep(300)

    const modalOpen = await page.evaluate(() => !!document.querySelector('[data-testid="qr-modal"]'))
    const hasImage = await page.evaluate(() => {
      const img = document.querySelector('[data-testid="qr-modal-image"]')
      return !!img && img.getAttribute('src')?.startsWith('data:image')
    })
    console.log('MODAL QR mở:', modalOpen, '| có ảnh mã QR:', hasImage)
    await screenshot('02-qr-modal')

    if (!modalOpen || !hasImage) {
      console.log('❌ LIBRARY FAIL — bấm QR không mở modal hoặc modal không có ảnh mã QR (nút chết)')
    } else {
      // Đóng modal bằng nút × — xác nhận modal biến mất (không phải nút chết theo hướng ngược lại).
      await page.click('[data-testid="qr-modal-close"]').catch(() => {})
      await sleep(200)
      const modalClosed = await page.evaluate(() => !document.querySelector('[data-testid="qr-modal"]'))
      console.log('MODAL đã đóng sau khi bấm ×:', modalClosed)
      await screenshot('03-after-close')

      if (modalClosed) {
        console.log('✅ LIBRARY PASS — nút QR mở modal đúng phim + đóng được')
        exitCode = 0
      } else {
        console.log('❌ LIBRARY FAIL — modal không đóng được bằng nút ×')
      }
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
