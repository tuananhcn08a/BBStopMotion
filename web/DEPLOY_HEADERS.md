# Required HTTP Headers for Deployment

## COOP/COEP — KHÔNG CẦN (lõi ffmpeg đơn luồng)

> **Lưu ý quan trọng (T-W06):** Lõi ffmpeg (`@ffmpeg/core@0.12.6`) là **đơn luồng** — không dùng
> `SharedArrayBuffer`. Do đó, hai header dưới đây **không cần thiết** và thực tế **gây lỗi**
> `ERR_BLOCKED_BY_RESPONSE` khi Web Worker của `@ffmpeg/ffmpeg` load trong Vite / CDN.
>
> ```
> Cross-Origin-Opener-Policy: same-origin     ← KHÔNG ĐẶT
> Cross-Origin-Embedder-Policy: require-corp  ← KHÔNG ĐẶT
> ```
>
> **Không đặt hai header này** trên môi trường production.
>
> Nếu tương lai nâng cấp lên lõi đa luồng (`@ffmpeg/core-mt`), khi đó `SharedArrayBuffer` sẽ được
> dùng và COOP/COEP sẽ cần thêm lại. Cho đến lúc đó, bỏ hoàn toàn.

---

## ffmpeg Core Assets — Must Be Served Same-Origin

The app self-hosts ffmpeg core files under `/ffmpeg/`:
- `/ffmpeg/ffmpeg-core.js`
- `/ffmpeg/ffmpeg-core.wasm`

These files live in `web/public/ffmpeg/` in the repo and are included in the Vite build output.

### Why same-origin is required

The ffmpeg worker fetches core files using relative URLs resolved against the app's own origin.
If the core files are served from a different origin (e.g. a CDN), the browser blocks the fetch
due to CORS — `ffmpeg.load()` hangs → app freezes at "Đang chuẩn bị phần mềm ghép phim...".

Note: this is a **CORS** requirement, NOT a COEP requirement. COEP is not set.

### Deployment checklist for ffmpeg assets

- [ ] `/ffmpeg/ffmpeg-core.js` is present in the build output (Vite copies from `public/`)
- [ ] `/ffmpeg/ffmpeg-core.wasm` is present in the build output
- [ ] Both files are served from the **same origin** as the app (same scheme + domain + port)
- [ ] Do NOT offload these files to a CDN unless the CDN proxies them under the app's own origin

### Nginx example (if assets served from same server)

No extra config needed — Nginx serves the files as-is, same origin as the app.
MIME type for `.wasm`: Nginx 1.25+ includes it by default. For older Nginx:

```nginx
types {
    application/wasm wasm;
}
```

### CDN/edge hosting example

If you use a CDN for static assets, keep the ffmpeg assets on the **same-origin server** (not on
the CDN). Only offload other static files (images, JS chunks, CSS) to the CDN.

---

## Dev server

No special headers needed for `npm run dev` or `npm run preview`. The Vite dev server does not
set COOP/COEP (they were removed in T-W06).
