# Upload Endpoint Contract — NAS (bb-share.bapbean.com)

**Status:** PENDING — devops needs to deploy the NAS stack before this works end-to-end.
**Web-dev contact:** See `src/hooks/useExport.ts` for integration code.
**Env vars:**
- `VITE_UPLOAD_ENDPOINT` — full URL, e.g. `https://bb-share.bapbean.com/api/upload` (set in `.env.local`, never commit)
- `VITE_UPLOAD_TOKEN` — shared secret for `X-Upload-Token` header (set in `.env.local`, never commit)

When `VITE_UPLOAD_ENDPOINT` is empty, the app runs in **degraded mode** (local download only, no QR).

---

## POST /api/upload

Upload an exported video file to get a public download URL for QR code generation.

### Request

```
POST https://bb-share.bapbean.com/api/upload
Content-Type: multipart/form-data
X-Upload-Token: <shared-secret>
```

**Form fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | Blob/File | YES | Video blob (MP4, up to 500 MB) |
| `filename` | string | YES | Suggested filename, e.g. `phim-cua-con-1719288000000.mp4` (server sanitises) |

### Response — Success (200)

```json
{
  "ok": true,
  "download_url": "https://bb-share.bapbean.com/files/2026-06-26/abc123def/movie.mp4",
  "expires_at": "2026-07-03T00:00:00Z"
}
```

- `download_url` — publicly accessible URL (no auth required); used for QR code generation.
- `expires_at` — ISO-8601 timestamp when the file will be deleted (7 days from upload).

### Response — Error

```json
{ "ok": false, "error": "file_too_large", "max_bytes": 524288000 }  // 413
{ "ok": false, "error": "unauthorized" }                            // 401
{ "ok": false, "error": "storage_full" }                            // 507
```

On any non-2xx response, the web app enters **degraded mode**:
- The video was assembled in-browser (offline) — the child can still download it locally.
- No QR code is shown.
- A "Thử tải lên lại" button is shown.

### Constraints

| Constraint | Value |
|-----------|-------|
| Max file size | 500 MB |
| Auth | `X-Upload-Token` header (static shared secret) |
| CORS | Must allow the app's origin |
| Link TTL | 7 days (cron deletes files older than 7 days at 02:00 daily) |

---

## Integration code location

`web/src/hooks/useExport.ts` — `uploadFile()` reads `VITE_UPLOAD_ENDPOINT` + `VITE_UPLOAD_TOKEN` and POSTs the video blob.

## Degraded mode

If `VITE_UPLOAD_ENDPOINT` is unset or upload fails, `ExportResult.uploadError` is set and `uploadUrl`/`expiresAt` are `undefined`. The `SuccessScreen` shows the local download button and an error notice, hiding the QR block.
