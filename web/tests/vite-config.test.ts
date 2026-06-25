/**
 * T-W06: Guard test — vite.config.ts must exclude @ffmpeg packages from pre-bundling
 * and must NOT have COOP/COEP require-corp header.
 *
 * Rationale: @ffmpeg/ffmpeg resolves its worker URL internally via relative paths.
 * If Vite pre-bundles the package, the worker URL changes → cross-origin fetch fails
 * (ERR_BLOCKED_BY_RESPONSE). optimizeDeps.exclude prevents this.
 *
 * COOP/COEP (require-corp / same-origin) are removed because ffmpeg.wasm runs
 * in single-threaded mode (no SharedArrayBuffer needed) and COEP was blocking
 * the worker file load.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const configSource = fs.readFileSync(
  path.resolve(__dirname, '../vite.config.ts'),
  'utf-8'
)

describe('vite.config.ts — T-W06 ffmpeg worker guard', () => {
  it('optimizeDeps.exclude contains @ffmpeg/ffmpeg', () => {
    expect(configSource).toContain("'@ffmpeg/ffmpeg'")
  })

  it('optimizeDeps.exclude contains @ffmpeg/util', () => {
    expect(configSource).toContain("'@ffmpeg/util'")
  })

  it('config uses optimizeDeps.exclude block', () => {
    expect(configSource).toMatch(/optimizeDeps\s*:\s*\{/)
    expect(configSource).toMatch(/exclude\s*:\s*\[/)
  })

  it('COOP/COEP require-corp is NOT set as a header value (comments allowed to explain removal)', () => {
    // Filter out comment lines — require-corp may appear in comments explaining its removal.
    // What must NOT exist: require-corp as a string literal value in code (e.g. in server.headers).
    const nonCommentLines = configSource
      .split('\n')
      .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n')
    // Must not appear as a quoted string value
    expect(nonCommentLines).not.toMatch(/'require-corp'/)
    expect(nonCommentLines).not.toMatch(/"require-corp"/)
  })

  it('COOP same-origin header is NOT set as a code value', () => {
    // Only flag if present as a header value string (not in comments)
    const lines = configSource.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    const joined = lines.join('\n')
    expect(joined).not.toContain("'same-origin'")
  })
})
