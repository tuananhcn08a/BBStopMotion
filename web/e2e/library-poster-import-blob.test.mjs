/**
 * e2e/library-poster-import-blob.test.mjs — T-XW17 gate thật (Chrome thật, camera giả).
 *
 * Kịch bản:
 *  A. Import ảnh: chụp 2 frame thật, rồi import 2 ảnh fixture (PNG tự sinh, kích thước/màu khác
 *     nhau, KHÔNG 16:9) qua `<input type=file>` ẩn → filmstrip tăng đúng 4 frame, seq liên tục;
 *     2 frame vừa import đọc lại từ IndexedDB đúng 1280×720 JPEG (CÙNG pipeline normalize frame chụp).
 *  B. Poster + blob persist: chụp đủ frame tối thiểu → Xuất phim → Thư viện có entry với
 *     `posterDataUrl` THẬT (trích từ MP4, async sau export) + blob MP4 đã persist IndexedDB
 *     (store `videoBlobs`, bytes > 0) → RELOAD TRANG THẬT → blob vẫn còn nguyên trên đĩa → bấm
 *     "▶ Xem" vẫn mở được (blob: URL, không phải rơi về thông báo "hết hạn").
 *
 * Exit 0 khi PASS toàn bộ, Exit 1 khi có FAIL.
 * Chạy: node e2e/library-poster-import-blob.test.mjs   (nhớ `npm run dev` cổng 5173 trước)
 */

import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import os from 'os'
import zlib from 'zlib'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.env.E2E_URL || 'http://localhost:5173'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SHOT_DIR = path.join(__dirname, 'screenshots')
fs.mkdirSync(SHOT_DIR, { recursive: true })

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

let overallPass = true
function report(name, pass, detail = '') {
  if (!pass) overallPass = false
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`)
  return pass
}

// ---------- PNG fixture tự sinh (không commit binary, không phụ thuộc canvas Node) ----------
function crc32(buf) {
  let c
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
      t[n] = c >>> 0
    }
    return t
  })())
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

/** PNG RGB solid-color tối giản, KHÔNG 16:9 (để verify crop-fill import THẬT chạy, không phải no-op). */
function makeSolidPng(width, height, [r, g, b]) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8 // bit depth
  ihdrData[9] = 2 // color type RGB
  ihdrData[10] = 0
  ihdrData[11] = 0
  ihdrData[12] = 0
  const ihdr = chunk('IHDR', ihdrData)

  const rowLen = 1 + width * 3
  const raw = Buffer.alloc(rowLen * height)
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowLen
    raw[rowStart] = 0 // filter: none
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 3
      raw[px] = r; raw[px + 1] = g; raw[px + 2] = b
    }
  }
  const idat = chunk('IDAT', zlib.deflateSync(raw))
  const iend = chunk('IEND', Buffer.alloc(0))
  return Buffer.concat([sig, ihdr, idat, iend])
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

async function readProjectFramesFromIndexedDb(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('bbstopmotion-library')
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction('frames', 'readonly')
      const getAllReq = tx.objectStore('frames').getAll()
      getAllReq.onsuccess = async () => {
        const records = getAllReq.result.sort((a, b) => a.seq - b.seq)
        const decoded = []
        for (const r of records) {
          const bytes = new Uint8Array(r.bytes)
          const magicOk = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
          try {
            const blob = new Blob([r.bytes], { type: 'image/jpeg' })
            const bitmap = await createImageBitmap(blob)
            decoded.push({ seq: r.seq, magicOk, width: bitmap.width, height: bitmap.height })
          } catch (e) {
            decoded.push({ seq: r.seq, magicOk, error: e.message })
          }
        }
        resolve(decoded)
      }
      getAllReq.onerror = () => reject(getAllReq.error)
    }
    req.onerror = () => reject(req.error)
  }))
}

async function readLibraryEntries(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('bbstopmotion-library')
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction('entries', 'readonly')
      const getAllReq = tx.objectStore('entries').getAll()
      getAllReq.onsuccess = () => resolve(getAllReq.result.sort((a, b) => b.createdAt - a.createdAt))
      getAllReq.onerror = () => reject(getAllReq.error)
    }
    req.onerror = () => reject(req.error)
  }))
}

async function readVideoBlobRecord(page, id) {
  return page.evaluate((entryId) => new Promise((resolve, reject) => {
    const req = indexedDB.open('bbstopmotion-library')
    req.onsuccess = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('videoBlobs')) { resolve(null); return }
      const tx = db.transaction('videoBlobs', 'readonly')
      const getReq = tx.objectStore('videoBlobs').get(entryId)
      getReq.onsuccess = () => {
        const record = getReq.result
        resolve(record ? { id: record.id, mimeType: record.mimeType, byteLength: record.bytes.byteLength } : null)
      }
      getReq.onerror = () => reject(getReq.error)
    }
    req.onerror = () => reject(req.error)
  }), id)
}

let exitCode = 1
let tmpDir

try {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bbsm-import-fixtures-'))
  const pngA = path.join(tmpDir, 'photo-red-4x3.png')
  const pngB = path.join(tmpDir, 'photo-blue-tall.png')
  fs.writeFileSync(pngA, makeSolidPng(640, 480, [220, 40, 40])) // 4:3, đỏ — không 16:9
  fs.writeFileSync(pngB, makeSolidPng(400, 900, [40, 60, 220])) // dọc, xanh — không 16:9
  report('fixtures-generated', fs.existsSync(pngA) && fs.existsSync(pngB))

  const page = await browser.newPage()
  await page.setViewport({ width: 1100, height: 900 })

  const logs = []
  page.on('console', m => logs.push(`[console.${m.type()}] ${m.text()}`))
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))

  console.log('-> goto', URL)
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
  await dismissWelcome(page)
  await createProjectFromHub(page)
  const camReady = await waitCameraReady(page)
  report('0-camera-ready', camReady)

  // ===== A. Chụp 2 frame thật, rồi import 2 ảnh fixture =====
  for (let i = 0; i < 2; i++) {
    await page.click('[aria-label="Chụp frame — phím Space"]').catch(() => {})
    await sleep(350)
  }
  const countAfterCapture = await readFrameCount(page)
  report('A1-captured-2-frames-before-import', countAfterCapture === 2, `count=${countAfterCapture}`)

  const importInput = await page.$('[data-testid="import-file-input"]')
  report('A2-import-input-found', !!importInput)
  await importInput.uploadFile(pngA, pngB)
  // `uploadFile` không luôn tự bắn 'change' ở mọi phiên bản Chrome/puppeteer — bắn tay để chắc chắn.
  await page.evaluate(() => {
    const input = document.querySelector('[data-testid="import-file-input"]')
    input?.dispatchEvent(new Event('change', { bubbles: true }))
  })

  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-landmark="frame-counter"]')
      const m = el?.textContent?.match(/^(\d+)/)
      return m && parseInt(m[1], 10) === 4
    },
    { timeout: 10000 },
  ).catch(() => {})
  const countAfterImport = await readFrameCount(page)
  report('A3-import-adds-2-frames', countAfterImport === 4, `count=${countAfterImport}`)
  await page.screenshot({ path: path.join(SHOT_DIR, 'library-A-desktop-import-slot.png') })

  const decodedFrames = await readProjectFramesFromIndexedDb(page)
  const importedFrames = decodedFrames.filter(f => f.seq === 2 || f.seq === 3)
  const importedNormalizedOk = importedFrames.length === 2
    && importedFrames.every(f => f.magicOk && f.width === 1280 && f.height === 720)
  report(
    'A4-imported-frames-normalized-1280x720-jpeg-same-pipeline-as-camera',
    importedNormalizedOk,
    JSON.stringify(decodedFrames),
  )
  const seqContiguous = decodedFrames.map(f => f.seq).every((seq, i) => seq === i)
  report('A5-seq-contiguous-after-import', seqContiguous, JSON.stringify(decodedFrames.map(f => f.seq)))

  // ===== B. Chụp đủ tối thiểu (5) → Xuất phim → poster + blob persist =====
  for (let i = 0; i < 1; i++) {
    await page.click('[aria-label="Chụp frame — phím Space"]').catch(() => {})
    await sleep(350)
  }
  const preExportCount = await readFrameCount(page)
  report('B0-frames-before-export', preExportCount === 5, `count=${preExportCount}`)

  await page.click('[data-landmark="export-btn"]').catch(() => {})
  await page.waitForSelector('[aria-label="Tải phim về máy"]', { timeout: 20000 }).catch(() => {})
  await sleep(500)

  const entriesAfterExport = await readLibraryEntries(page)
  report('B1-library-entry-created', entriesAfterExport.length === 1, JSON.stringify(entriesAfterExport.map(e => e.id)))
  const entryId = entriesAfterExport[0]?.id

  // Poster sinh ASYNC sau export — poll vài giây.
  let posterDataUrl = entriesAfterExport[0]?.posterDataUrl ?? null
  for (let i = 0; i < 10 && !posterDataUrl; i++) {
    await sleep(500)
    const entries = await readLibraryEntries(page)
    posterDataUrl = entries.find(e => e.id === entryId)?.posterDataUrl ?? null
  }
  report(
    'B2-poster-generated-from-mp4',
    typeof posterDataUrl === 'string' && posterDataUrl.startsWith('data:image/jpeg'),
    posterDataUrl ? `len=${posterDataUrl.length}` : 'null',
  )

  const blobBeforeReload = await readVideoBlobRecord(page, entryId)
  report(
    'B3-video-blob-persisted-before-reload',
    !!blobBeforeReload && blobBeforeReload.byteLength > 0,
    JSON.stringify(blobBeforeReload),
  )

  // ===== RELOAD TRANG THẬT — chứng minh blob KHÔNG mất (khác blobCacheRef RAM-only cũ) =====
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 })
  await sleep(500)

  const blobAfterReload = await readVideoBlobRecord(page, entryId)
  report(
    'B4-video-blob-still-present-after-reload',
    !!blobAfterReload && blobAfterReload.byteLength === blobBeforeReload?.byteLength,
    JSON.stringify({ before: blobBeforeReload, after: blobAfterReload }),
  )

  const entriesAfterReload = await readLibraryEntries(page)
  const posterAfterReload = entriesAfterReload.find(e => e.id === entryId)?.posterDataUrl
  report('B5-poster-also-persisted-after-reload', posterAfterReload === posterDataUrl)

  // Vào Thư viện, bấm "▶ Xem" → phải mở được blob: URL thật (đọc lại từ IndexedDB), không rơi về
  // thông báo "hết hạn" (library.blobExpired).
  await page.click('[data-landmark="nav-library"]').catch(() => {})
  await sleep(400)
  await page.screenshot({ path: path.join(SHOT_DIR, 'library-B-desktop-poster-after-reload.png') })

  const openedUrlType = await page.evaluate((id) => new Promise((resolve) => {
    const original = window.open
    window.open = (url) => { window.__lastOpenedUrl = url; return null }
    const btn = document.querySelector(`[data-testid="play-${id}"]`)
    btn?.click()
    setTimeout(() => {
      window.open = original
      resolve(window.__lastOpenedUrl ?? null)
    }, 300)
  }), entryId)
  report(
    'B6-play-after-reload-opens-blob-url-not-expired-notice',
    typeof openedUrlType === 'string' && openedUrlType.startsWith('blob:'),
    String(openedUrlType),
  )
  const noExpiredNotice = await page.evaluate(() => !document.querySelector('[data-testid="app-library-notice"]'))
  report('B7-no-blob-expired-notice-after-reload', noExpiredNotice)

  await page.close()

  // ===== C. Mobile 390×844 — screenshot Thư viện (poster) + slot import filmstrip =====
  {
    const mPage = await browser.newPage()
    await mPage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
    await mPage.evaluateOnNewDocument(() => localStorage.clear())
    await mPage.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await dismissWelcome(mPage)
    await createProjectFromHub(mPage)
    await waitCameraReady(mPage, 10000)
    for (let i = 0; i < 2; i++) {
      await mPage.click('[data-landmark="capture-btn"]').catch(() => {})
      await sleep(350)
    }
    await mPage.evaluate(() => document.querySelector('[data-testid="filmstrip"]')?.scrollIntoView({ block: 'center' }))
    const mobileImportSlotVisible = await mPage.evaluate(() => !!document.querySelector('[data-testid="import-slot-btn"]'))
    report('C1-mobile-import-slot-visible', mobileImportSlotVisible)
    await mPage.screenshot({ path: path.join(SHOT_DIR, 'mobile', 'library-C1-mobile-import-slot.png') })

    await mPage.goto(`${URL}/?gate=library`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await sleep(400)
    const mobileLibraryVisible = await mPage.evaluate(() => !!document.querySelector('[data-landmark="library-screen"]'))
    report('C2-mobile-library-reachable', mobileLibraryVisible)
    await mPage.screenshot({ path: path.join(SHOT_DIR, 'mobile', 'library-C2-mobile-poster.png') })

    await mPage.close()
  }

  if (!overallPass) {
    console.log('\n===== CONSOLE / ERRORS =====')
    console.log(logs.slice(-40).join('\n') || '(không có)')
  }

  exitCode = overallPass ? 0 : 1
} catch (e) {
  console.log('SCRIPT ERROR:', e.message)
  console.log(e.stack)
  exitCode = 1
} finally {
  await browser.close()
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
  console.log(overallPass
    ? '\n✅ LIBRARY POSTER + IMPORT + BLOB PERSIST PASS'
    : '\n❌ LIBRARY POSTER + IMPORT + BLOB PERSIST FAIL — xem chi tiết ở trên')
  process.exit(exitCode)
}
