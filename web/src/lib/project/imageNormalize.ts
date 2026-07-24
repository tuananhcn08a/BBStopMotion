/**
 * T-XW09 — Chuẩn hoá frame NGAY LÚC CHỤP thành JPEG 1280×720 (16:9) q0.85, khớp iOS
 * `bbstopmotion-apple/Shared/Services/ImageNormalizer.swift` (contract `bbsproj-format-v1.md` §5:
 * "frame trong `.bbsproj` là JPEG ~1280×720 q0.85", §10-Q3 "Normalize LÚC CHỤP").
 *
 * Web dùng canvas kích thước CỨNG 1280×720 (không nhân `devicePixelRatio`) + crop-fill giữ tỉ lệ
 * (như CSS `object-fit: cover`) để MỌI frame chụp ra đúng 1280×720 bất kể tỉ lệ camera thật —
 * xem `src/hooks/useCapture.ts` (nơi gọi `computeCropFillSourceRect` + vẽ canvas).
 *
 * Đối chiếu iOS (xem "Kết quả" T-XW09 trong task card để biết mức khớp/khác đầy đủ):
 * - iOS `ImageNormalizer.normalize(_:)` (hàm THẬT `ProjectStore.addFrame` gọi lúc chụp) = CHỈ
 *   downscale-nếu-lớn-hơn, GIỮ NGUYÊN tỉ lệ gốc camera — KHÔNG crop, output có thể KHÔNG đúng
 *   1280×720 tuyệt đối (vd camera 4:3 → ra ~960×720).
 * - iOS `ImageNormalizer.normalizeImported(_:targetSize:)` = center-crop-fill về ĐÚNG kích thước
 *   đích — thuật toán crop giống HỆT logic web ở đây, nhưng iOS chỉ dùng cho ảnh IMPORT
 *   (Photos/Files), không dùng cho ảnh camera.
 * - Web (module này) áp thuật toán crop-fill kiểu `normalizeImported` cho MỌI frame camera (không
 *   chỉ import) để đảm bảo output LUÔN ĐÚNG 1280×720 bất kể tỉ lệ camera trình duyệt (biến thiên
 *   nhiều hơn hẳn phần cứng camera iPhone/iPad cố định) — quyết định kỹ thuật rõ ràng của
 *   Coordinator cho T-XW09, ưu tiên nhất quán kích thước trong nội bộ 1 dự án web hơn là bám sát
 *   tuyệt đối thuật toán `normalize()` iOS dùng cho camera.
 */

/** [BINDING] `bbsproj-format-v1.md` §1/§5 — khớp `ImageNormalizer.maxWidth/maxHeight/quality`. */
export const NORMALIZED_WIDTH = 1280
export const NORMALIZED_HEIGHT = 720
export const NORMALIZED_QUALITY = 0.85
export const NORMALIZED_MIME = 'image/jpeg'

export interface CropFillSourceRect {
  sx: number
  sy: number
  sWidth: number
  sHeight: number
}

/**
 * Tính vùng CẮT trong ảnh nguồn (source) sao cho crop xong có ĐÚNG tỉ lệ đích, rồi vẽ scale vào
 * canvas đích full khung — tương đương "object-fit: cover" / iOS `normalizeImported` cropRect
 * (bbsproj-format-v1.md §5, `ImageNormalizer.swift` dòng 88-100): nguồn RỘNG hơn tỉ lệ đích → cắt
 * 2 bên trái/phải (giữ chiều cao); nguồn CAO hơn (hoặc bằng) tỉ lệ đích → cắt trên/dưới (giữ chiều
 * rộng). Crop luôn ĐỐI XỨNG (margin 2 bên bằng nhau) — không méo, không viền đen.
 */
export function computeCropFillSourceRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): CropFillSourceRect {
  const targetAspect = targetWidth / targetHeight
  const sourceAspect = sourceWidth / sourceHeight

  if (sourceAspect > targetAspect) {
    // Nguồn rộng/bẹt hơn tỉ lệ đích (vd 21:9 vào khung 16:9) — cắt trái/phải, giữ nguyên chiều cao.
    const sWidth = sourceHeight * targetAspect
    return { sx: (sourceWidth - sWidth) / 2, sy: 0, sWidth, sHeight: sourceHeight }
  }
  // Nguồn cao/vuông hơn tỉ lệ đích (vd 4:3, 1:1 vào khung 16:9) — cắt trên/dưới, giữ chiều rộng.
  const sHeight = sourceWidth / targetAspect
  return { sx: 0, sy: (sourceHeight - sHeight) / 2, sWidth: sourceWidth, sHeight }
}
