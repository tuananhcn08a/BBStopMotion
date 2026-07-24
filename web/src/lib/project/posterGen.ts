/**
 * T-XW17 AC1 — Poster JPEG trích từ MP4 đã export, mirror `LibraryStore.generatePoster` iOS
 * (`AVAssetImageGenerator.copyCGImage(at: 0.1s)` + encode JPEG q0.8). Web dùng `<video>` seek +
 * canvas capture — KHÔNG ffmpeg (đã có sẵn cho export, nhưng nặng hơn nhiều lần cho việc CHỈ trích
 * 1 khung hình; `<video>`/canvas là API trình duyệt gốc, nhẹ, không cần decode lại toàn bộ file).
 *
 * Chạy SAU khi export xong, KHÔNG chặn UI (Promise async, gọi fire-and-forget từ call-site — xem
 * `App.tsx handleExport`) — khớp iOS `Task.detached`: lỗi (video hỏng/codec lạ/trình duyệt không
 * hỗ trợ) → resolve `null`, KHÔNG throw, call-site tự fallback `thumbnailDataUrl` (frame cuối) có
 * sẵn, không chặn luồng export/thư viện chính.
 */

/** [BINDING] mirror `LibraryStore.generatePoster` — 0.1s (không phải 0s, tránh khung đen/mờ đầu
 *  1 số codec) + JPEG q0.8 (khác q0.85 của frame gốc — poster chỉ cần đủ nét cho thumbnail nhỏ). */
export const POSTER_SEEK_SECONDS = 0.1
export const POSTER_QUALITY = 0.8
export const POSTER_MIME = 'image/jpeg'

/**
 * Trích 1 khung hình JPEG dataURL từ `blob` MP4 tại giây `seekSeconds`. `null` khi lỗi (video
 * không load được, `HTMLCanvasElement.getContext('2d')` không khả dụng, seek timeout...).
 */
export function generatePosterFromBlob(blob: Blob, seekSeconds: number = POSTER_SEEK_SECONDS): Promise<string | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob)
    let settled = false

    const finish = (result: string | null) => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(url)
      resolve(result)
    }

    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    video.onerror = () => finish(null)

    video.onloadedmetadata = () => {
      // Video hỏng/duration=0 (NaN/Infinity cũng có thể xảy ra với 1 số codec lạ) — kẹp về 0,
      // seek 0s vẫn tốt hơn bỏ cuộc hẳn. Trừ 0.01s tránh seek TRÚNG đúng frame cuối/EOF.
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : seekSeconds
      video.currentTime = Math.min(seekSeconds, Math.max(duration - 0.01, 0))
    }

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 1
        canvas.height = video.videoHeight || 1
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          finish(null)
          return
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        finish(canvas.toDataURL(POSTER_MIME, POSTER_QUALITY))
      } catch {
        // SecurityError (tainted canvas) hoặc lỗi decode bất ngờ — im lặng bỏ qua, khớp iOS.
        finish(null)
      }
    }

    video.src = url
  })
}
