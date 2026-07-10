import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, AppSettings, CapturedFrame, ExportResult, FpsLevel, FPS_VALUES, LibraryEntry, Screen } from './types'
import { loadSettings, saveSettings } from './lib/settingsStore'
import { addLibraryEntry, deleteLibraryEntry, listLibraryEntries } from './lib/libraryDb'
import { label } from './i18n'
import Sidebar from './components/Sidebar'
import WelcomeScreen from './components/WelcomeScreen'
import CaptureScreen from './components/CaptureScreen'
import ExportProgress from './components/ExportProgress'
import SuccessScreen from './components/SuccessScreen'
import LibraryScreen from './components/LibraryScreen'
import SettingsScreen from './components/SettingsScreen'
import { useExport, uploadExportedFile } from './hooks/useExport'
import {
  readGateFixtureParam, buildGateFrames, buildGateExportResult, buildGateLibraryEntries,
} from './lib/gateFixture'
import styles from './App.module.css'

// Visual Diff Gate fixture (T-BS10 AC4 / T-BS11) — xem src/lib/gateFixture.ts. Đọc 1 lần lúc
// module load; không có ?gate=... thì luôn null và app chạy y hệt luồng thật.
const GATE_FIXTURE = readGateFixtureParam()

function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [welcomeSeen, setWelcomeSeen] = useState(() => GATE_FIXTURE !== null) // F6 — KHÔNG persist qua session mới
  const [screen, setScreen] = useState<Screen>(() => (GATE_FIXTURE === 'library' ? 'library' : 'capture'))
  const [onionEnabled, setOnionEnabled] = useState(true)

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
    setScreen('capture')
  }, [])

  const handleExport = useCallback(async (currentFrames: CapturedFrame[], currentFps: FpsLevel) => {
    setExportError(null)
    setAppState('EXPORTING')
    try {
      const result = await exportVideo(currentFrames, currentFps, settings.autoUpload)
      const durationSeconds = currentFrames.length / FPS_VALUES[currentFps]
      setExportResult(result)
      setExportDuration(durationSeconds)
      setExportFrameCount(currentFrames.length)
      setAppState('SUCCESS')

      // F7 — ghi metadata vào Library (IndexedDB) sau mỗi lần export thành công
      const entryId = `film-${Date.now()}`
      const entry: LibraryEntry = {
        id: entryId,
        title: `Phim của con · ${new Date().toLocaleDateString('vi-VN')}`,
        thumbnailDataUrl: currentFrames[currentFrames.length - 1]?.dataUrl ?? '',
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
  }, [exportVideo, settings.autoUpload, settings.language])

  const handleRetryExport = useCallback(() => {
    setExportError(null)
  }, [])

  const handleNewFilm = useCallback(() => {
    setFrames([])
    setExportResult(null)
    setExportError(null)
    setAppState('CAPTURING')
  }, [])

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
      // kiến trúc Web Library metadata-only (Q6a). Không crash, chỉ bỏ qua thao tác.
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
  }, [])

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
      />
      <div className={styles.main} data-landmark="main">
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

      {exportError && (
        <div role="alert" data-testid="app-export-error" className={styles.toast}>
          <span>{exportError}</span>
          <button onClick={handleRetryExport} data-testid="app-retry-export" className={styles.toastRetry}>
            {label(settings.language, 'states.retry').main}
          </button>
        </div>
      )}
    </div>
  )
}

export default App
