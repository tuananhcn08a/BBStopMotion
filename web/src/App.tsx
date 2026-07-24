import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, AppSettings, CapturedFrame, ExportResult, FpsLevel, LibraryEntry, Screen } from './types'
import { ProjectKind, ProjectMeta } from './lib/project/types'
import { fpsFor } from './lib/project/fps'
import {
  addFrame as dbAddFrame, createProject, deleteFrame as dbDeleteFrame, deleteProject as dbDeleteProject,
  getFrameBytes, getProject, listProjects, markProjectExported,
} from './lib/project/db'
import { arrayBufferToObjectUrl, dataUrlToArrayBuffer, revokeIfObjectUrl, toPersistableDataUrl } from './lib/project/frameBytes'
import { loadSettings, saveSettings } from './lib/settingsStore'
import { addLibraryEntry, deleteLibraryEntry, listLibraryEntries } from './lib/libraryDb'
import { label } from './i18n'
import Sidebar from './components/Sidebar'
import WelcomeScreen from './components/WelcomeScreen'
import HubScreen from './components/HubScreen'
import NewProjectSheet from './components/NewProjectSheet'
import CaptureScreen from './components/CaptureScreen'
import ExportProgress from './components/ExportProgress'
import SuccessScreen from './components/SuccessScreen'
import LibraryScreen from './components/LibraryScreen'
import SettingsScreen from './components/SettingsScreen'
import { useExport, uploadExportedFile } from './hooks/useExport'
import {
  readGateFixtureParam, buildGateFrames, buildGateExportResult, buildGateLibraryEntries,
} from './lib/gateFixture'
import { emitLearningEvent } from './lib/neoSteamEmbed'
import styles from './App.module.css'

// Visual Diff Gate fixture (T-BS10 AC4 / T-BS11) — xem src/lib/gateFixture.ts. Đọc 1 lần lúc
// module load; không có ?gate=... thì luôn null và app chạy y hệt luồng thật.
const GATE_FIXTURE = readGateFixtureParam()

// T-XW05 F6 — Welcome chỉ hiện lần mở app ĐẦU TIÊN, persist qua localStorage (web hiện trước đây
// KHÔNG nhớ đã xem — vá điểm yếu này cùng lúc với đổi routing home = Hub).
const WELCOME_SEEN_KEY = 'bbstopmotion-welcome-seen'

/** try/catch quanh mọi truy cập localStorage — cùng quy ước phòng thủ `settingsStore.ts`
 *  (chế độ riêng tư/quota chặn ghi KHÔNG được crash app; test jsdom cũng thiếu backing file cho
 *  localStorage nên `.getItem` có thể không phải function — bọc try/catch xử lý luôn cả 2 case). */
function readWelcomeSeen(): boolean {
  try {
    return localStorage.getItem(WELCOME_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function writeWelcomeSeen(): void {
  try {
    localStorage.setItem(WELCOME_SEEN_KEY, '1')
  } catch {
    // localStorage không khả dụng — bỏ qua, Welcome sẽ hiện lại lần sau (không crash)
  }
}

function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  // F6 — Welcome chỉ hiện lần đầu: gate fixture LUÔN bỏ qua (bench visual diff không cần Welcome);
  // luồng thật đọc localStorage (persist thật, vá điểm yếu web cũ "không nhớ đã xem").
  const [welcomeSeen, setWelcomeSeen] = useState(() => GATE_FIXTURE !== null || readWelcomeSeen())
  // T-XW05 — home = Hub (danh sách dự án). Gate fixture giữ nguyên hành vi cũ (thẳng vào
  // capture/library theo từng fixture id) để không phá Visual Diff Gate đã chốt.
  const [screen, setScreen] = useState<Screen>(() => {
    if (GATE_FIXTURE === 'library') return 'library'
    if (GATE_FIXTURE) return 'capture'
    return 'hub'
  })
  const [onionEnabled, setOnionEnabled] = useState(true)

  // ---------- T-XW05 — Hub đa dự án + resume (bind Capture vào 1 project) ----------
  const [hubProjects, setHubProjects] = useState<ProjectMeta[]>([])
  const [showNewProjectSheet, setShowNewProjectSheet] = useState(false)
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [currentProjectKind, setCurrentProjectKind] = useState<ProjectKind>('animation')
  const [currentProjectTitle, setCurrentProjectTitle] = useState<string>('')
  // Object URL của các frame đã resume từ IndexedDB — thu hồi khi rời dự án (tránh rò rỉ bộ nhớ).
  const frameObjectUrlsRef = useRef<string[]>([])

  const [appState, setAppState] = useState<AppState>(() => {
    if (GATE_FIXTURE === 'success') return 'SUCCESS'
    if (GATE_FIXTURE === 'exporting') return 'EXPORTING'
    return 'CAPTURING'
  })
  const [frames, setFrames] = useState<CapturedFrame[]>(() => {
    if (GATE_FIXTURE === 'capture') return buildGateFrames(18)
    if (GATE_FIXTURE === 'exporting') return buildGateFrames(42) // khớp step chip "✓ Chụp · 42 frame" mockup 2b
    if (GATE_FIXTURE === 'disabled') return buildGateFrames(3) // < MIN_FRAMES_TO_EXPORT — mockup 2d state 1
    return []
  })
  const [fpsLevel, setFpsLevel] = useState<FpsLevel>(settings.defaultFpsLevel)
  const [exportResult, setExportResult] = useState<ExportResult | null>(() => (GATE_FIXTURE === 'success' ? buildGateExportResult() : null))
  const [exportDuration, setExportDuration] = useState(() => (GATE_FIXTURE === 'success' ? 4.2 : 0))
  const [exportFrameCount, setExportFrameCount] = useState(() => (GATE_FIXTURE === 'success' ? 42 : 0))
  const [exportError, setExportError] = useState<string | null>(null)

  const [libraryEntries, setLibraryEntries] = useState<LibraryEntry[]>(() => (
    GATE_FIXTURE === 'library' ? buildGateLibraryEntries() : []
  ))
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [libraryNotice, setLibraryNotice] = useState<string | null>(null)
  const blobCacheRef = useRef<Map<string, Blob>>(new Map())

  const { exportVideo, progress: liveExportProgress } = useExport()
  // ?gate=exporting — đóng băng progress ở 62% (khớp mockup 2b "✓ Ghép MP4 / ● Tạo GIF...")
  // thay vì progress thật của useExport() (chỉ tồn tại trong lúc gọi exportVideo() thật).
  const progress = GATE_FIXTURE === 'exporting' ? { stage: 'gif' as const, percent: 62 } : liveExportProgress

  // Persist settings (F2/F3/F4/F8 — TS-BS-27)
  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  // F3/TS-BS-10 — opacity 0% đồng bộ tắt toggle onion skin
  useEffect(() => {
    if (settings.onionSkinOpacity === 0) setOnionEnabled(false)
  }, [settings.onionSkinOpacity])

  // Load Library metadata from IndexedDB on mount (F7/Q6a) — bỏ qua khi đang ở gate fixture để
  // không ghi đè dữ liệu mẫu đã seed sẵn (buildGateLibraryEntries()).
  useEffect(() => {
    if (GATE_FIXTURE) return
    listLibraryEntries().then(setLibraryEntries).catch(() => { /* IndexedDB unavailable — Library trống */ })
  }, [])

  const refreshHubProjects = useCallback(() => {
    listProjects().then(setHubProjects).catch(() => { /* IndexedDB unavailable — Hub trống */ })
  }, [])

  // T-XW05 AC1 — nạp danh sách dự án mỗi lần Hub hiển thị (mirror iOS `.onAppear` — bắt cả trường
  // hợp quay lại Hub sau khi tạo/xoá dự án ở màn khác). Bỏ qua gate fixture (Hub không dùng trong
  // Visual Diff Gate hiện có).
  useEffect(() => {
    if (GATE_FIXTURE) return
    if (screen === 'hub') refreshHubProjects()
  }, [screen, refreshHubProjects])

  // Thu hồi mọi Object URL frame đã tạo (resume) khi unmount App — dọn sạch cuối vòng đời trang.
  useEffect(() => {
    return () => {
      frameObjectUrlsRef.current.forEach(revokeIfObjectUrl)
    }
  }, [])

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }))
  }, [])

  // F5 — nav khoá khi đang export (TS-BS-15)
  const handleNavigate = useCallback((next: Screen) => {
    if (appState === 'EXPORTING') return
    setScreen(next)
  }, [appState])

  const handleStartWelcome = useCallback(() => {
    setWelcomeSeen(true)
    writeWelcomeSeen()
    setScreen('hub')
  }, [])

  // ---------- T-XW05 — bind Capture vào 1 dự án + resume (mirror iOS CaptureViewModel.bind) ----------

  /** Dọn Object URL frame của phiên trước (nếu có) trước khi nạp dự án mới/rời Capture. */
  const clearCurrentFrameObjectUrls = useCallback(() => {
    frameObjectUrlsRef.current.forEach(revokeIfObjectUrl)
    frameObjectUrlsRef.current = []
  }, [])

  /** AC3 — resume: mở dự án đã có → nạp `frames` cũ từ IndexedDB (đúng thứ tự seq, giữ
   *  `capturedAt`), bind fps/kind/title của dự án, vào thẳng Capture. */
  const handleOpenProject = useCallback(async (id: string) => {
    try {
      const project = await getProject(id)
      if (!project) return

      clearCurrentFrameObjectUrls()
      const loadedFrames: CapturedFrame[] = []
      for (const pf of project.frames) {
        const bytes = await getFrameBytes(id, pf.seq)
        if (!bytes) continue
        const url = arrayBufferToObjectUrl(bytes)
        frameObjectUrlsRef.current.push(url)
        loadedFrames.push({ id: `frame-${id}-${pf.seq}`, dataUrl: url, timestamp: pf.capturedAt })
      }

      setCurrentProjectId(project.id)
      setCurrentProjectKind(project.kind)
      setCurrentProjectTitle(project.title)
      setFpsLevel(project.fpsLevel)
      setFrames(loadedFrames)
      setExportResult(null)
      setExportError(null)
      setAppState('CAPTURING')
      setScreen('capture')
    } catch {
      // IndexedDB lỗi (quota/private mode/dự án hỏng) — ở lại Hub, không crash app.
    }
  }, [clearCurrentFrameObjectUrls])

  /** AC2/AC5 — tạo dự án mới (fpsLevel mặc định theo kind, đã xử lý ở `db.createProject`), vào
   *  thẳng Capture rỗng của dự án đó (0 frame, không cần resume gì). */
  const handleCreateProject = useCallback(async (kind: ProjectKind, title: string) => {
    try {
      const project = await createProject(kind, title)
      clearCurrentFrameObjectUrls()
      setCurrentProjectId(project.id)
      setCurrentProjectKind(project.kind)
      setCurrentProjectTitle(project.title)
      setFpsLevel(project.fpsLevel)
      setFrames([])
      setExportResult(null)
      setExportError(null)
      setAppState('CAPTURING')
      setShowNewProjectSheet(false)
      setScreen('capture')
    } catch {
      // IndexedDB lỗi (quota/private mode) — sheet ở lại mở, con có thể thử lại.
    }
  }, [clearCurrentFrameObjectUrls])

  /** AC5 — xoá dự án (cascade frames ở tầng data layer) + refresh Hub. */
  const handleDeleteProject = useCallback((id: string) => {
    dbDeleteProject(id)
      .then(refreshHubProjects)
      .catch(() => { /* IndexedDB unavailable — Hub tự refresh lần sau */ })
  }, [refreshHubProjects])

  /** T-XW05 autosave — mỗi lần CaptureScreen thêm 1 frame mới, ghi NGAY xuống IndexedDB (bytes
   *  ArrayBuffer, chuyển từ dataURL base64 canvas xuất ra) + cập nhật denorm project cùng 1
   *  transaction (đã có ở data layer, T-XW03). No-op khi không có dự án bind (gate fixture). */
  const handleFrameCaptured = useCallback((frame: CapturedFrame) => {
    if (!currentProjectId) return
    dataUrlToArrayBuffer(frame.dataUrl)
      .then(bytes => dbAddFrame(currentProjectId, bytes, frame.timestamp))
      .catch(() => { /* lưu trữ lỗi (quota/private mode) — không chặn luồng chụp chính */ })
  }, [currentProjectId])

  /** T-XW05 — xoá frame (index trong mảng `frames` LUÔN khớp `seq` IndexedDB — xem ghi chú trong
   *  `src/lib/project/db.ts`: addFrame nối cuối theo `frameCount` hiện có, deleteFrame renumber
   *  liên tục, nên chỉ số mảng và `seq` không bao giờ lệch nhau). */
  const handleFrameDeleted = useCallback((seq: number) => {
    if (!currentProjectId) return
    dbDeleteFrame(currentProjectId, seq).catch(() => { /* ignore */ })
  }, [currentProjectId])

  const handleExport = useCallback(async (currentFrames: CapturedFrame[], currentFps: FpsLevel) => {
    setExportError(null)
    setAppState('EXPORTING')
    try {
      // AC7 — fps qua fpsFor(kind, level); 'animation' default khi không có dự án bind (gate
      // fixture) khớp Y HỆT bảng FPS_VALUES cũ.
      const result = await exportVideo(currentFrames, currentFps, settings.autoUpload, currentProjectKind)
      const durationSeconds = currentFrames.length / fpsFor(currentProjectKind, currentFps)
      setExportResult(result)
      setExportDuration(durationSeconds)
      setExportFrameCount(currentFrames.length)
      setAppState('SUCCESS')

      // AC6 — export KHÔNG đóng dự án: chỉ ghi exportedAt, dự án vẫn còn nguyên trong Hub.
      if (currentProjectId) {
        markProjectExported(currentProjectId).catch(() => { /* ignore — không chặn luồng Success */ })
      }

      // F7 — ghi metadata vào Library (IndexedDB) sau mỗi lần export thành công
      const entryId = `film-${Date.now()}`

      // T-218 — phát Learning Event (Embedded Practice App Contract §4.1). No-op tuyệt đối khi
      // standalone hoặc chưa nhận PRACTICE_CONTEXT đã verify (xem src/lib/neoSteamEmbed.ts).
      emitLearningEvent({
        object: { type: 'project', id: entryId },
        result: {
          success: true,
          completion: true,
          duration: `PT${durationSeconds.toFixed(1)}S`,
          raw: {
            frameCount: currentFrames.length,
            fps: fpsFor(currentProjectKind, currentFps),
            videoDurationSec: durationSeconds,
            format: 'mp4',
          },
        },
      })

      // T-XW05 — frame cuối có thể là Object URL (`blob:`, dự án resume) — quy đổi về `data:`
      // base64 TRƯỚC khi ghi Library, nếu không thumbnail vỡ ảnh sau khi tải lại trang (blob URL
      // không sống sót qua reload, xem ghi chú `toPersistableDataUrl`).
      const lastFrame = currentFrames[currentFrames.length - 1]
      const thumbnailDataUrl = lastFrame ? await toPersistableDataUrl(lastFrame.dataUrl).catch(() => '') : ''

      const entry: LibraryEntry = {
        id: entryId,
        title: currentProjectTitle || `Phim của con · ${new Date().toLocaleDateString('vi-VN')}`,
        thumbnailDataUrl,
        frameCount: currentFrames.length,
        durationSeconds,
        createdAt: Date.now(),
        uploadUrl: result.uploadUrl,
        expiresAt: result.expiresAt,
      }
      blobCacheRef.current.set(entryId, result.blob)
      try {
        await addLibraryEntry(entry)
        setLibraryEntries(prev => [entry, ...prev])
      } catch {
        // IndexedDB không khả dụng — bỏ qua, không chặn luồng export chính
      }
    } catch (err) {
      console.error('Export failed:', err)
      setExportError(label(settings.language, 'states.exportError').main)
      setAppState('CAPTURING')
    }
  }, [exportVideo, settings.autoUpload, settings.language, currentProjectKind, currentProjectId, currentProjectTitle])

  const handleRetryExport = useCallback(() => {
    setExportError(null)
  }, [])

  const handleNewFilm = useCallback(() => {
    // T-XW05 AC6 — dự án ĐÃ persist (frames còn nguyên trong IndexedDB) → về Hub thay vì xoá
    // `frames` tại chỗ (xoá state ở đây KHÔNG xoá dữ liệu đã lưu, sẽ tạo cảm giác sai lệch nếu mở
    // lại dự án và thấy frame "quay lại"). Gate fixture/luồng cũ (không có dự án bind) giữ NGUYÊN
    // hành vi cũ: reset thẳng về Capture rỗng (mobile-interactions.test.mjs B4 dựa vào hành vi này).
    if (currentProjectId) {
      clearCurrentFrameObjectUrls()
      setCurrentProjectId(null)
      setExportResult(null)
      setExportError(null)
      setAppState('CAPTURING')
      setScreen('hub')
      return
    }
    setFrames([])
    setExportResult(null)
    setExportError(null)
    setAppState('CAPTURING')
  }, [currentProjectId, clearCurrentFrameObjectUrls])

  const handleLibraryDelete = useCallback((id: string) => {
    setLibraryEntries(prev => prev.filter(e => e.id !== id))
    deleteLibraryEntry(id).catch(() => { /* ignore */ })
    blobCacheRef.current.delete(id)
  }, [])

  const handleLibraryPlay = useCallback((entry: LibraryEntry) => {
    const cachedBlob = blobCacheRef.current.get(entry.id)
    if (cachedBlob) {
      window.open(URL.createObjectURL(cachedBlob), '_blank')
    } else if (entry.uploadUrl) {
      window.open(entry.uploadUrl, '_blank')
    }
  }, [])

  const handleLibraryUpload = useCallback(async (entry: LibraryEntry) => {
    const cachedBlob = blobCacheRef.current.get(entry.id)
    if (!cachedBlob) {
      // File gốc không còn trong bộ nhớ trình duyệt (đã đóng tab/reload) — giới hạn đã biết của
      // kiến trúc Web Library metadata-only (Q6a). Không crash — báo nhẹ cho bé thay vì im lặng
      // (architect follow-up non-blocking, T-BS10 review).
      setLibraryNotice(label(settings.language, 'library.blobExpired').main)
      return
    }
    setUploadingId(entry.id)
    try {
      const filename = `${entry.title}.mp4`
      const uploaded = await uploadExportedFile(cachedBlob, filename)
      const updated = { ...entry, uploadUrl: uploaded.downloadUrl, expiresAt: uploaded.expiresAt }
      setLibraryEntries(prev => prev.map(e => (e.id === entry.id ? updated : e)))
      await addLibraryEntry(updated)
    } catch {
      // Upload thất bại — badge vẫn "Chưa tải lên", con có thể bấm lại
    } finally {
      setUploadingId(null)
    }
  }, [settings.language])

  if (!welcomeSeen) {
    return <WelcomeScreen language={settings.language} onStart={handleStartWelcome} />
  }

  return (
    <div className={styles.shell}>
      <Sidebar
        screen={screen}
        onNavigate={handleNavigate}
        // Progress card chỉ hiện khi đang CAPTURING (2a) — mockup 2b/2c (shell dùng lại) chỉ có nav 3 mục.
        variant={screen === 'capture' && appState === 'CAPTURING' ? 'full' : 'compact'}
        locked={appState === 'EXPORTING'}
        language={settings.language}
        frameCount={frames.length}
        goalFrames={settings.goalFrames}
        hubProjectCount={hubProjects.length}
      />
      <div className={styles.main} data-landmark="main">
        {screen === 'hub' && (
          <HubScreen
            language={settings.language}
            projects={hubProjects}
            onOpenProject={(id) => void handleOpenProject(id)}
            onNewProject={() => setShowNewProjectSheet(true)}
            onDeleteProject={handleDeleteProject}
          />
        )}
        {screen === 'capture' && appState === 'CAPTURING' && (
          <CaptureScreen
            frames={frames}
            setFrames={setFrames}
            fpsLevel={fpsLevel}
            setFpsLevel={setFpsLevel}
            onExport={handleExport}
            language={settings.language}
            onionOpacity={settings.onionSkinOpacity}
            onionEnabled={onionEnabled}
            setOnionEnabled={setOnionEnabled}
            projectKind={currentProjectKind}
            onFrameCaptured={handleFrameCaptured}
            onFrameDeleted={handleFrameDeleted}
            preferredCameraDeviceId={settings.cameraDeviceId}
            forcedCameraState={GATE_FIXTURE === 'denied' ? 'denied' : undefined}
            initialExportError={GATE_FIXTURE === 'disabled' ? label(settings.language, 'states.minFrames').main : null}
          />
        )}
        {screen === 'capture' && appState === 'EXPORTING' && (
          <ExportProgress
            language={settings.language}
            frameCount={frames.length}
            progress={progress}
            autoUpload={settings.autoUpload}
          />
        )}
        {screen === 'capture' && appState === 'SUCCESS' && exportResult && (
          <SuccessScreen
            result={exportResult}
            onNewFilm={handleNewFilm}
            language={settings.language}
            frameCount={exportFrameCount}
            durationSeconds={exportDuration}
            autoUpload={settings.autoUpload}
          />
        )}
        {screen === 'library' && (
          <LibraryScreen
            language={settings.language}
            entries={libraryEntries}
            onDelete={handleLibraryDelete}
            onPlay={handleLibraryPlay}
            onUpload={(entry) => void handleLibraryUpload(entry)}
            uploadingId={uploadingId}
          />
        )}
        {screen === 'settings' && (
          <SettingsScreen settings={settings} onChange={updateSettings} />
        )}
      </div>

      {showNewProjectSheet && (
        <NewProjectSheet
          language={settings.language}
          onCreate={(kind, title) => void handleCreateProject(kind, title)}
          onClose={() => setShowNewProjectSheet(false)}
        />
      )}

      {exportError && (
        <div role="alert" data-testid="app-export-error" className={styles.toast}>
          <span>{exportError}</span>
          <button onClick={handleRetryExport} data-testid="app-retry-export" className={styles.toastRetry}>
            {label(settings.language, 'states.retry').main}
          </button>
        </div>
      )}

      {libraryNotice && (
        <div role="status" data-testid="app-library-notice" className={`${styles.toast} ${styles.toastInfo}`}>
          <span>{libraryNotice}</span>
          <button
            onClick={() => setLibraryNotice(null)}
            data-testid="app-library-notice-dismiss"
            className={styles.toastRetry}
          >
            {label(settings.language, 'library.qrClose').main}
          </button>
        </div>
      )}
    </div>
  )
}

export default App
