/**
 * T-XW03 — storageGuard: xin quyền lưu trữ bền (`navigator.storage.persist()`) + đọc dung lượng
 * đã dùng/hạn mức (`estimate()`) cho đồng hồ dung lượng ở màn Cài đặt (wave sau). Không throw —
 * môi trường không hỗ trợ (Safari cũ/private mode/SSR/test) trả về giá trị an toàn.
 */

export interface StorageEstimateResult {
  usageBytes?: number
  quotaBytes?: number
}

/** Xin trình duyệt KHÔNG tự xoá dữ liệu dự án khi thiếu dung lượng (best-effort, có thể bị từ chối). */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function isStoragePersisted(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) return false
  try {
    return await navigator.storage.persisted()
  } catch {
    return false
  }
}

export async function getStorageEstimate(): Promise<StorageEstimateResult> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return {}
  try {
    const { usage, quota } = await navigator.storage.estimate()
    return { usageBytes: usage, quotaBytes: quota }
  } catch {
    return {}
  }
}
