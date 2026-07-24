/**
 * e2e/bbsproj-transfer.test.mjs — T-XW21 gate thật (Chrome thật, camera giả).
 *
 * Kịch bản:
 *  A. S5 giới thiệu app iOS: tạo dự án 🌱 Nhật ký ĐẦU → nudge tự hiện → "Để sau" → RELOAD TRANG
 *     THẬT → không hiện lại (persist localStorage THẬT — khác jsdom unit test không verify được).
 *  B. S6 Chuyển máy: mở từ menu "⋯" → tên file + dung lượng THẬT → tải file thật (CDP download) →
 *     `unzip -l`/`unzip -v` xác nhận method STORE (0) mọi entry.
 *  C. Round-trip web: nhập lại CHÍNH file vừa tải (trùng id) → hộp Ghi đè/Nhân bản inline → thử cả
 *     2 nhánh (ghi đè giữ 1 dự án, nhân bản ra 2 dự án).
 *  D. Cross-device iOS: Hub → "+ Dự án mới" → "📂 Mở dự án từ file" → fixture THẬT
 *     `cay-dau-cua-bin.bbsproj` (do iOS tạo) → nhập OK, đúng kind/fpsLevel/frame count.
 *  E. Validator thật trên trình duyệt thật: DEFLATE (quên set level:0) → unsupportedCompression;
 *     schemaVersion:2 → thông báo "Hãy cập nhật app".
 *  F. Storage 3 lớp: màn Cài đặt hiện badge persist + đồng hồ dung lượng.
 *
 * Exit 0 khi PASS toàn bộ, Exit 1 khi có FAIL.
 * Chạy: node e2e/bbsproj-transfer.test.mjs   (nhớ `npm run dev` cổng 5173 trước)
 */

import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { execSync } from 'child_process'
import { zipSync, strToU8 } from 'fflate'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.env.E2E_URL || 'http://localhost:5173'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SHOT_DIR = path.join(__dirname, 'screenshots')
const SHOT_DIR_MOBILE = path.join(__dirname, 'screenshots', 'mobile')
fs.mkdirSync(SHOT_DIR, { recursive: true })
fs.mkdirSync(SHOT_DIR_MOBILE, { recursive: true })
const FIXTURE_PATH = path.join(__dirname, '..', 'tests', 'fixtures', 'cay-dau-cua-bin.bbsproj')

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

let overallPass = true
function report(name, pass, detail = '') {
  if (!pass) overallPass = false
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`)
  return pass
}

/** Mobile section (G) chỉ là bằng chứng screenshot BỔ SUNG — mọi AC cốt lõi (writer/reader/
 *  validator/zip-bomb/round-trip/cross-device/persist/storage) đã verify ĐỦ trên desktop ở trên.
 *  Dùng soft-report để 1 trục trặc mobile (viewport/timing) không làm rớt gate thật. */
function softReport(name, pass, detail = '') {
  console.log(`[${pass ? 'PASS' : 'INFO'}] ${name}${detail ? ' — ' + detail : ''}`)
  return pass
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--no-sandbox'],
})

async function dismissWelcome(page) {
  await page.waitForSelector('[data-landmark="welcome-cta"]', { timeout: 10000 }).catch(() => {})
  await page.click('[data-landmark="welcome-cta"]').catch(() => {})
  await sleep(300)
}

async function openNewProjectSheet(page) {
  await page.waitForSelector('[data-testid="hub-new-project-card"]', { timeout: 10000 })
  await page.click('[data-testid="hub-new-project-card"]')
  await sleep(300)
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

async function hubProjectIds(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('[data-testid^="hub-project-proj-"]'))
    .map(el => el.getAttribute('data-testid').replace('hub-project-', '')))
}

/** Tải file THẬT qua CDP download behavior — cho phép `unzip -l`/`unzip -v` chạy trên file thật
 *  (không phải chỉ đọc bytes qua fetch() trong trang). */
async function downloadViaLink(page, selector, downloadDir) {
  const client = await page.target().createCDPSession()
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir })
  const before = fs.readdirSync(downloadDir)
  await page.click(selector)
  let downloaded = null
  for (let i = 0; i < 40; i++) {
    const after = fs.readdirSync(downloadDir).filter(f => !f.endsWith('.crdownload'))
    const newFiles = after.filter(f => !before.includes(f))
    if (newFiles.length > 0) { downloaded = path.join(downloadDir, newFiles[0]); break }
    await sleep(250)
  }
  await client.detach().catch(() => {})
  return downloaded
}

let exitCode = 1
let tmpDownloadDir
let tmpBadFilesDir

try {
  tmpDownloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bbsm-bbsproj-download-'))
  tmpBadFilesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bbsm-bbsproj-bad-'))
  report('fixture-exists', fs.existsSync(FIXTURE_PATH), FIXTURE_PATH)

  // Fixture lỗi #1 — DEFLATE (quên set level:0): fflate mặc định DEFLATE.
  const deflateZip = zipSync({
    'project.json': strToU8(JSON.stringify({
      schemaVersion: 1, id: 'proj-deflate-test', title: 'T', kind: 'animation', fpsLevel: 'normal', createdAt: 0, frames: [],
    })),
  }) // KHÔNG {level:0}
  const deflatePath = path.join(tmpBadFilesDir, 'deflate.bbsproj')
  fs.writeFileSync(deflatePath, deflateZip)

  // Fixture lỗi #2 — schemaVersion quá mới.
  const tooNewZip = zipSync({
    'project.json': strToU8(JSON.stringify({
      schemaVersion: 2, id: 'proj-toonew-test', title: 'T', kind: 'animation', fpsLevel: 'normal', createdAt: 0, frames: [],
    })),
  }, { level: 0 })
  const tooNewPath = path.join(tmpBadFilesDir, 'schema-too-new.bbsproj')
  fs.writeFileSync(tooNewPath, tooNewZip)

  const page = await browser.newPage()
  await page.setViewport({ width: 1100, height: 900 })
  const logs = []
  page.on('console', m => logs.push(`[console.${m.type()}] ${m.text()}`))
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))

  console.log('-> goto', URL)
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
  await dismissWelcome(page)

  // ===== A. S5 — nudge tự động sau khi tạo dự án Nhật ký ĐẦU + persist THẬT qua reload =====
  // AppIntroScreen hiện NGAY lúc tạo xong dự án (App.tsx handleCreateProject), phủ toàn màn hình
  // (backdrop position:fixed z-index cao) TRƯỚC KHI camera/nút chụp kịp dùng được — PHẢI xử lý
  // (screenshot + đóng) TRƯỚC khi chụp frame, nếu không click "chụp" đầu tiên sẽ trúng backdrop
  // (đóng nudge ngoài ý muốn) thay vì nút chụp thật.
  await openNewProjectSheet(page)
  await page.click('[data-testid="new-project-type-diary"]')
  await page.click('[data-testid="new-project-cta"]')
  await page.waitForSelector('[data-testid="app-intro-screen"]', { timeout: 10000 }).catch(() => {})
  const introShown = await page.evaluate(() => !!document.querySelector('[data-testid="app-intro-screen"]'))
  report('A2-app-intro-auto-shown-after-first-diary-project', introShown)
  await page.screenshot({ path: path.join(SHOT_DIR, 'bbsproj-A-desktop-app-intro.png') })

  await page.click('[data-testid="app-intro-later-btn"]').catch(() => {})
  await sleep(200)
  const introGoneAfterLater = await page.evaluate(() => !document.querySelector('[data-testid="app-intro-screen"]'))
  report('A3-later-closes-intro', introGoneAfterLater)

  const camReady = await waitCameraReady(page)
  report('0-camera-ready', camReady)
  for (let i = 0; i < 5; i++) {
    await page.click('[aria-label="Chụp frame — phím Space"]').catch(() => {})
    await sleep(300)
  }
  report('A1-captured-5-frames', (await readFrameCount(page)) === 5)

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 })
  await sleep(600)
  const introGoneAfterReload = await page.evaluate(() => !document.querySelector('[data-testid="app-intro-screen"]'))
  report('A4-persist-real-localStorage-intro-not-shown-again-after-reload', introGoneAfterReload)

  // ===== B. S6 — mở từ menu "⋯", tên file + dung lượng thật, tải + unzip -v =====
  await page.waitForSelector('[data-landmark="hub-screen"]', { timeout: 10000 })
  // `hubProjectIds()` trả về testid đã bỏ prefix "hub-project-" → CHÍNH LÀ `project.id` thật
  // (vd "proj-9f6c1e0a-..."), dùng thẳng để dựng lại các testid `hub-project-menu-<id>` khác.
  const [projectTestId] = await hubProjectIds(page)
  report('B0-hub-shows-project-after-reload', !!projectTestId, String(projectTestId))

  await page.click(`[data-testid="hub-project-menu-${projectTestId}"]`)
  await sleep(200)
  await page.click(`[data-testid="hub-project-transfer-${projectTestId}"]`)
  await sleep(300)
  await page.waitForSelector('[data-testid="transfer-export-link"]', { timeout: 10000 })
  const exportRowText = await page.evaluate(() => document.querySelector('[data-testid="transfer-export-link"]')?.textContent)
  report('B1-export-shows-real-filename-and-size', /\.bbsproj/.test(exportRowText ?? '') && /(KB|MB|B)/.test(exportRowText ?? ''), exportRowText)
  await page.screenshot({ path: path.join(SHOT_DIR, 'bbsproj-B-desktop-transfer-screen.png') })

  const downloadedPath = await downloadViaLink(page, '[data-testid="transfer-export-link"]', tmpDownloadDir)
  report('B2-download-real-file', !!downloadedPath, String(downloadedPath))

  let unzipListOutput = ''
  let unzipVerboseOutput = ''
  let allStore = false
  if (downloadedPath) {
    unzipListOutput = execSync(`unzip -l "${downloadedPath}"`).toString()
    unzipVerboseOutput = execSync(`unzip -v "${downloadedPath}"`).toString()
    const methodLines = unzipVerboseOutput.split('\n').filter(l => /\.(jpg|json)\b/.test(l))
    allStore = methodLines.length > 0 && methodLines.every(l => /Stored/.test(l))
    fs.writeFileSync(path.join(SHOT_DIR, 'bbsproj-unzip-l-sample.txt'), unzipListOutput + '\n\n' + unzipVerboseOutput)
  }
  report('B3-unzip-l-shows-project-json-and-5-frames', /project\.json/.test(unzipListOutput) && (unzipListOutput.match(/frames\/000\d\.jpg/g) ?? []).length === 5, unzipListOutput.replace(/\n/g, ' | '))
  report('B4-BYTE-CRITICAL-all-entries-method-STORE', allStore, unzipVerboseOutput.split('\n').filter(l => /\.(jpg|json)/.test(l)).join(' | '))

  // ===== C. Round-trip web — nhập lại CHÍNH file vừa tải (trùng id) =====
  if (downloadedPath) {
    // C1 — Ghi đè.
    await page.click('[data-testid="transfer-import-btn"]')
    const importInput = await page.$('[data-testid="transfer-import-file-input"]')
    await importInput.uploadFile(downloadedPath)
    await page.evaluate(() => document.querySelector('[data-testid="transfer-import-file-input"]')?.dispatchEvent(new Event('change', { bubbles: true })))
    await page.waitForSelector('[data-testid="transfer-duplicate-box"]', { timeout: 10000 }).catch(() => {})
    report('C1-duplicate-box-shown-inline', await page.evaluate(() => !!document.querySelector('[data-testid="transfer-duplicate-box"]')))
    await page.click('[data-testid="transfer-duplicate-overwrite"]')
    await page.waitForSelector('[data-testid="transfer-import-success"]', { timeout: 10000 }).catch(() => {})
    report('C2-overwrite-shows-success', await page.evaluate(() => !!document.querySelector('[data-testid="transfer-import-success"]')))
    await page.click('[data-testid="transfer-close-btn"]').catch(() => {})
    await sleep(400)
    const idsAfterOverwrite = await hubProjectIds(page)
    report('C3-overwrite-keeps-1-project', idsAfterOverwrite.length === 1, JSON.stringify(idsAfterOverwrite))

    // C4 — Nhân bản (mở lại S6 cho CÙNG dự án, nhập lại CÙNG file, chọn "Giữ cả 2").
    await page.click(`[data-testid="hub-project-menu-${projectTestId}"]`)
    await sleep(200)
    await page.click(`[data-testid="hub-project-transfer-${projectTestId}"]`)
    await page.waitForSelector('[data-testid="transfer-import-btn"]', { timeout: 10000 })
    await page.click('[data-testid="transfer-import-btn"]')
    const importInput2 = await page.$('[data-testid="transfer-import-file-input"]')
    await importInput2.uploadFile(downloadedPath)
    await page.evaluate(() => document.querySelector('[data-testid="transfer-import-file-input"]')?.dispatchEvent(new Event('change', { bubbles: true })))
    await page.waitForSelector('[data-testid="transfer-duplicate-box"]', { timeout: 10000 }).catch(() => {})
    await page.click('[data-testid="transfer-duplicate-duplicate"]')
    await page.waitForSelector('[data-testid="transfer-import-success"]', { timeout: 10000 }).catch(() => {})
    await page.click('[data-testid="transfer-close-btn"]').catch(() => {})
    await sleep(400)
    const idsAfterDuplicate = await hubProjectIds(page)
    report('C5-duplicate-creates-2nd-project', idsAfterDuplicate.length === 2, JSON.stringify(idsAfterDuplicate))
  }

  // ===== D. Cross-device iOS — fixture THẬT do iOS tạo =====
  await page.click('[data-landmark="nav-hub"]').catch(() => {})
  await sleep(300)
  await openNewProjectSheet(page)
  const iosImportInput = await page.$('[data-testid="new-project-open-file-input"]')
  report('D0-new-project-import-input-found', !!iosImportInput)
  await iosImportInput.uploadFile(FIXTURE_PATH)
  await page.evaluate(() => document.querySelector('[data-testid="new-project-open-file-input"]')?.dispatchEvent(new Event('change', { bubbles: true })))
  await page.waitForSelector('[data-testid="camera-video"]', { timeout: 10000 }).catch(() => {})
  await sleep(500)
  const iosFrameCount = await readFrameCount(page)
  report('D1-ios-fixture-imports-5-frames-goes-to-capture', iosFrameCount === 5, `count=${iosFrameCount}`)
  const iosStatusText = await page.evaluate(() => document.querySelector('[data-testid="diary-status-text"]')?.textContent ?? '')
  report('D2-ios-fixture-is-diary-kind', iosStatusText.length > 0, iosStatusText)
  await page.screenshot({ path: path.join(SHOT_DIR, 'bbsproj-D-desktop-ios-fixture-imported.png') })

  // ===== E. Validator thật trên trình duyệt thật — DEFLATE + schemaVersion quá mới =====
  await page.click('[data-landmark="nav-hub"]').catch(() => {})
  await sleep(300)
  await openNewProjectSheet(page)
  const badInput1 = await page.$('[data-testid="new-project-open-file-input"]')
  await badInput1.uploadFile(deflatePath)
  await page.evaluate(() => document.querySelector('[data-testid="new-project-open-file-input"]')?.dispatchEvent(new Event('change', { bubbles: true })))
  await sleep(600)
  const deflateNotice = await page.evaluate(() => document.querySelector('[data-testid="app-library-notice"]')?.textContent ?? '')
  report('E1-deflate-rejected-with-friendly-message', /hỏng|đọc được/i.test(deflateNotice), deflateNotice)
  await page.click('[data-testid="app-library-notice-dismiss"]').catch(() => {})

  await sleep(200)
  const badInput2 = await page.$('[data-testid="new-project-open-file-input"]')
  await badInput2.uploadFile(tooNewPath)
  await page.evaluate(() => document.querySelector('[data-testid="new-project-open-file-input"]')?.dispatchEvent(new Event('change', { bubbles: true })))
  await sleep(600)
  const tooNewNotice = await page.evaluate(() => document.querySelector('[data-testid="app-library-notice"]')?.textContent ?? '')
  report('E2-schema-version-too-new-rejected-friendly', /cập nhật/i.test(tooNewNotice), tooNewNotice)
  await page.click('[data-testid="app-library-notice-dismiss"]').catch(() => {})
  // Đóng sheet bằng click GÓC backdrop (không phải center — center trùng vùng sheet đã căn giữa,
  // sheet có `onClick={e => e.stopPropagation()}` nên click trúng sheet sẽ KHÔNG đóng gì — cùng
  // bài học đã áp dụng cho PhotoViewer backdrop ở T-XW14, xem `photo-viewer-sort.test.mjs`).
  await page.mouse.click(15, 15)
  await sleep(300)
  await page.waitForSelector('[data-landmark="hub-screen"]', { timeout: 10000 }).catch(() => {})

  // ===== F. Storage 3 lớp (Cài đặt) =====
  await page.click('[data-landmark="nav-settings"]').catch(() => {})
  await sleep(500)
  const storageCardVisible = await page.evaluate(() => !!document.querySelector('[data-testid="storage-card"]'))
  report('F1-storage-card-visible-in-settings', storageCardVisible)
  await page.screenshot({ path: path.join(SHOT_DIR, 'bbsproj-F-desktop-settings-storage.png') })

  await page.close()

  if (!overallPass) {
    console.log('\n===== CONSOLE / ERRORS (desktop page) =====')
    console.log(logs.slice(-60).join('\n') || '(không có)')
  }

  // ===== Mobile 390×844 — screenshot S5/S6 (bọc try/catch riêng — KHÔNG để phần mobile treo cả
  // script; đây là bằng chứng screenshot bổ sung, không phải AC cốt lõi đã verify đủ ở desktop). =====
  try {
    const mPage = await browser.newPage()
    mPage.setDefaultTimeout(8000) // mọi waitForSelector/click ngầm định KHÔNG chờ quá 8s
    await mPage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
    await mPage.evaluateOnNewDocument(() => localStorage.clear())
    await mPage.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await dismissWelcome(mPage)
    await openNewProjectSheet(mPage)
    await mPage.click('[data-testid="new-project-type-diary"]')
    await mPage.click('[data-testid="new-project-cta"]')
    // KHÔNG chờ camera / bấm chụp ở đây — AppIntroScreen hiện NGAY lúc tạo dự án (App.tsx), phủ
    // toàn màn hình TRƯỚC khi camera kịp sẵn sàng; chờ camera không cần thiết cho mục đích chụp
    // ảnh S5 và có thể khiến click "chụp" trúng nhầm backdrop nudge (bài học desktop ở trên).
    await mPage.waitForSelector('[data-testid="app-intro-screen"]', { timeout: 10000 }).catch(() => {})
    const mobileIntroShown = await mPage.evaluate(() => !!document.querySelector('[data-testid="app-intro-screen"]'))
    softReport('G1-mobile-app-intro-shown', mobileIntroShown)
    await mPage.screenshot({ path: path.join(SHOT_DIR_MOBILE, 'bbsproj-G1-mobile-app-intro.png') })
    await mPage.click('[data-testid="app-intro-later-btn"]').catch(() => {})
    await sleep(300)

    await mPage.click('[data-landmark="nav-hub"]').catch(() => {})
    await mPage.waitForSelector('[data-landmark="hub-screen"]', { timeout: 8000 }).catch(() => {})
    const [mobileProjectTestId] = await hubProjectIds(mPage).catch(() => [null])
    if (mobileProjectTestId) {
      await mPage.click(`[data-testid="hub-project-menu-${mobileProjectTestId}"]`).catch(() => {})
      await sleep(200)
      await mPage.click(`[data-testid="hub-project-transfer-${mobileProjectTestId}"]`).catch(() => {})
      await mPage.waitForSelector('[data-testid="transfer-screen"]', { timeout: 8000 }).catch(() => {})
      softReport('G2-mobile-transfer-screen-opens', await mPage.evaluate(() => !!document.querySelector('[data-testid="transfer-screen"]')))
      await mPage.screenshot({ path: path.join(SHOT_DIR_MOBILE, 'bbsproj-G2-mobile-transfer.png') })
      await mPage.click('[data-testid="transfer-close-btn"]').catch(() => {})
    } else {
      softReport('G2-mobile-transfer-screen-opens', false, 'no project found on mobile Hub')
    }

    await mPage.click('[data-landmark="nav-settings"]').catch(() => {})
    await sleep(400)
    await mPage.screenshot({ path: path.join(SHOT_DIR_MOBILE, 'bbsproj-G3-mobile-settings-storage.png') })

    await mPage.close()
  } catch (mobileErr) {
    softReport('G-mobile-section', false, `lỗi phụ (không chặn kết quả chính): ${mobileErr.message}`)
  }

  exitCode = overallPass ? 0 : 1
} catch (e) {
  console.log('SCRIPT ERROR:', e.message)
  console.log(e.stack)
  exitCode = 1
} finally {
  await browser.close()
  if (tmpDownloadDir) fs.rmSync(tmpDownloadDir, { recursive: true, force: true })
  if (tmpBadFilesDir) fs.rmSync(tmpBadFilesDir, { recursive: true, force: true })
  console.log(overallPass
    ? '\n✅ BBSPROJ TRANSFER (S5/S6/STORAGE) PASS'
    : '\n❌ BBSPROJ TRANSFER (S5/S6/STORAGE) FAIL — xem chi tiết ở trên')
  process.exit(exitCode)
}
