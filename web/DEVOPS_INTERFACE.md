# Upload Endpoint Contract

**Status:** STUB — devops needs to implement this endpoint.
**Web-dev contact:** See `src/hooks/useExport.ts` for integration code.
**Env var:** `VITE_UPLOAD_ENDPOINT` (set in `.env.local` for dev, or CI env for prod)

---

## POST /upload

Upload an exported video file to get a public download URL for QR code generation.

### Request

```
POST /upload
Content-Type: multipart/form-data
```

**Form fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | Blob/File | YES | Video blob (currently WebM from MediaRecorder) |
| `filename` | string | YES | Suggested filename, e.g. `neo-stopmotion-1719288000000.webm` |

### Response — Success (200)

```json
{
  "url": "https://storage.example.com/films/abc123.webm"
}
```

The `url` must be publicly accessible (no auth required) so the browser can generate a QR code pointing to it. This URL is displayed as a QR for the child to scan with a phone.

### Response — Error (4xx / 5xx)

```json
{
  "error": "Human-readable error description"
}
```

On any error response, the web app enters **degraded success** mode:
- The video was already assembled in-browser (offline) — the child can still download it locally.
- No QR code is shown.
- A "Thử tải lên lại" (retry upload) button is shown.

### Constraints (TBD — devops to confirm)

| Constraint | Current assumption | Devops to confirm |
|-----------|-------------------|-------------------|
| Max file size | 50 MB | TBD |
| Auth | None (public endpoint) or API key | TBD |
| CORS | Must allow `*` or the app's origin | TBD |
| Retention | Files kept for how long? | TBD |
| Rate limiting | None assumed for MVP | TBD |

### Dev / Stub

During development, set `VITE_UPLOAD_ENDPOINT=` (empty) in `.env.local` to skip upload entirely. The app will show degraded success mode (local download only, no QR).

---

## Integration code location

`web/src/hooks/useExport.ts` — `uploadFile()` function reads `VITE_UPLOAD_ENDPOINT` and POSTs the video blob.
