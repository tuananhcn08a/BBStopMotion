/**
 * T-XW17 AC2/AC3 — import ảnh từ máy (`<input type=file>`) vào dự án, mirror
 * `CaptureViewModel.importImages`/`ImageNormalizer.normalizeImported` iOS: mỗi ảnh crop-fill về
 * ĐÚNG kích thước chuẩn, encode JPEG cùng chất lượng frame chụp — TÁI DÙNG `drawNormalizedFrame`
 * (đã dùng cho camera, `useCapture.ts`) chứ KHÔNG viết pipeline crop thứ 2.
 *
 * Khác 1 điểm CÓ CHỦ ĐÍCH so với iOS: iOS tính `targetSize` ĐỘNG theo kích thước frame ĐẦU TIÊN
 * hiện có trong dự án (vì `ImageNormalizer.normalize()` cho ảnh CAMERA của iOS chỉ downscale-nếu-
 * lớn-hơn, KHÔNG ép cứng 16:9 — có thể ra kích thước khác nhau tuỳ máy/camera). Web thì KHÁC:
 * mọi frame camera đã LUÔN bị ép cứng `NORMALIZED_WIDTH`×`NORMALIZED_HEIGHT` từ T-XW09 (xem doc-
 * comment `imageNormalize.ts`) — nên ảnh import trên web dùng THẲNG hằng số cố định làm đích, không
 * cần (và không nên) tính động theo frame đầu, vẫn đảm bảo cross-device khớp (AC3) đơn giản hơn.
 */
import { NORMALIZED_HEIGHT, NORMALIZED_MIME, NORMALIZED_QUALITY, NORMALIZED_WIDTH, drawNormalizedFrame } from './imageNormalize'

export interface NormalizedImportedImage {
  dataUrl: string
  bytes: ArrayBuffer
}

/**
 * Decode 1 `File` ảnh → crop-fill 16:9 `NORMALIZED_WIDTH`×`NORMALIZED_HEIGHT` q0.85 JPEG (cùng
 * hằng số/pipeline camera). `null` khi file lỗi/không phải ảnh decode được (codec lạ, file hỏng)
 * — call-site (`useImportImages`) BỎ QUA file đó, tiếp tục các file còn lại (khớp iOS `guard let
 * normalized = ... else { continue }`), KHÔNG chặn cả batch import vì 1 file lỗi.
 */
export async function normalizeImportedFile(file: File): Promise<NormalizedImportedImage | null> {
  let bitmap: ImageBitmap | HTMLImageElement | null = null
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    bitmap = await decodeViaImageElement(file).catch(() => null)
  }
  if (!bitmap) return null

  try {
    const canvas = document.createElement('canvas')
    canvas.width = NORMALIZED_WIDTH
    canvas.height = NORMALIZED_HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const sourceWidth = 'naturalWidth' in bitmap ? bitmap.naturalWidth : bitmap.width
    const sourceHeight = 'naturalHeight' in bitmap ? bitmap.naturalHeight : bitmap.height
    if (!sourceWidth || !sourceHeight) return null

    drawNormalizedFrame(ctx, bitmap, sourceWidth, sourceHeight)
    const dataUrl = canvas.toDataURL(NORMALIZED_MIME, NORMALIZED_QUALITY)
    const bytes = await (await fetch(dataUrl)).arrayBuffer()
    return { dataUrl, bytes }
  } finally {
    if (bitmap && 'close' in bitmap) bitmap.close()
  }
}

/** Fallback cho trình duyệt/định dạng không hỗ trợ `createImageBitmap` trực tiếp trên `File`. */
function decodeViaImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('decodeViaImageElement failed'))
    }
    img.src = url
  })
}

/** Normalize TUẦN TỰ nhiều file (mirror vòng `for data in datas` iOS) — trả về CHỈ các ảnh decode
 *  thành công, giữ đúng thứ tự chọn. Tuần tự (không `Promise.all`) tránh nhiều canvas/bitmap decode
 *  chiếm bộ nhớ cùng lúc khi bé chọn nhiều ảnh lớn. */
export async function normalizeImportedFiles(files: File[]): Promise<NormalizedImportedImage[]> {
  const results: NormalizedImportedImage[] = []
  for (const file of files) {
    const normalized = await normalizeImportedFile(file)
    if (normalized) results.push(normalized)
  }
  return results
}
