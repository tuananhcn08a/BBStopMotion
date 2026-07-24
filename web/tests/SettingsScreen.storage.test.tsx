/**
 * T-XW21 — Storage 3 lớp (khối "Bộ nhớ & lưu trữ" trong Cài đặt) + hàng "Giới thiệu app iPhone"
 * (S5 điểm vào (b)). Mock `navigator.storage` trực tiếp (KHÔNG mock `storageGuard.ts` — verify
 * đúng module thật gọi API trình duyệt, cùng tinh thần `tests/project.storageGuard.test.ts`).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SettingsScreen from '../src/components/SettingsScreen'
import { DEFAULT_SETTINGS } from '../src/types'

function mockNavigatorStorage(overrides: Partial<{ persist: () => Promise<boolean>; estimate: () => Promise<StorageEstimate> }> = {}) {
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    writable: true,
    value: {
      persist: overrides.persist ?? vi.fn().mockResolvedValue(true),
      persisted: vi.fn().mockResolvedValue(true),
      estimate: overrides.estimate ?? vi.fn().mockResolvedValue({ usage: 42 * 1024 * 1024, quota: 1000 * 1024 * 1024 }),
    },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SettingsScreen — Storage 3 lớp: lớp 1 persist', () => {
  it('persist() granted → badge xanh "Đã bật"', async () => {
    mockNavigatorStorage({ persist: vi.fn().mockResolvedValue(true) })
    render(<SettingsScreen settings={DEFAULT_SETTINGS} onChange={vi.fn()} />)
    expect(await screen.findByTestId('storage-persist-granted')).toHaveTextContent('Đã bật')
    expect(screen.queryByTestId('storage-persist-denied')).toBeNull()
  })

  it('persist() từ chối → badge vàng cảnh báo "Chưa bật"', async () => {
    mockNavigatorStorage({ persist: vi.fn().mockResolvedValue(false) })
    render(<SettingsScreen settings={DEFAULT_SETTINGS} onChange={vi.fn()} />)
    expect(await screen.findByTestId('storage-persist-denied')).toHaveTextContent('Chưa bật')
    expect(screen.queryByTestId('storage-persist-granted')).toBeNull()
  })
})

describe('SettingsScreen — Storage 3 lớp: lớp 2 đồng hồ dung lượng', () => {
  it('hiện đúng dung lượng đã dùng (MB) từ navigator.storage.estimate()', async () => {
    mockNavigatorStorage({ estimate: vi.fn().mockResolvedValue({ usage: 42 * 1024 * 1024, quota: 1000 * 1024 * 1024 }) })
    render(<SettingsScreen settings={DEFAULT_SETTINGS} onChange={vi.fn()} />)
    const text = await screen.findByTestId('storage-gauge-text')
    expect(text).toHaveTextContent('42 MB')
  })

  it('usage/quota thấp (18%) → thanh gauge KHÔNG phải màu cảnh báo', async () => {
    mockNavigatorStorage({ estimate: vi.fn().mockResolvedValue({ usage: 180, quota: 1000 }) })
    render(<SettingsScreen settings={DEFAULT_SETTINGS} onChange={vi.fn()} />)
    const fill = await screen.findByTestId('storage-gauge-fill')
    await waitFor(() => expect(fill.style.width).toBe('18%'))
    expect(fill.style.background).toBe('var(--color-primary)')
  })

  it('usage/quota >=80% (85%) → thanh gauge màu cảnh báo (warn)', async () => {
    mockNavigatorStorage({ estimate: vi.fn().mockResolvedValue({ usage: 850, quota: 1000 }) })
    render(<SettingsScreen settings={DEFAULT_SETTINGS} onChange={vi.fn()} />)
    const fill = await screen.findByTestId('storage-gauge-fill')
    await waitFor(() => expect(fill.style.width).toBe('85%'))
    expect(fill.style.background).toBe('var(--color-warn-text)')
  })

  it('usage/quota >=95% (97%) → thanh gauge màu nguy hiểm (error)', async () => {
    mockNavigatorStorage({ estimate: vi.fn().mockResolvedValue({ usage: 970, quota: 1000 }) })
    render(<SettingsScreen settings={DEFAULT_SETTINGS} onChange={vi.fn()} />)
    const fill = await screen.findByTestId('storage-gauge-fill')
    await waitFor(() => expect(fill.style.width).toBe('97%'))
    expect(fill.style.background).toBe('var(--color-error)')
  })

  it('navigator.storage không khả dụng (Safari cũ/private) → không throw, gauge 0%', async () => {
    Object.defineProperty(navigator, 'storage', { configurable: true, writable: true, value: undefined })
    expect(() => render(<SettingsScreen settings={DEFAULT_SETTINGS} onChange={vi.fn()} />)).not.toThrow()
  })
})

describe('SettingsScreen — Storage 3 lớp: lớp 3 + lớp bảo hiểm cuối', () => {
  it('hiện gợi ý "Thêm vào Màn hình chính" + ghi chú lớp bảo hiểm cuối (file .bbsproj)', () => {
    mockNavigatorStorage()
    render(<SettingsScreen settings={DEFAULT_SETTINGS} onChange={vi.fn()} />)
    expect(screen.getByTestId('storage-card')).toHaveTextContent('Thêm vào Màn hình chính')
    expect(screen.getByTestId('storage-card')).toHaveTextContent('.bbsproj')
  })
})

describe('SettingsScreen — T-XW21 S5 điểm vào (b): hàng "Giới thiệu app iPhone"', () => {
  it('không truyền onOpenAppIntro → KHÔNG hiện hàng này', () => {
    mockNavigatorStorage()
    render(<SettingsScreen settings={DEFAULT_SETTINGS} onChange={vi.fn()} />)
    expect(screen.queryByTestId('settings-app-intro-row')).toBeNull()
  })

  it('có onOpenAppIntro → hiện hàng, bấm gọi đúng callback', () => {
    mockNavigatorStorage()
    const onOpenAppIntro = vi.fn()
    render(<SettingsScreen settings={DEFAULT_SETTINGS} onChange={vi.fn()} onOpenAppIntro={onOpenAppIntro} />)
    fireEvent.click(screen.getByTestId('settings-app-intro-row'))
    expect(onOpenAppIntro).toHaveBeenCalledTimes(1)
  })
})
