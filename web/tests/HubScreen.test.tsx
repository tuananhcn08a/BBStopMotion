/**
 * T-XW05 — S1 Hub Xưởng phim. AC1 (danh sách/empty state), AC4 (thẻ: thumbnail/thể loại/số ảnh/
 * độ dài ước tính đúng qua `fpsFor`), AC5 (menu ⋯ → xoá dự án — confirm trước khi gọi callback),
 * chip "Đang làm" vs "Đã xuất phim" (bản wave-2 tối thiểu, xem `hub.chipInProgress`/`chipExported`).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HubScreen from '../src/components/HubScreen'
import { ProjectMeta } from '../src/lib/project/types'

vi.mock('../src/lib/project/db', () => ({
  getFrameBytes: vi.fn().mockResolvedValue(undefined),
}))

function makeProject(overrides: Partial<ProjectMeta> = {}): ProjectMeta {
  return {
    id: 'proj-1',
    title: 'Khủng long đất nặn',
    kind: 'animation',
    fpsLevel: 'normal',
    frameCount: 34,
    createdAt: 1700000000000,
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('HubScreen — AC1 danh sách + empty state', () => {
  it('không có dự án → hiện empty hint, KHÔNG hiện pill số dự án', () => {
    render(
      <HubScreen language="vi+en" projects={[]} onOpenProject={vi.fn()} onNewProject={vi.fn()} onDeleteProject={vi.fn()} />
    )
    expect(screen.getByTestId('hub-empty-hint')).toBeInTheDocument()
    expect(screen.queryByTestId('hub-count-pill')).not.toBeInTheDocument()
    expect(screen.getByTestId('hub-new-project-card')).toBeInTheDocument()
  })

  it('có dự án → hiện pill "N dự án" + card mỗi dự án, KHÔNG hiện empty hint', () => {
    render(
      <HubScreen
        language="vi+en"
        projects={[makeProject({ id: 'proj-1' }), makeProject({ id: 'proj-2', title: 'Cây đậu của Bin' })]}
        onOpenProject={vi.fn()}
        onNewProject={vi.fn()}
        onDeleteProject={vi.fn()}
      />
    )
    expect(screen.getByTestId('hub-count-pill')).toHaveTextContent('2')
    expect(screen.queryByTestId('hub-empty-hint')).not.toBeInTheDocument()
    expect(screen.getByTestId('hub-project-proj-1')).toBeInTheDocument()
    expect(screen.getByTestId('hub-project-proj-2')).toBeInTheDocument()
  })

  it('bấm card "+ Dự án mới" → gọi onNewProject', async () => {
    const onNewProject = vi.fn()
    const user = userEvent.setup()
    render(
      <HubScreen language="vi+en" projects={[]} onOpenProject={vi.fn()} onNewProject={onNewProject} onDeleteProject={vi.fn()} />
    )
    await user.click(screen.getByTestId('hub-new-project-card'))
    expect(onNewProject).toHaveBeenCalledTimes(1)
  })

  it('bấm card dự án → gọi onOpenProject(id) đúng dự án', async () => {
    const onOpenProject = vi.fn()
    const user = userEvent.setup()
    render(
      <HubScreen
        language="vi+en"
        projects={[makeProject({ id: 'proj-xyz' })]}
        onOpenProject={onOpenProject}
        onNewProject={vi.fn()}
        onDeleteProject={vi.fn()}
      />
    )
    await user.click(screen.getByTestId('hub-project-proj-xyz'))
    expect(onOpenProject).toHaveBeenCalledWith('proj-xyz')
  })
})

describe('HubScreen — AC4 thẻ dự án: thể loại/số ảnh/độ dài ước tính đúng fpsFor', () => {
  it('animation normal (6fps), 34 frame → ~5.7s, đơn vị "frame"', () => {
    render(
      <HubScreen
        language="vi+en"
        projects={[makeProject({ kind: 'animation', fpsLevel: 'normal', frameCount: 34 })]}
        onOpenProject={vi.fn()}
        onNewProject={vi.fn()}
        onDeleteProject={vi.fn()}
      />
    )
    // 34 / 6 = 5.6666 → toFixed(1) = "5.7" → hiển thị dạng VN "5,7"
    expect(screen.getByText(/🎭 Hoạt hình · 34 frame · ~5,7s/)).toBeInTheDocument()
  })

  it('diary slow (3fps — KHÁC animation slow=1fps), 14 ảnh → ~4.7s, đơn vị "ảnh"', () => {
    render(
      <HubScreen
        language="vi+en"
        projects={[makeProject({ kind: 'diary', fpsLevel: 'slow', frameCount: 14, title: 'Cây đậu của Bin' })]}
        onOpenProject={vi.fn()}
        onNewProject={vi.fn()}
        onDeleteProject={vi.fn()}
      />
    )
    // 14 / 3 = 4.6666 → "4,7s"
    expect(screen.getByText(/🌱 Nhật ký · 14 ảnh · ~4,7s/)).toBeInTheDocument()
  })
})

describe('HubScreen — chip trạng thái (bản wave-2 tối thiểu: đã xuất vs đang làm)', () => {
  it('chưa export (exportedAt undefined) → chip "Đang làm"', () => {
    render(
      <HubScreen
        language="vi+en"
        projects={[makeProject({ exportedAt: undefined })]}
        onOpenProject={vi.fn()}
        onNewProject={vi.fn()}
        onDeleteProject={vi.fn()}
      />
    )
    expect(screen.getByText(/Đang làm/)).toBeInTheDocument()
  })

  it('đã export (exportedAt set) → chip "Đã xuất phim"', () => {
    render(
      <HubScreen
        language="vi+en"
        projects={[makeProject({ exportedAt: 1700000001000 })]}
        onOpenProject={vi.fn()}
        onNewProject={vi.fn()}
        onDeleteProject={vi.fn()}
      />
    )
    expect(screen.getByText(/Đã xuất phim/)).toBeInTheDocument()
  })
})

describe('HubScreen — AC5 menu ⋯ → xoá dự án (confirm trước khi gọi callback)', () => {
  it('bấm ⋯ mở menu → bấm "Xoá dự án" → confirm() true → gọi onDeleteProject(id)', async () => {
    const onDeleteProject = vi.fn()
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <HubScreen
        language="vi+en"
        projects={[makeProject({ id: 'proj-del' })]}
        onOpenProject={vi.fn()}
        onNewProject={vi.fn()}
        onDeleteProject={onDeleteProject}
      />
    )
    await user.click(screen.getByTestId('hub-project-menu-proj-del'))
    await user.click(screen.getByTestId('hub-project-delete-proj-del'))

    expect(window.confirm).toHaveBeenCalled()
    expect(onDeleteProject).toHaveBeenCalledWith('proj-del')
  })

  it('confirm() false (Huỷ) → KHÔNG gọi onDeleteProject', async () => {
    const onDeleteProject = vi.fn()
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(
      <HubScreen
        language="vi+en"
        projects={[makeProject({ id: 'proj-keep' })]}
        onOpenProject={vi.fn()}
        onNewProject={vi.fn()}
        onDeleteProject={onDeleteProject}
      />
    )
    await user.click(screen.getByTestId('hub-project-menu-proj-keep'))
    await user.click(screen.getByTestId('hub-project-delete-proj-keep'))

    expect(onDeleteProject).not.toHaveBeenCalled()
  })

  it('bấm card KHÔNG bị kích hoạt khi bấm vùng ⋯/menu (stopPropagation)', async () => {
    const onOpenProject = vi.fn()
    const user = userEvent.setup()
    render(
      <HubScreen
        language="vi+en"
        projects={[makeProject({ id: 'proj-1' })]}
        onOpenProject={onOpenProject}
        onNewProject={vi.fn()}
        onDeleteProject={vi.fn()}
      />
    )
    await user.click(screen.getByTestId('hub-project-menu-proj-1'))
    expect(onOpenProject).not.toHaveBeenCalled()
  })
})
