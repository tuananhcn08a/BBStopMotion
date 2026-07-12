/**
 * e2e/mobile-qa-bs64-66.test.mjs
 * Gate QA (T-BS61, đợt 2) — verify ĐỘC LẬP các AC riêng của T-BS64 (touch-first) + T-BS66
 * (Welcome vừa 1 màn/logo hết đè, camera mặc định SAU, Success play/download đúng file) mà
 * mobile-responsive/-interactions/-full-flow (viết trước T-BS64/66) CHƯA phủ.
 *
 * Kịch bản:
 *  A. Welcome (390×844) — không cần cuộn để thấy nút Start; không còn hint "nút xanh trên bàn";
 *     icon trang trí (.deco) không hiện đè logo/nút.
 *  B. Capture — camera mở mặc định facingMode=environment (SAU) trên mobile (chặn getUserMedia
 *     đo constraints thật, không suy đoán qua UI); nút xoá frame HIỆN sẵn không cần hover (computed
 *     display, không phải :hover giả lập).
 *  C. Library — nút xoá phim HIỆN sẵn không cần hover.
 *  D. Success — bấm nút play → video thật sự play() (video.paused chuyển false); nút Tải về máy
 *     tải đúng blob video/mp4 (không phải điều hướng sang trang HTML).
 *
 * Exit 0 khi PASS toàn bộ, Exit 1 khi có FAIL.
 * Chạy: E2E_URL=http://localhost:4173 node e2e/mobile-qa-bs64-66.test.mjs
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

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--no-sandbox'],
})

try {
  // ===== A. Welcome — vừa 1 màn + không hint bàn + deco không đè =====
  {
    const page = await browser.newPage()
    await page.setViewport(VIEWPORT)
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForSelector('[data-landmark="welcome-cta"]', { timeout: 10000 })
    await sleep(200)

    const fit = await page.evaluate(() => {
      const doc = document.documentElement
      return { scrollH: doc.scrollHeight, viewportH: window.innerHeight }
    })
    report('A1-welcome-fits-no-scroll', fit.scrollH <= fit.viewportH + 4, JSON.stringify(fit))

    const ctaInView = await page.evaluate(() => {
      const el = document.querySelector('[data-landmark="welcome-cta"]')
      const r = el.getBoundingClientRect()
      return r.top >= 0 && r.bottom <= window.innerHeight
    })
    report('A2-cta-visible-without-scroll', ctaInView)

    const hintGone = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('body *'))
      const hintEl = els.find(e => /nút xanh.*trên bàn|green.*button.*desk/i.test(e.textContent || '') && e.children.length === 0)
      if (!hintEl) return true // not in DOM at all — fine
      const cs = getComputedStyle(hintEl)
      return cs.display === 'none'
    })
    report('A3-desk-hint-hidden-on-mobile', hintGone)

    const decoHidden = await page.evaluate(() => {
      const decos = Array.from(document.querySelectorAll('[aria-hidden="true"]')).filter(e =>
        /🎬|⭐|🎞️|🤖/.test(e.textContent || ''))
      if (decos.length === 0) return true
      return decos.every(d => getComputedStyle(d).display === 'none')
    })
    report('A4-deco-icons-hidden-no-overlap', decoHidden)

    // logo icon + wordmark không đè nhau (bounding box không overlap)
    const logoNoOverlap = await page.evaluate(() => {
      const icon = document.querySelector('[class*="logoIcon"]')
      const word = document.querySelector('[class*="wordmark"]:not([class*="Accent"])')
      if (!icon || !word) return false
      const a = icon.getBoundingClientRect()
      const b = word.getBoundingClientRect()
      const overlap = !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)
      return !overlap
    })
    report('A5-logo-icon-wordmark-no-overlap', logoNoOverlap)

    await page.screenshot({ path: path.join(SHOT_DIR, 'E-welcome-fit.png') })
    await page.close()
  }

  // ===== B. Capture — camera mặc định SAU + nút xoá frame luôn hiện =====
  {
    const page = await browser.newPage()
    await page.setViewport(VIEWPORT)

    let capturedConstraints = null
    await page.evaluateOnNewDocument(() => {
      const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
      navigator.mediaDevices.getUserMedia = (constraints) => {
        window.__lastConstraints = constraints
        return orig(constraints)
      }
    })

    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.click('[data-landmark="welcome-cta"]').catch(() => {})
    await sleep(600)
    capturedConstraints = await page.evaluate(() => window.__lastConstraints)
    const facing = capturedConstraints?.video?.facingMode?.ideal
    report('B1-camera-default-facing-environment', facing === 'environment', JSON.stringify(capturedConstraints))

    // camera thật sẵn sàng rồi mới chụp 1 frame để filmstrip có phần tử
    let camReady = false
    for (let i = 0; i < 30; i++) {
      camReady = await page.evaluate(() => {
        const v = document.querySelector('[data-testid="camera-video"]')
        return !!v && v.readyState === 4 && v.videoWidth > 0
      })
      if (camReady) break
      await sleep(500)
    }
    report('B2-camera-ready', camReady)
    await page.click('[data-landmark="capture-btn"]').catch(() => {})
    await sleep(400)

    // Nút xoá frame: computed display phải KHÁC 'none' mà KHÔNG cần :hover/:focus giả lập
    const deleteVisibleNoHover = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="delete-frame-0"]')
      if (!btn) return { found: false }
      const cs = getComputedStyle(btn)
      return { found: true, display: cs.display, visible: cs.display !== 'none' }
    })
    report('B3-delete-frame-btn-visible-without-hover', deleteVisibleNoHover.found && deleteVisibleNoHover.visible, JSON.stringify(deleteVisibleNoHover))

    // Bấm thật (không hover trước) → frame count giảm
    const before = await page.evaluate(() => document.querySelector('[data-landmark="frame-counter"]')?.textContent?.match(/^(\d+)/)?.[1])
    await page.click('[data-testid="delete-frame-0"]').catch(() => {})
    await sleep(300)
    const after = await page.evaluate(() => document.querySelector('[data-landmark="frame-counter"]')?.textContent?.match(/^(\d+)/)?.[1])
    report('B4-delete-frame-btn-tappable-no-prior-hover', Number(after) < Number(before), `before=${before} after=${after}`)

    await page.screenshot({ path: path.join(SHOT_DIR, 'F-capture-backcam-delete.png') })
    await page.close()
  }

  // ===== C. Library — nút xoá phim luôn hiện không cần hover =====
  {
    const page = await browser.newPage()
    await page.setViewport(VIEWPORT)
    await page.goto(`${URL}/?gate=library`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForSelector('[data-landmark="library-screen"]', { timeout: 10000 }).catch(() => {})
    await sleep(300)

    const delState = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid^="delete-"]')
      if (!btn) return { found: false }
      const cs = getComputedStyle(btn)
      return { found: true, visible: cs.display !== 'none' }
    })
    report('C1-library-delete-btn-visible-without-hover', delState.found && delState.visible, JSON.stringify(delState))

    await page.screenshot({ path: path.join(SHOT_DIR, 'G-library-delete.png') })
    await page.close()
  }

  // ===== D. Success — play thật + download đúng file (không phải HTML) =====
  // Dùng luồng THẬT (camera thật + export ffmpeg.wasm thật), KHÔNG dùng fixture `?gate=success`:
  // fixture đó là `new Blob(['gate-fixture'], {type:'video/mp4'})` — không phải byte video thật,
  // nên video.play() luôn NotSupportedError bất kể code app đúng hay sai (đã tự xác nhận bằng debug
  // script riêng trước khi kết luận, tránh false-positive/false-negative).
  {
    const page = await browser.newPage()
    await page.setViewport(VIEWPORT)
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForSelector('[data-landmark="welcome-cta"]', { timeout: 10000 })
    await page.click('[data-landmark="welcome-cta"]')
    await sleep(300)

    let camReady = false
    for (let i = 0; i < 30; i++) {
      camReady = await page.evaluate(() => {
        const v = document.querySelector('[data-testid="camera-video"]')
        return !!v && v.readyState === 4 && v.videoWidth > 0
      })
      if (camReady) break
      await sleep(500)
    }
    for (let i = 0; i < 6; i++) {
      await page.click('[data-landmark="capture-btn"]').catch(() => {})
      await sleep(350)
    }
    await page.click('[data-landmark="export-btn"]').catch(() => {})

    let reachedSuccess = false
    for (let i = 0; i < 24; i++) {
      await sleep(1000)
      reachedSuccess = await page.evaluate(() => !!document.querySelector('[data-testid="success-play-btn"]'))
      if (reachedSuccess) break
    }
    report('D0-reached-success-with-real-export', reachedSuccess)
    await sleep(300)

    const pausedBefore = await page.evaluate(() => document.querySelector('[data-testid="success-video"]')?.paused)
    report('D1-video-paused-before-play', pausedBefore === true, `paused=${pausedBefore}`)

    await page.click('[data-testid="success-play-btn"]').catch(e => report('D-click-play-error', false, e.message))
    await sleep(500)
    const pausedAfter = await page.evaluate(() => document.querySelector('[data-testid="success-video"]')?.paused)
    const playBtnGone = await page.evaluate(() => !document.querySelector('[data-testid="success-play-btn"]'))
    report('D2-play-btn-actually-plays-video', pausedAfter === false, `paused=${pausedAfter}`)
    report('D3-play-btn-hides-once-playing', playBtnGone)

    // Download nhánh A — mobile thật có Web Share API (canShare files=true, đúng môi trường iOS
    // Safari thật): xác nhận app gửi ĐÚNG file video/mp4 (result.blob/result.filename) cho share
    // sheet, không phải HTML. LƯU Ý: `navigator.share()` thật trong headless Chrome (không có
    // OS share-sheet để người dùng chọn) TREO VĨNH VIỄN promise (tự xác nhận bằng debug script
    // riêng: gọi trực tiếp, chờ 4s, không resolve/reject) — đây là giới hạn môi trường headless,
    // KHÔNG PHẢI bug app. Nên mock chỉ phần `navigator.share` để bắt tham số app gửi đi, không chờ
    // promise thật resolve.
    // File/Blob không sống sót qua ranh giới serialize CDP của page.evaluate() → phải trích
    // name/type/size thành object thuần TRONG page context rồi mới resolve ra Node.
    const shareArgs = await page.evaluate(() => {
      return new Promise((resolve) => {
        navigator.share = (data) => {
          const f = data?.files?.[0]
          resolve({ title: data?.title, fileName: f?.name, fileType: f?.type, fileSize: f?.size })
          return new Promise(() => {}) // không resolve thật — mô phỏng headless treo vô hạn, không quan trọng vì đã lấy được data
        }
        document.querySelector('[aria-label="Tải phim về máy"]').click()
        setTimeout(() => resolve({ timeout: true }), 3000)
      })
    })
    report(
      'D4a-share-sends-correct-mp4-file',
      !shareArgs?.timeout && shareArgs.fileType === 'video/mp4' && shareArgs.fileName?.toLowerCase().endsWith('.mp4') && shareArgs.fileSize > 0,
      JSON.stringify(shareArgs),
    )

    // Download nhánh B — fallback khi trình duyệt KHÔNG hỗ trợ Web Share files (desktop / Android
    // Chrome cũ...): xoá navigator.share hẳn, bấm lại nút Tải, chặn <a download> lúc tạo/click để
    // đo href/download attribute thay vì để puppeteer điều hướng thật.
    const dl = await page.evaluate(() => {
      // `share` được gán ở nhánh A là own-property che phủ Navigator.prototype.share thật (bản
      // thật của trình duyệt TREO vô hạn trong headless — đã tự xác nhận riêng). `delete` sẽ lộ
      // lại bản thật đó (che khuất, không tắt hẳn) → phải gán hẳn `undefined` để code app rơi
      // đúng nhánh fallback `<a download>`.
      navigator.share = undefined
      return new Promise((resolve) => {
        const origCreateElement = document.createElement.bind(document)
        document.createElement = (tag) => {
          const el = origCreateElement(tag)
          if (tag === 'a') {
            el.click = () => {
              resolve({ href: el.href, download: el.download })
              // không thực sự click để tránh puppeteer coi là navigation trong sandbox headless
            }
          }
          return el
        }
        document.querySelector('[aria-label="Tải phim về máy"]').click()
        setTimeout(() => resolve({ timeout: true }), 3000)
      })
    })
    const isBlobVideo = dl.href?.startsWith('blob:') && dl.download?.toLowerCase().endsWith('.mp4')
    report('D4b-download-fallback-uses-blob-mp4-not-html', !dl.timeout && isBlobVideo, JSON.stringify(dl))

    const urlUnchanged = page.url() === URL + '/' || page.url() === URL
    report('D5-download-does-not-navigate-away', urlUnchanged, page.url())

    await page.screenshot({ path: path.join(SHOT_DIR, 'H-success-play-download.png') })
    await page.close()
  }
} catch (e) {
  overallPass = false
  console.log('SCRIPT ERROR:', e.message, e.stack)
} finally {
  await browser.close()
}

console.log(overallPass
  ? '\n✅ MOBILE QA T-BS64/66 PASS — camera sau, xoá frame/phim không cần hover, Welcome vừa màn, Success play+download đúng'
  : '\n❌ MOBILE QA T-BS64/66 FAIL — xem chi tiết ở trên')
process.exit(overallPass ? 0 : 1)
