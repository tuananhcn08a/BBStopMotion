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
