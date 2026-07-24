/**
 * F2 — goalFrames progress cap; F5 — nav khoá khi EXPORTING.
 * BA Scenarios: TS-BS-05, TS-BS-06, TS-BS-15
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Sidebar from '../src/components/Sidebar'

describe('Sidebar — progress card (F2)', () => {
  it('TS-BS-05: hiện đúng "N / goal frame" và fill % = frames/goal', () => {
    render(
      <Sidebar
        screen="capture"
        onNavigate={vi.fn()}
        variant="full"
        locked={false}
        language="vi+en"
        frameCount={15}
        goalFrames={30}
      />
    )
    expect(screen.getByTestId('goal-progress-num')).toHaveTextContent('15')
    expect(screen.getByTestId('goal-progress-num')).toHaveTextContent('/ 30 frame')
    const fill = screen.getByTestId('goal-progress-fill')
    expect(fill).toHaveStyle({ width: '50%' })
  })

  it('TS-BS-06: frameCount > goalFrames → fill cap ở 100% (không tràn quá pill)', () => {
    render(
      <Sidebar
        screen="capture"
        onNavigate={vi.fn()}
        variant="full"
        locked={false}
        language="vi+en"
        frameCount={15}
        goalFrames={10}
      />
    )
    expect(screen.getByTestId('goal-progress-num')).toHaveTextContent('/ 10 frame')
    const fill = screen.getByTestId('goal-progress-fill')
    expect(fill).toHaveStyle({ width: '100%' })
  })
})

describe('Sidebar — nav lock khi export (F5/TS-BS-15)', () => {
  it('TS-BS-15: locked=true → click nav KHÔNG gọi onNavigate, item disabled', async () => {
    const onNavigate = vi.fn()
    render(
      <Sidebar
        screen="capture"
        onNavigate={onNavigate}
        variant="full"
        locked={true}
        language="vi+en"
        frameCount={5}
        goalFrames={30}
      />
    )
    const libraryNav = screen.getByTestId('nav-library')
    expect(libraryNav).toBeDisabled()
    await userEvent.click(libraryNav, { pointerEventsCheck: 0 })
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('locked=false → click nav gọi onNavigate với screen đích', async () => {
    const onNavigate = vi.fn()
    render(
      <Sidebar
        screen="capture"
        onNavigate={onNavigate}
        variant="full"
        locked={false}
        language="vi+en"
        frameCount={5}
        goalFrames={30}
      />
    )
    await userEvent.click(screen.getByTestId('nav-library'))
    expect(onNavigate).toHaveBeenCalledWith('library')
  })
})

// T-XW05 — nav item 1 đổi "🎥 Chụp phim" → "🎬 Xưởng phim" (Hub đa dự án), screen 'capture' vẫn
// highlight nav 'hub' (Capture là sub-flow điều hướng TỪ Hub, không phải mục nav riêng).
describe('Sidebar — nav "Xưởng phim" (T-XW05, thay nav-capture cũ)', () => {
  it('nav item 1 là testid "nav-hub", KHÔNG còn "nav-capture"', () => {
    render(
      <Sidebar screen="hub" onNavigate={vi.fn()} variant="compact" locked={false} language="vi+en" frameCount={0} goalFrames={30} />
    )
    expect(screen.getByTestId('nav-hub')).toBeInTheDocument()
    expect(screen.queryByTestId('nav-capture')).not.toBeInTheDocument()
  })

  it('click nav-hub gọi onNavigate("hub")', async () => {
    const onNavigate = vi.fn()
    render(
      <Sidebar screen="library" onNavigate={onNavigate} variant="compact" locked={false} language="vi+en" frameCount={0} goalFrames={30} />
    )
    await userEvent.click(screen.getByTestId('nav-hub'))
    expect(onNavigate).toHaveBeenCalledWith('hub')
  })

  it('screen="capture" (đang mở 1 dự án) → nav-hub vẫn active (aria-current=page)', () => {
    render(
      <Sidebar screen="capture" onNavigate={vi.fn()} variant="full" locked={false} language="vi+en" frameCount={5} goalFrames={30} />
    )
    expect(screen.getByTestId('nav-hub')).toHaveAttribute('aria-current', 'page')
  })

  it('screen="hub" + hubProjectCount>0 → mobile header badge "N dự án"; hubProjectCount=0 → ẩn (khớp iOS empty)', () => {
    const { rerender } = render(
      <Sidebar screen="hub" onNavigate={vi.fn()} variant="compact" locked={false} language="vi+en" frameCount={0} goalFrames={30} hubProjectCount={3} />
    )
    expect(screen.getByTestId('hub-header-count')).toHaveTextContent('3 dự án')

    rerender(
      <Sidebar screen="hub" onNavigate={vi.fn()} variant="compact" locked={false} language="vi+en" frameCount={0} goalFrames={30} hubProjectCount={0} />
    )
    expect(screen.queryByTestId('hub-header-count')).not.toBeInTheDocument()
  })
})
