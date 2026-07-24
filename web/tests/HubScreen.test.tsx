/**
 * T-XW05/T-XW10 — S1 Hub Xưởng phim. AC1 (danh sách/empty state), AC4 (thẻ: thumbnail/thể loại/số
 * ảnh/độ dài ước tính đúng qua `fpsFor`), AC5 (menu ⋯ → xoá dự án — confirm trước khi gọi
 * callback), AC7 (chip ĐÚNG iOS ProjectChip: todo/streak/done — thay placeholder "Đang làm" wave-2,
 * "Ngày N" lịch trên thumbnail diary).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HubScreen from '../src/components/HubScreen'
import { ProjectMeta } from '../src/lib/project/types'
import { ProjectFrame } from '../src/lib/project/types'

const mockGetFrames = vi.fn((): Promise<ProjectFrame[]> => Promise.resolve([]))
vi.mock('../src/lib/project/db', () => ({
  getFrameBytes: vi.fn().mockResolvedValue(undefined),
  getFrames: () => mockGetFrames(),
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
  mockGetFrames.mockReset().mockResolvedValue([])
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

describe('HubScreen — AC7 chip ĐÚNG iOS ProjectChip (todo/streak/done)', () => {
  it('🎭 animation CHƯA export → KHÔNG hiện chip nào (khớp iOS, không có "Đang làm")', () => {
    render(
      <HubScreen
        language="vi+en"
        projects={[makeProject({ kind: 'animation', exportedAt: undefined })]}
        onOpenProject={vi.fn()}
        onNewProject={vi.fn()}
        onDeleteProject={vi.fn()}
      />
    )
    expect(screen.queryByTestId(/^hub-chip-/)).not.toBeInTheDocument()
  })

  it('🎭 animation đã export → chip "Đã xuất phim"', () => {
    render(
      <HubScreen
        language="vi+en"
        projects={[makeProject({ kind: 'animation', exportedAt: 1700000001000 })]}
        onOpenProject={vi.fn()}
        onNewProject={vi.fn()}
        onDeleteProject={vi.fn()}
      />
    )
    expect(screen.getByText(/Đã xuất phim/)).toBeInTheDocument()
  })

  it('🌱 diary CHƯA chụp hôm nay → chip "📸 Hôm nay chưa chụp" (bất kể đã export trước đó)', async () => {
    mockGetFrames.mockResolvedValue([]) // dự án mới, 0 frame → chưa chụp hôm nay
    render(
      <HubScreen
        language="vi+en"
        projects={[makeProject({ kind: 'diary', exportedAt: 1700000001000 })]}
        onOpenProject={vi.fn()}
        onNewProject={vi.fn()}
        onDeleteProject={vi.fn()}
      />
    )
    await waitFor(() => expect(screen.getByTestId('hub-chip-todo')).toBeInTheDocument())
    expect(screen.getByText(/Hôm nay chưa chụp/)).toBeInTheDocument()
  })

  it('🌱 diary ĐÃ chụp hôm nay + streak>0 → chip "🔥 N ngày liền"', async () => {
    const now = Date.now()
    mockGetFrames.mockResolvedValue([
      { seq: 0, file: 'frames/0001.jpg', capturedAt: now },
    ])
    render(
      <HubScreen
        language="vi+en"
        projects={[makeProject({ kind: 'diary' })]}
        onOpenProject={vi.fn()}
        onNewProject={vi.fn()}
        onDeleteProject={vi.fn()}
      />
    )
    await waitFor(() => expect(screen.getByTestId('hub-chip-streak')).toBeInTheDocument())
    expect(screen.getByText(/🔥 1 ngày liền/)).toBeInTheDocument()
  })

  it('🌱 diary — thumbnail có badge "Ngày N" (lịch, khác vị trí ảnh)', () => {
    const createdFiveDaysAgo = Date.now() - 5 * 86400000
    render(
      <HubScreen
        language="vi+en"
        projects={[makeProject({ kind: 'diary', createdAt: createdFiveDaysAgo, id: 'proj-day' })]}
        onOpenProject={vi.fn()}
        onNewProject={vi.fn()}
        onDeleteProject={vi.fn()}
      />
    )
    expect(screen.getByTestId('hub-thumb-day-proj-day')).toHaveTextContent('N6')
  })

  it('🎭 animation — KHÔNG hiện badge "Ngày N" trên thumbnail', () => {
    render(
      <HubScreen
        language="vi+en"
        projects={[makeProject({ kind: 'animation', id: 'proj-anim' })]}
        onOpenProject={vi.fn()}
        onNewProject={vi.fn()}
        onDeleteProject={vi.fn()}
      />
    )
    expect(screen.queryByTestId('hub-thumb-day-proj-anim')).not.toBeInTheDocument()
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

describe('HubScreen — T-XW21 menu "⋯" → "Chuyển máy / Sao lưu" (S6 entry point)', () => {
  it('không truyền onTransferProject (vd test/gate cũ) → KHÔNG hiện mục menu này, không throw', async () => {
    const user = userEvent.setup()
    render(
      <HubScreen
        language="vi+en"
        projects={[makeProject({ id: 'proj-1' })]}
        onOpenProject={vi.fn()}
        onNewProject={vi.fn()}
        onDeleteProject={vi.fn()}
      />
    )
    await user.click(screen.getByTestId('hub-project-menu-proj-1'))
    expect(screen.queryByTestId('hub-project-transfer-proj-1')).toBeNull()
  })

  it('có onTransferProject → bấm ⋯ rồi "Chuyển máy / Sao lưu" → gọi onTransferProject(project) đúng, đóng menu', async () => {
    const onTransferProject = vi.fn()
    const user = userEvent.setup()
    const project = makeProject({ id: 'proj-t', title: 'Cây đậu của Bin' })
    render(
      <HubScreen
        language="vi+en"
        projects={[project]}
        onOpenProject={vi.fn()}
        onNewProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onTransferProject={onTransferProject}
      />
    )
    await user.click(screen.getByTestId('hub-project-menu-proj-t'))
    await user.click(screen.getByTestId('hub-project-transfer-proj-t'))

    expect(onTransferProject).toHaveBeenCalledWith(project)
    expect(screen.queryByTestId('hub-project-transfer-proj-t')).toBeNull() // menu đã đóng
  })
})
