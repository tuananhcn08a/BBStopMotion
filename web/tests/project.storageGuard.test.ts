/**
 * T-XW03 — storageGuard: không throw khi môi trường (jsdom test) không có `navigator.storage`
 * (Safari cũ/private mode cũng rơi vào nhánh này) — trả giá trị an toàn thay vì crash luồng chụp.
 */
import { describe, it, expect } from 'vitest'
import { getStorageEstimate, isStoragePersisted, requestPersistentStorage } from '../src/lib/project/storageGuard'

describe('storageGuard — an toàn khi navigator.storage không sẵn có (jsdom)', () => {
  it('requestPersistentStorage() trả false, không throw', async () => {
    await expect(requestPersistentStorage()).resolves.toBe(false)
  })

  it('isStoragePersisted() trả false, không throw', async () => {
    await expect(isStoragePersisted()).resolves.toBe(false)
  })

  it('getStorageEstimate() trả object rỗng, không throw', async () => {
    await expect(getStorageEstimate()).resolves.toEqual({})
  })
})
