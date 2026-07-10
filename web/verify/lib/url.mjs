/**
 * lib/url.mjs — chấp nhận cả URL đầy đủ (file://, http://) LẪN đường dẫn
 * filesystem trần (vd "verify/fixtures/self-test.html") cho tiện gõ CLI/npm
 * script. Đường dẫn trần được quy về `file://` tuyệt đối.
 */
import path from 'path'
import { pathToFileURL } from 'url'

const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/

export function toPageUrl(input) {
  if (!input) return input
  if (SCHEME_RE.test(input)) return input
  return pathToFileURL(path.resolve(input)).href
}
