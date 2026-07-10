#!/usr/bin/env node
/**
 * verify/measure.mjs — đo hình học từng phần tử (DOM) cho trang WEB thật (mockup lẫn app).
 *
 * Quy ước landmark: phần tử cần đo mang thuộc tính `data-landmark="ten-landmark"`.
 * Mockup (T-BS02) và app implement (T-BS10) phải dùng CHUNG bộ tên landmark để so khớp.
 * Có thể override bằng --selectors <file.json> dạng { "ten-landmark": "css selector" }
 * cho trường hợp không gắn được data-landmark (vd đo nguyên khối #app).
 *
 * Dùng puppeteer-core mở trang bằng Chrome THẬT, đọc getBoundingClientRect() +
 * getComputedStyle() ngay trong DOM đang chạy — không suy đoán, không ảnh tĩnh.
 *
 * CLI:
 *   node measure.mjs --url <file://...|http://...> [--selectors sel.json] \
 *        [--viewport 1280x820] [--wait-selector "<css>"] [--out measured.json]
 *
 * Module:
 *   import { measureDom } from './measure.mjs'
 *   const landmarks = await measureDom({ url, viewport })
 *   // => { "sidebar-nav": { x, y, w, h, bg, color, radius }, ... }
 */
import puppeteer from 'puppeteer-core'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveChromePath, FAKE_MEDIA_ARGS } from './lib/chrome.mjs'
import { parseArgs, parseViewport } from './lib/args.mjs'
import { toPageUrl } from './lib/url.mjs'

/** Chạy trong browser context — KHÔNG import gì ngoài, phải tự chứa. */
function collectLandmarks(selectorOverrides) {
  const result = {}

  function readOne(el) {
    const rect = el.getBoundingClientRect()
    const cs = window.getComputedStyle(el)
    return {
      x: round2(rect.x),
      y: round2(rect.y),
      w: round2(rect.width),
      h: round2(rect.height),
      bg: cs.backgroundColor,
      color: cs.color,
      radius: cs.borderRadius,
    }
  }
  function round2(n) {
    return Math.round(n * 100) / 100
  }

  document.querySelectorAll('[data-landmark]').forEach((el) => {
    const name = el.getAttribute('data-landmark')
    if (!name) return
    result[name] = readOne(el)
  })

  for (const [name, selector] of Object.entries(selectorOverrides || {})) {
    const el = document.querySelector(selector)
    if (el) result[name] = readOne(el)
  }

  return result
}

export async function measureDom({
  url,
  viewport = { width: 1280, height: 820 },
  waitSelector = null,
  waitMs = 250,
  selectors = {},
}) {
  if (!url) throw new Error('measureDom(): thiếu url')

  const executablePath = resolveChromePath()
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [...FAKE_MEDIA_ARGS, `--window-size=${viewport.width},${viewport.height}`],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport(viewport)
    await page.goto(toPageUrl(url), { waitUntil: 'networkidle0', timeout: 30000 })
    await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {})
    if (waitSelector) await page.waitForSelector(waitSelector, { timeout: 15000 })
    if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs))

    const landmarks = await page.evaluate(collectLandmarks, selectors)
    if (Object.keys(landmarks).length === 0) {
      console.warn(
        `[measure.mjs] CẢNH BÁO: không tìm thấy landmark nào trên ${url} ` +
          '(không có [data-landmark] và không khớp --selectors nào).'
      )
    }
    return landmarks
  } finally {
    await browser.close()
  }
}

function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
}

if (isMain()) {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || !args.url) {
    console.log(
      'Usage: node measure.mjs --url <file://...|http://...> [--selectors sel.json] ' +
        '[--viewport 1280x820] [--wait-selector "<css>"] [--out measured.json]'
    )
    process.exit(args.help ? 0 : 1)
  }
  const viewport = parseViewport(args.viewport)
  const selectors = args.selectors ? JSON.parse(fs.readFileSync(args.selectors, 'utf8')) : {}
  try {
    const landmarks = await measureDom({
      url: args.url,
      viewport,
      waitSelector: args['wait-selector'] || null,
      selectors,
    })
    const json = JSON.stringify(landmarks, null, 2)
    if (args.out) {
      fs.mkdirSync(path.dirname(args.out), { recursive: true })
      fs.writeFileSync(args.out, json)
      console.log(`Đã đo ${Object.keys(landmarks).length} landmark → ${args.out}`)
    } else {
      console.log(json)
    }
  } catch (err) {
    console.error(`[measure.mjs] LỖI: ${err.message}`)
    process.exit(1)
  }
}
