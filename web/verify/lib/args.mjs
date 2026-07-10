/**
 * lib/args.mjs — tiny `--flag value` / `--bool-flag` parser, no deps.
 */
export function parseArgs(argv, boolFlags = []) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]
    if (!tok.startsWith('--')) continue
    const key = tok.slice(2)
    if (boolFlags.includes(key)) {
      out[key] = true
      continue
    }
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      out[key] = true
    } else {
      out[key] = next
      i++
    }
  }
  return out
}

export function parseViewport(spec, fallback = { width: 1280, height: 820 }) {
  if (!spec) return fallback
  const m = /^(\d+)x(\d+)$/.exec(String(spec).trim())
  if (!m) throw new Error(`Viewport không hợp lệ: "${spec}" (dạng đúng: 1280x820)`)
  return { width: Number(m[1]), height: Number(m[2]) }
}
