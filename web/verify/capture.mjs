#!/usr/bin/env node
/**
 * verify/capture.mjs — chụp 1 URL (mockup file:// hoặc app http://) bằng Chrome THẬT.
 *
 * Nguyên tắc bắt buộc (theo miwiz): đây LUÔN LÀ ảnh của bản đang chạy thật qua
 * Chrome engine thật — KHÔNG render server-side, KHÔNG ghép/composite ảnh giả.
 *
 * CLI:
 *   node capture.mjs --url <file://... | http://...> --out <path.png> \
 *        [--viewport 1280x820] [--wait-selector "<css>"] [--wait-ms 300] [--full-page]
 *
 * Module:
 *   import { capture } from './capture.mjs'
 *   const { path, width, height } = await capture({ url, out, viewport })
 */
import puppeteer from 'puppeteer-core'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveChromePath, FAKE_MEDIA_ARGS } from './lib/chrome.mjs'
import { parseArgs, parseViewport } from './lib/args.mjs'
import { toPageUrl } from './lib/url.mjs'

export async function capture({
  url,
  out,
  viewport = { width: 1280, height: 820 },
  waitSelector = null,
  waitMs = 250,
  fullPage = false,
  fonts = true,
}) {
  if (!url) throw new Error('capture(): thiếu url')
  if (!out) throw new Error('capture(): thiếu out (đường dẫn PNG)')

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

    if (fonts) {
      // Chờ web font load xong — tránh đo/chụp lúc còn fallback font (lệch chiều rộng chữ).
      await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {})
    }
    if (waitSelector) {
      await page.waitForSelector(waitSelector, { timeout: 15000 })
    }
    if (waitMs > 0) {
      await new Promise((r) => setTimeout(r, waitMs))
    }

    fs.mkdirSync(path.dirname(out), { recursive: true })
    await page.screenshot({ path: out, fullPage })

    return { path: out, width: viewport.width, height: viewport.height }
  } finally {
    await browser.close()
  }
}

function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
}

if (isMain()) {
  const args = parseArgs(process.argv.slice(2), ['full-page'])
  if (args.help || !args.url || !args.out) {
    console.log(
      'Usage: node capture.mjs --url <file://...|http://...> --out <path.png> ' +
        '[--viewport 1280x820] [--wait-selector "<css>"] [--wait-ms 300] [--full-page]'
    )
    process.exit(args.help ? 0 : 1)
  }
  const viewport = parseViewport(args.viewport)
  try {
    const result = await capture({
      url: args.url,
      out: args.out,
      viewport,
      waitSelector: args['wait-selector'] || null,
      waitMs: args['wait-ms'] !== undefined ? Number(args['wait-ms']) : 250,
      fullPage: !!args['full-page'],
    })
    console.log(`Đã chụp: ${result.path} (${result.width}x${result.height})`)
  } catch (err) {
    console.error(`[capture.mjs] LỖI: ${err.message}`)
    process.exit(1)
  }
}
