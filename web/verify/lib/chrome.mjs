/**
 * lib/chrome.mjs — resolve a real Chrome/Chromium executable for puppeteer-core.
 *
 * We use puppeteer-core (already a web/ devDependency, no bundled Chromium
 * download) and drive a REAL installed browser. This is deliberate: the
 * whole point of the Visual Diff Gate is "chụp bản chạy THẬT" — no headless
 * mock renderer, no composited/faked screenshot.
 */
import fs from 'fs'

const CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
]

export function resolveChromePath() {
  for (const candidate of CANDIDATES) {
    if (candidate && fs.existsSync(candidate)) return candidate
  }
  throw new Error(
    'Không tìm thấy Chrome/Chromium thật. Cài Google Chrome hoặc set PUPPETEER_EXECUTABLE_PATH.\n' +
      'Đã thử: ' +
      CANDIDATES.filter(Boolean).join(', ')
  )
}

/** Standard launch args: fake camera device so capture screens don't need a real webcam,
 *  but the RENDER itself is always the real browser engine — never mocked. */
export const FAKE_MEDIA_ARGS = [
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
  '--no-sandbox',
]
