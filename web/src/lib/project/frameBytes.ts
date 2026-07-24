/**
 * T-XW05 — chuyển đổi giữa 2 dạng biểu diễn 1 frame JPEG trong bộ nhớ:
 *   - `data:` URL (base64) — dạng `useCapture().captureFrame()` xuất ra từ canvas, dùng trực tiếp
 *     cho `<img src>`/`Image().src` không cần giải phóng.
 *   - `ArrayBuffer` — dạng lưu trong IndexedDB (`src/lib/project/db.ts`, KHÔNG dataURL vì nặng RAM).
 *
 * Khi resume dự án (đọc frame cũ từ IndexedDB), bytes được bọc lại thành Object URL (`blob:`) để
 * gán vào `CapturedFrame.dataUrl` — component tiêu thụ (Filmstrip/OnionSkin/useExport) không cần
 * biết đây là `data:` hay `blob:`, cả 2 đều dùng được y hệt cho `<img>`/`fetch()`.
 */

/** `data:image/jpeg;base64,...` → bytes thô, để ghi vào IndexedDB qua `addFrame`. */
export async function dataUrlToArrayBuffer(dataUrl: string): Promise<ArrayBuffer> {
  const res = await fetch(dataUrl)
  return res.arrayBuffer()
}

/** Bytes thô đọc lại từ IndexedDB → Object URL dùng được ngay cho `<img>`/`fetch()` (ffmpeg.wasm). */
export function arrayBufferToObjectUrl(bytes: ArrayBuffer): string {
  const blob = new Blob([bytes], { type: 'image/jpeg' })
  return URL.createObjectURL(blob)
}

/** Thu hồi 1 Object URL — gọi khi rời màn Capture / đóng dự án để tránh rò rỉ bộ nhớ trình duyệt.
 *  An toàn khi gọi trên `data:` URL (no-op — `revokeObjectURL` chỉ có tác dụng với `blob:`). */
export function revokeIfObjectUrl(url: string): void {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url)
}

/**
 * T-XW05 — Library (`src/lib/libraryDb.ts`) lưu `thumbnailDataUrl` TRỰC TIẾP vào IndexedDB, phải
 * sống sót qua reload/đóng tab. Frame cuối của 1 dự án RESUME có thể đang là `blob:` Object URL
 * (chỉ sống trong phiên tab hiện tại — mất hiệu lực sau reload) — phải quy đổi về `data:` base64
 * TRƯỚC khi ghi vào Library, nếu không thumbnail sẽ vỡ ảnh sau khi người dùng tải lại trang.
 * `data:` URL có sẵn (frame vừa chụp trong phiên) trả nguyên, không tốn công đọc lại.
 */
export async function toPersistableDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}
