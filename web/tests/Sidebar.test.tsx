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
