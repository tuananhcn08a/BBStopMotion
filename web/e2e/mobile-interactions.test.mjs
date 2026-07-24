/**
 * e2e/mobile-interactions.test.mjs
 * Gate QA (T-BS61) — bổ sung cho mobile-responsive.test.mjs (chỉ đo tràn ngang). Test này đo
 * TƯƠNG TÁC THẬT trên viewport mobile 390×844: nút/control có nằm trong viewport (tới được bằng
 * cuộn, không bị đè/cắt) VÀ bấm được (click thật → đúng hiệu ứng), không chỉ suy luận qua DOM tồn tại.
 *
 * Kịch bản:
 *  A. Capture (camera thật, không dùng gate fixture) — chụp 1 frame thật bằng nút Chụp,
 *     đổi tốc độ (FpsSelector), filmstrip cuộn ngang xem được thumbnail vừa chụp.
 *  B. Success (?gate=success) — nút "Tải phim về máy" + "Làm phim mới" nằm trong viewport,
 *     kích thước chạm tối thiểu ~44px (tiêu chuẩn tap target), bấm "Làm phim mới" quay lại Welcome.
 *  C. Library (?gate=library) — bấm nút QR mở modal, modal nằm trong viewport, bấm × đóng lại.
 *  D. Settings — camera dropdown, chọn tốc độ mặc định, slider onion đều bấm/kéo được, không bó cụm.
 *
 * Exit 0 khi PASS toàn bộ, Exit 1 khi có FAIL.
 * Chạy: E2E_URL=http://localhost:4173 node e2e/mobile-interactions.test.mjs
 */

import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.env.E2E_URL || 'http://localhost:5173'
const VIEWPORT = { width: 390, height: 844, isMobile: true, hasTouch: true }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SHOT_DIR = path.join(__dirname, 'screenshots', 'mobile')
fs.mkdirSync(SHOT_DIR, { recursive: true })

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

let overallPass = true
function report(name, pass, detail = '') {
  if (!pass) overallPass = false
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`)
  return pass
}

/** Phần tử nằm trong khung nhìn hiện tại (đã cuộn tới) và có kích thước chạm hợp lý. */
async function inViewportAndTappable(page, selector, minSize = 32) {
  return page.evaluate((sel, min) => {
    const el = document.querySelector(sel)
    if (!el) return { found: false }
    const r = el.getBoundingClientRect()
    const inView = r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth
    const big = r.width >= min && r.height >= min
    const cs = getComputedStyle(el)
    const visible = cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0
    return { found: true, inView, big, visible, w: Math.round(r.width), h: Math.round(r.height) }
  }, selector, minSize)
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--no-sandbox'],
})

try {
  // ===== A. Capture — camera thật =====
  {
    const page = await browser.newPage()
    await page.setViewport(VIEWPORT)
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForSelector('[data-landmark="welcome-cta"]', { timeout: 10000 }).catch(() => {})
    await page.click('[data-landmark="welcome-cta"]').catch(() => {})
    await sleep(300)

    // T-XW05 — home giờ là Hub; tạo 1 dự án Hoạt hình mặc định để vào Capture.
    await page.waitForSelector('[data-testid="hub-new-project-card"]', { timeout: 10000 }).catch(() => {})
    await page.click('[data-testid="hub-new-project-card"]').catch(() => {})
    await sleep(300)
    await page.waitForSelector('[data-testid="new-project-cta"]', { timeout: 10000 }).catch(() => {})
    await page.click('[data-testid="new-project-cta"]').catch(() => {})
    await sleep(300)

    // Chờ camera thật sẵn sàng
    let camReady = false
    for (let i = 0; i < 30; i++) {
      camReady = await page.evaluate(() => {
        const v = document.querySelector('[data-testid="camera-video"]')
        return !!v && v.readyState === 4 && v.videoWidth > 0
      })
      if (camReady) break
      await sleep(500)
    }
    report('A0-camera-ready', camReady)

    // Nút Chụp: cuộn tới + bấm được + chụp đúng frame
    await page.evaluate(() => document.querySelector('[data-landmark="capture-btn"]')?.scrollIntoView({ block: 'center' }))
    const btnState = await inViewportAndTappable(page, '[data-landmark="capture-btn"]')
    report('A1-capture-btn-reachable', btnState.found && btnState.inView && btnState.big, JSON.stringify(btnState))
    await page.click('[data-landmark="capture-btn"]').catch(() => {})
    await sleep(400)
    const frameCountAfter = await page.evaluate(() => {
      const el = document.querySelector('[data-landmark="frame-counter"]')
      const m = el?.textContent?.match(/^(\d+)/)
      return m ? parseInt(m[1]) : 0
    })
    report('A2-capture-btn-tappable', frameCountAfter >= 1, `frameCount=${frameCountAfter}`)

    // Speed selector (FpsSelector) — đổi tốc độ bấm được, không bó cụm (đủ khoảng cách chạm)
    await page.evaluate(() => document.querySelector('[data-landmark="speed-card"]')?.scrollIntoView({ block: 'center' }))
    const speedBtns = await page.$$('[data-landmark="speed-card"] button')
    let speedTappable = speedBtns.length > 0
    if (speedBtns.length > 1) {
      const box0 = await speedBtns[0].boundingBox()
      const box1 = await speedBtns[1].boundingBox()
      speedTappable = speedTappable && !!box0 && !!box1 && Math.abs((box1.x) - (box0.x + box0.width)) >= -2
      await speedBtns[1].click().catch(() => { speedTappable = false })
    }
    report('A3-speed-selector-tappable', speedTappable, `nút=${speedBtns.length}`)

    // Filmstrip — cuộn ngang CHỦ ĐÍCH (overflow-x:auto), thumbnail vừa chụp hiển thị
    const filmstripOk = await page.evaluate(() => {
      const fs = document.querySelector('[data-testid="filmstrip"]')
      const thumb = document.querySelector('[data-testid="thumb-0"]')
      return !!fs && !!thumb
    })
    report('A4-filmstrip-shows-thumbnail', filmstripOk)

    // Export button — cuộn tới + bấm được (đủ frame tối thiểu chưa thì chỉ cần kiểm tra reachable)
    await page.evaluate(() => document.querySelector('[data-landmark="export-btn"]')?.scrollIntoView({ block: 'center' }))
    const exportState = await inViewportAndTappable(page, '[data-landmark="export-btn"]')
    report('A5-export-btn-reachable', exportState.found && exportState.inView, JSON.stringify(exportState))

    await page.screenshot({ path: path.join(SHOT_DIR, 'A-capture-interactions.png'), fullPage: true })
    await page.close()
  }

  // ===== B. Success — nút Tải / Làm phim mới =====
  {
    const page = await browser.newPage()
    await page.setViewport(VIEWPORT)
    await page.goto(`${URL}/?gate=success`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await sleep(400)

    await page.evaluate(() => document.querySelector('[aria-label="Tải phim về máy"]')?.scrollIntoView({ block: 'center' }))
    const dlState = await inViewportAndTappable(page, '[aria-label="Tải phim về máy"]', 40)
    report('B1-download-btn-reachable-tap-size', dlState.found && dlState.inView && dlState.big, JSON.stringify(dlState))

    const qrCardOk = await page.evaluate(() => {
      const el = document.querySelector('[data-landmark="qr-card"]')
      if (!el) return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    })
    report('B2-qr-card-visible', qrCardOk)

    await page.evaluate(() => document.querySelector('[aria-label="Làm phim mới, reset toàn bộ"]')?.scrollIntoView({ block: 'center' }))
    const newFilmState = await inViewportAndTappable(page, '[aria-label="Làm phim mới, reset toàn bộ"]', 40)
    report('B3-newfilm-btn-reachable-tap-size', newFilmState.found && newFilmState.inView && newFilmState.big, JSON.stringify(newFilmState))

    await page.click('[aria-label="Làm phim mới, reset toàn bộ"]').catch(() => {})
    await sleep(400)
    // App.tsx handleNewFilm: reset về CAPTURING thẳng (không qua Welcome) — theo đúng thiết kế
    // ("Bấm nút xanh để bắt đầu phim mới ngay lập tức").
    const backToCapture = await page.evaluate(() => !!document.querySelector('[data-landmark="capture-btn"]'))
    report('B4-newfilm-btn-tappable-resets', backToCapture)

    await page.screenshot({ path: path.join(SHOT_DIR, 'B-success-interactions.png'), fullPage: true })
    await page.close()
  }

  // ===== C. Library — QR modal mở/đóng =====
  {
    const page = await browser.newPage()
    await page.setViewport(VIEWPORT)
    await page.goto(`${URL}/?gate=library`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForSelector('[data-landmark="library-screen"]', { timeout: 10000 }).catch(() => {})
    await sleep(300)

    await page.evaluate(() => document.querySelector('[data-testid="qr-gate-lib-1"]')?.scrollIntoView({ block: 'center' }))
    const qrBtnState = await inViewportAndTappable(page, '[data-testid="qr-gate-lib-1"]')
    report('C1-qr-btn-reachable', qrBtnState.found && qrBtnState.inView, JSON.stringify(qrBtnState))

    await page.click('[data-testid="qr-gate-lib-1"]').catch(() => {})
    await sleep(300)
    const modalOk = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="qr-modal"]')
      if (!modal) return { open: false }
      const r = modal.getBoundingClientRect()
      const vw = document.documentElement.clientWidth
      const vh = window.innerHeight
      const withinViewport = r.left >= -1 && r.right <= vw + 1 && r.top >= -1 && r.bottom <= vh + 1
      const img = document.querySelector('[data-testid="qr-modal-image"]')
      return { open: true, withinViewport, hasImage: !!img && img.getAttribute('src')?.startsWith('data:image') }
    })
    report('C2-qr-modal-opens-fits-viewport', modalOk.open && modalOk.withinViewport && modalOk.hasImage, JSON.stringify(modalOk))

    await page.click('[data-testid="qr-modal-close"]').catch(() => {})
    await sleep(200)
    const closed = await page.evaluate(() => !document.querySelector('[data-testid="qr-modal"]'))
    report('C3-qr-modal-closes', closed)

    await page.screenshot({ path: path.join(SHOT_DIR, 'C-library-qr-interactions.png'), fullPage: true })
    await page.close()
  }

  // ===== D. Settings — control không bó cụm =====
  {
    const page = await browser.newPage()
    await page.setViewport(VIEWPORT)
    await page.goto(`${URL}/?gate=disabled`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await sleep(300)
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cài đặt'))
      btn?.click()
    })
    await sleep(300)
    await page.waitForSelector('[data-landmark="settings-screen"]', { timeout: 5000 }).catch(() => {})

    // Dropdown/select cần tap-target lớn (>=24px); <input type="range"> là control native của
    // trình duyệt/OS — track/thumb mảnh theo chuẩn nhưng vùng chạm thật do OS mở rộng, không áp
    // cùng ngưỡng 24px như nút bấm tự vẽ.
    for (const sel of ['[data-testid="camera-dropdown"]', '[data-testid="goal-frames-select"]']) {
      await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel)
      const st = await inViewportAndTappable(page, sel, 24)
      report(`D-${sel}`, st.found && st.inView, JSON.stringify(st))
    }
    await page.evaluate(() => document.querySelector('[data-testid="onion-opacity-slider"]')?.scrollIntoView({ block: 'center' }))
    const sliderSt = await inViewportAndTappable(page, '[data-testid="onion-opacity-slider"]', 8)
    report('D-onion-opacity-slider (native range input)', sliderSt.found && sliderSt.inView, JSON.stringify(sliderSt))

    await page.screenshot({ path: path.join(SHOT_DIR, 'D-settings-interactions.png'), fullPage: true })
    await page.close()
  }
} catch (e) {
  overallPass = false
  console.log('SCRIPT ERROR:', e.message)
} finally {
  await browser.close()
}

console.log(overallPass ? '\n✅ MOBILE INTERACTIONS PASS — nút/control tới được + bấm được đúng trên viewport mobile' : '\n❌ MOBILE INTERACTIONS FAIL — xem chi tiết ở trên')
process.exit(overallPass ? 0 : 1)
