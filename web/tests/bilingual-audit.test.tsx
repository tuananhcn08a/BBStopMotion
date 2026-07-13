/**
 * T-BS11 (QA gate-web-report.md #1-#3) — chặn tái phát bug "label().sub bị nuốt": ở mode
 * 'vi+en', mọi nhãn UI hệ thống lẽ ra hiện "VN · EN" (theo redline) phải render CẢ HAI, không
 * chỉ VN. Bug gốc: welcome-cta (Δw=-71.4px) + settings title thiếu "Settings" — cả 2 đều do
 * component chỉ render `label().main`, bỏ quên `.sub`.
 *
 * 2 lớp test:
 * 1. Data-level — STRINGS entries "nên bilingual" phải có main≠sub không rỗng ở mode vi+en.
 * 2. Render-level — từng component đã sửa phải THỰC SỰ in ra cả 2 ngôn ngữ trên DOM (không chỉ
 *    dữ liệu đúng mà JSX phải dùng dữ liệu đó).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { STRINGS, label, StringKey } from '../src/i18n'
import Sidebar from '../src/components/Sidebar'
import WelcomeScreen from '../src/components/WelcomeScreen'
import SettingsScreen from '../src/components/SettingsScreen'
import LibraryScreen from '../src/components/LibraryScreen'
import { DEFAULT_SETTINGS } from '../src/types'

// ─── 1. Data-level: các key XÁC NHẬN phải bilingual thật (main≠sub, sub không rỗng) ──────────
const EXPECTED_BILINGUAL_KEYS: StringKey[] = [
  'nav.capture', 'nav.library', 'nav.settings', 'nav.help',
  'progress.label',
  'step.capture', 'step.export', 'step.share',
  'capture.btn', 'action.play', 'action.undo', 'action.export',
  'filmstrip.title',
  'success.download', 'success.newFilm',
  'settings.title', 'settings.language',
  'library.search',
  'welcome.cta',
]

describe('i18n data — key bilingual thật phải có sub khác main, không rỗng (vi+en)', () => {
  it.each(EXPECTED_BILINGUAL_KEYS)('%s: label("vi+en", key).sub tồn tại và khác main', (key) => {
    const { main, sub } = label('vi+en', key)
    expect(sub, `key "${key}" thiếu bản EN (sub) — STRINGS['${key}'].en đang rỗng hoặc trùng vi`).toBeTruthy()
    expect(sub).not.toBe(main)
  })

  it('mọi entry trong STRINGS đều có field vi và en (không undefined)', () => {
    for (const [key, entry] of Object.entries(STRINGS)) {
      expect(entry.vi, `STRINGS['${key}'].vi thiếu`).toBeDefined()
      expect(entry.en, `STRINGS['${key}'].en thiếu`).toBeDefined()
    }
  })
})

// ─── 2. Render-level: JSX thực tế phải in cả VN lẫn EN ở mode vi+en ──────────────────────────

describe('Render bilingual — Sidebar (progress label + Trợ giúp)', () => {
  it('progress-card label hiện "TIẾN ĐỘ" VÀ "PROGRESS" cùng lúc (không nuốt EN)', () => {
    render(
      <Sidebar
        screen="capture" onNavigate={vi.fn()} variant="full" locked={false}
        language="vi+en" frameCount={5} goalFrames={30}
      />
    )
    const card = screen.getByTestId('sidebar')
    expect(card).toHaveTextContent('TIẾN ĐỘ')
    expect(card).toHaveTextContent('PROGRESS')
  })

  it('nút Trợ giúp hiện "Trợ giúp" VÀ "Help" cùng lúc', () => {
    render(
      <Sidebar
        screen="capture" onNavigate={vi.fn()} variant="full" locked={false}
        language="vi+en" frameCount={5} goalFrames={30}
      />
    )
    const sidebar = screen.getByTestId('sidebar')
    expect(sidebar).toHaveTextContent('Trợ giúp')
    expect(sidebar).toHaveTextContent('Help')
  })
})

describe('Render bilingual — WelcomeScreen CTA (bug gốc QA #1)', () => {
  it('nút Bắt đầu hiện "Bắt đầu làm phim!" VÀ "Start" cùng lúc', () => {
    render(<WelcomeScreen language="vi+en" onStart={vi.fn()} />)
    const ctaBtn = screen.getByRole('button', { name: /Bắt đầu làm phim/i })
    expect(ctaBtn).toHaveTextContent('Bắt đầu làm phim!')
    expect(ctaBtn).toHaveTextContent('Start')
  })
})

describe('Render bilingual — SettingsScreen title + Ngôn ngữ row (bug gốc QA #2)', () => {
  it('tiêu đề hiện "Cài đặt" VÀ "Settings" cùng lúc', () => {
    // T-BS78: khối `.mobileSubline` (T-BS72 fix-1) đã bị gỡ bỏ cùng "(dành cho Thợ Cả)" — vẫn
    // lấy theo data-landmark (thay vì getByText) để chịu được thay đổi cấu trúc DOM tương lai.
    const { container } = render(<SettingsScreen settings={{ ...DEFAULT_SETTINGS, language: 'vi+en' }} onChange={vi.fn()} />)
    const screenRoot = container.querySelector('[data-landmark="settings-screen"]') as HTMLElement
    expect(screenRoot).toHaveTextContent('Cài đặt')
    expect(screenRoot).toHaveTextContent('Settings')
  })

  it('row "Ngôn ngữ" hiện "Ngôn ngữ" VÀ "Language" cùng lúc', () => {
    render(<SettingsScreen settings={{ ...DEFAULT_SETTINGS, language: 'vi+en' }} onChange={vi.fn()} />)
    const row = screen.getByText(/Ngôn ngữ/).closest('div')?.parentElement as HTMLElement
    expect(row).toHaveTextContent('Ngôn ngữ')
    expect(row).toHaveTextContent('Language')
  })
})

describe('Render bilingual — LibraryScreen search placeholder', () => {
  it('placeholder hiện "Tìm phim theo tên..." VÀ "Search" cùng lúc', () => {
    render(
      <LibraryScreen
        language="vi+en" entries={[]} onDelete={vi.fn()} onPlay={vi.fn()} onUpload={vi.fn()} uploadingId={null}
      />
    )
    const input = screen.getByTestId('library-search') as HTMLInputElement
    expect(input.placeholder).toContain('Tìm phim theo tên')
    expect(input.placeholder).toContain('Search')
  })
})
