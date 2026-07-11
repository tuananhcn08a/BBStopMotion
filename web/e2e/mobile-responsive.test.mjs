/**
 * e2e/mobile-responsive.test.mjs
 * Gate chuẩn cho QA (T-BS60) — chặn tái diễn bug "web không dùng được trên điện thoại" (scroll-lock
 * `overflow:hidden` toàn cục + layout desktop-first tràn ngang trên viewport hẹp).
 *
 * Kịch bản: mở app ở viewport mobile (390×844, khớp iPhone) qua 11 trạng thái màn hình chính
 *           (Welcome, Capture rỗng/có frame/denied camera/dưới ngưỡng export, Export progress,
 *           Success/QR, Library, Library+QR modal, Settings) → mỗi màn kiểm:
 *             1. Không tràn ngang toàn trang (`document.documentElement.scrollWidth <= clientWidth`,
 *                bỏ qua các khối cuộn ngang CHỦ ĐÍCH như Filmstrip `.filmstrip{overflow-x:auto}`).
 *             2. Welcome: CTA "Bắt đầu" cuộn tới được + bấm được → vào đúng màn Capture.
 *           Chụp ảnh từng màn vào e2e/screenshots/mobile/ làm bằng chứng.
 *
 * Exit 0 khi PASS (mọi màn không tràn ngang + Welcome CTA bấm được)
 * Exit 1 khi FAIL (bất kỳ màn nào tràn ngang, hoặc lỗi script)
 *
 * Chạy: node e2e/mobile-responsive.test.mjs
 *       E2E_URL=http://localhost:4173 node e2e/mobile-responsive.test.mjs
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

let overallPass = true

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--no-sandbox'],
})

/** Không tràn ngang toàn trang — bỏ qua phần tử nằm trong 1 khối cha có overflow-x:auto/scroll
 *  chủ đích (vd Filmstrip cuộn ngang xem thumbnail — đúng thiết kế, không phải bug). */
async function checkNoHorizontalOverflow(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const docOverflow = document.documentElement.scrollWidth > vw + 1
    const insideScrollContainer = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const cs = getComputedStyle(p)
        if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') return true
      }
      return false
    }
    const offenders = []
    document.querySelectorAll('body *').forEach(el => {
      if (insideScrollContainer(el)) return
      const r = el.getBoundingClientRect()
      if ((r.right > vw + 1 || r.left < -1) && r.width > 0) {
        offenders.push(`${el.tagName}.${(el.className || '').toString().slice(0, 40)}`)
      }
    })
    return { docOverflow, offenders: offenders.slice(0, 5) }
  })
}

async function checkScreen(name, gotoFn) {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  try {
    await gotoFn(page)
    await sleep(400)
    const { docOverflow, offenders } = await checkNoHorizontalOverflow(page)
    await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: true })
    const pass = !docOverflow && offenders.length === 0
    if (!pass) overallPass = false
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name} — tràn ngang=${docOverflow} offenders=${JSON.stringify(offenders)}`)
    return pass
  } catch (e) {
    overallPass = false
    console.log(`[FAIL] ${name} — LỖI SCRIPT: ${e.message}`)
    return false
  } finally {
    await page.close()
  }
}

try {
  await checkScreen('01-welcome', async page => {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
  })

  // AC1 T-BS60 — Welcome cuộn tới CTA + bấm được → vào đúng màn Capture.
  const ctaPage = await browser.newPage()
  await ctaPage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await ctaPage.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
  await sleep(300)
  await ctaPage.waitForSelector('[data-landmark="welcome-cta"]', { timeout: 5000 })
  await ctaPage.evaluate(() => document.querySelector('[data-landmark="welcome-cta"]').scrollIntoView({ block: 'center' }))
  const ctaVisible = await ctaPage.evaluate(() => {
    const r = document.querySelector('[data-landmark="welcome-cta"]').getBoundingClientRect()
    return r.top >= 0 && r.bottom <= window.innerHeight
  })
  await ctaPage.evaluate(() => document.querySelector('[data-landmark="welcome-cta"]').click())
  await sleep(800)
  const reachedCapture = await ctaPage.evaluate(() => !!document.querySelector('[data-landmark="capture-btn"]'))
  console.log(`[${ctaVisible && reachedCapture ? 'PASS' : 'FAIL'}] welcome-cta-flow — cuộn tới CTA=${ctaVisible} vào Capture=${reachedCapture}`)
  if (!ctaVisible || !reachedCapture) overallPass = false
  await ctaPage.close()

  await checkScreen('02-capture-empty', async page => {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await sleep(300)
    await page.evaluate(() => document.querySelector('[data-landmark="welcome-cta"]').click())
    await sleep(800)
  })

  await checkScreen('03-capture-with-frames', async page => {
    await page.goto(`${URL}/?gate=capture`, { waitUntil: 'domcontentloaded', timeout: 15000 })
  })

  await checkScreen('04-capture-denied', async page => {
    await page.goto(`${URL}/?gate=denied`, { waitUntil: 'domcontentloaded', timeout: 15000 })
  })

  await checkScreen('05-capture-min-frames', async page => {
    await page.goto(`${URL}/?gate=disabled`, { waitUntil: 'domcontentloaded', timeout: 15000 })
  })

  await checkScreen('06-export-progress', async page => {
    await page.goto(`${URL}/?gate=exporting`, { waitUntil: 'domcontentloaded', timeout: 15000 })
  })

  await checkScreen('07-success', async page => {
    await page.goto(`${URL}/?gate=success`, { waitUntil: 'domcontentloaded', timeout: 15000 })
  })

  await checkScreen('08-library', async page => {
    await page.goto(`${URL}/?gate=library`, { waitUntil: 'domcontentloaded', timeout: 15000 })
  })

  await checkScreen('09-library-qr-modal', async page => {
    await page.goto(`${URL}/?gate=library`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await sleep(300)
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'QR')
      btn?.click()
    })
  })

  await checkScreen('10-settings', async page => {
    await page.goto(`${URL}/?gate=disabled`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await sleep(300)
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cài đặt'))
      btn?.click()
    })
  })
} finally {
  await browser.close()
}

console.log(overallPass ? '\n✅ MOBILE RESPONSIVE PASS — 10 màn không tràn ngang, Welcome CTA cuộn tới + bấm được' : '\n❌ MOBILE RESPONSIVE FAIL — xem chi tiết ở trên')
process.exit(overallPass ? 0 : 1)
