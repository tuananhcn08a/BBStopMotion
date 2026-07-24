import '@testing-library/jest-dom'

/**
 * T-XW05 — jsdom (môi trường test) KHÔNG implement `URL.createObjectURL`/`revokeObjectURL`
 * (verify trực tiếp: `typeof URL.createObjectURL === 'undefined'` trong vitest+jsdom). Resume dự
 * án (`src/lib/project/frameBytes.ts` — đọc lại frame bytes từ IndexedDB, T-XW03) dùng Object URL
 * cho `CapturedFrame.dataUrl`, nên cần polyfill TỐI THIỂU chỉ cho test: Map lưu `Blob` theo URL
 * giả `blob:test-N`, monkey-patch `fetch` để trả đúng `Blob` khi gặp URL này (cho
 * `dataUrlToArrayBuffer`/`toPersistableDataUrl` fetch lại được, round-trip đúng bytes).
 *
 * KHÔNG ảnh hưởng hành vi PRODUCT THẬT — browser thật (Chrome/Safari/Firefox) đã có sẵn
 * `URL.createObjectURL`, guard `typeof === 'function'` bên dưới khiến polyfill này chỉ kích hoạt
 * khi API gốc THỰC SỰ thiếu (chỉ đúng trong jsdom).
 */
if (typeof URL.createObjectURL !== 'function') {
  const blobRegistry = new Map<string, Blob>()
  let counter = 0

  URL.createObjectURL = (blob: Blob): string => {
    const url = `blob:test-${counter++}`
    blobRegistry.set(url, blob)
    return url
  }
  URL.revokeObjectURL = (url: string): void => {
    blobRegistry.delete(url)
  }

  const originalFetch = globalThis.fetch?.bind(globalThis)
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url)
    if (url.startsWith('blob:test-')) {
      const blob = blobRegistry.get(url)
      return Promise.resolve(blob ? new Response(blob) : new Response(null, { status: 404 }))
    }
    return originalFetch(input, init)
  }) as typeof fetch
}

/**
 * T-XW17 — jsdom's `Blob` KHÔNG implement `.arrayBuffer()` (verify trực tiếp: `typeof new
 * Blob([]).arrayBuffer === 'undefined'` trong vitest+jsdom, dù `.arrayBuffer()` là API chuẩn được
 * MỌI trình duyệt thật hỗ trợ từ lâu — `saveLibraryVideoBlob`/`normalizeImportedFile` dùng API này
 * để đọc bytes). `new Response(blob).arrayBuffer()` ĐÃ THỬ nhưng jsdom's `Response` không đọc
 * đúng nội dung `Blob` (trả literal `"[object Blob]"`) — polyfill qua `FileReader` thay vào (jsdom
 * implement ĐÚNG, đọc được bytes thật của `Blob`, xác nhận qua thực nghiệm). CHỈ kích hoạt khi API
 * gốc thật sự thiếu (guard `typeof === 'undefined'`), không đụng hành vi trình duyệt thật.
 */
if (typeof Blob.prototype.arrayBuffer === 'undefined') {
  Blob.prototype.arrayBuffer = function (this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error ?? new Error('Blob.arrayBuffer polyfill failed'))
      reader.readAsArrayBuffer(this)
    })
  }
}
