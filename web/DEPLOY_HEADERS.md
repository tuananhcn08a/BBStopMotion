# Required HTTP Headers for Deployment

ffmpeg.wasm (used for in-browser MP4 export) requires `SharedArrayBuffer`,
which browsers only expose when served with these two headers on EVERY response:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without these headers, the app will crash at export time with:
`RangeError: SharedArrayBuffer is not defined`

## How to configure per hosting provider

### Nginx

```nginx
server {
    ...
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Embedder-Policy "require-corp" always;
}
```

### Caddy

```
header {
    Cross-Origin-Opener-Policy "same-origin"
    Cross-Origin-Embedder-Policy "require-corp"
}
```

### Netlify (`netlify.toml`)

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Opener-Policy = "same-origin"
    Cross-Origin-Embedder-Policy = "require-corp"
```

### Vercel (`vercel.json`)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

### GitHub Pages

GitHub Pages does not support custom response headers. Use Netlify or Vercel instead.

## Dev server

These headers are already configured in `vite.config.ts` for `npm run dev` and `npm run preview`.
No extra setup needed for local development.

---

## ffmpeg Core Assets — Must Be Served Same-Origin

The app self-hosts ffmpeg core files under `/ffmpeg/`:
- `/ffmpeg/ffmpeg-core.js`
- `/ffmpeg/ffmpeg-core.wasm`

These files live in `web/public/ffmpeg/` in the repo and are included in the Vite build output.

### Why same-origin is required
`Cross-Origin-Embedder-Policy: require-corp` (set in the headers above) blocks cross-origin
responses that do not include `Cross-Origin-Resource-Policy: require-corp` or
`Cross-Origin-Resource-Policy: cross-origin`. Public CDNs (unpkg, jsDelivr, etc.) do not
set this header, so the browser silently blocks the fetch → `ffmpeg.load()` hangs → app
freezes at "Đang chuẩn bị phần mềm ghép phim...".

Same-origin assets are automatically trusted under COEP — no extra header needed.

### Deployment checklist for ffmpeg assets
- [ ] `/ffmpeg/ffmpeg-core.js` is present in the build output (Vite copies from `public/`)
- [ ] `/ffmpeg/ffmpeg-core.wasm` is present in the build output
- [ ] Both files are served from the **same origin** as the app (same scheme + domain + port)
- [ ] Do NOT offload these files to a CDN unless the CDN is configured to send
      `Cross-Origin-Resource-Policy: same-origin` (or `cross-origin`) on every response

### Nginx example (if assets served from same server)
No extra config needed — Nginx serves the files as-is, same origin as the app.
MIME type for `.wasm`: Nginx 1.25+ includes it by default. For older Nginx:
```nginx
types {
    application/wasm wasm;
}
```

### CDN/edge hosting example (if you MUST use a CDN for static assets)
Ensure the CDN passes through or injects:
```
Cross-Origin-Resource-Policy: same-origin
```
on responses for `*.wasm` and `*.js` files under `/ffmpeg/`. Otherwise, use same-origin
hosting for the ffmpeg assets and CDN only for other static files.
