import { useState, useCallback } from 'react'
import { AppState, CapturedFrame, ExportResult, FpsLevel } from './types'
import CaptureScreen from './components/CaptureScreen'
import ExportProgress from './components/ExportProgress'
import SuccessScreen from './components/SuccessScreen'
import { useExport } from './hooks/useExport'

function App() {
  const [appState, setAppState] = useState<AppState>('CAPTURING')
  const [frames, setFrames] = useState<CapturedFrame[]>([])
  const [fpsLevel, setFpsLevel] = useState<FpsLevel>('normal')
  const [exportResult, setExportResult] = useState<ExportResult | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const { exportVideo, progressMessage } = useExport()

  const handleExport = useCallback(async (currentFrames: CapturedFrame[], currentFps: FpsLevel) => {
    setExportError(null)
    setAppState('EXPORTING')
    try {
      const result = await exportVideo(currentFrames, currentFps)
      setExportResult(result)
      setAppState('SUCCESS')
    } catch (err) {
      console.error('Export failed:', err)
      setExportError('Ôi, ghép phim bị lỗi rồi. Con thử lại nhé!')
      setAppState('CAPTURING')
    }
  }, [exportVideo])

  const handleRetryExport = useCallback(() => {
    setExportError(null)
  }, [])

  const handleNewFilm = useCallback(() => {
    setFrames([])
    setExportResult(null)
    setExportError(null)
    setAppState('CAPTURING')
  }, [])

  return (
    <>
      {appState === 'CAPTURING' && (
        <>
          <CaptureScreen
            frames={frames}
            setFrames={setFrames}
            fpsLevel={fpsLevel}
            setFpsLevel={setFpsLevel}
            onExport={handleExport}
          />
          {exportError && (
            <div
              role="alert"
              data-testid="app-export-error"
              style={{
                position: 'fixed',
                bottom: '80px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#c0392b',
                color: '#fff',
                padding: '12px 24px',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                zIndex: 999,
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              }}
            >
              <span>{exportError}</span>
              <button
                onClick={handleRetryExport}
                data-testid="app-retry-export"
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  border: '1.5px solid rgba(255,255,255,0.5)',
                  borderRadius: '8px',
                  padding: '4px 14px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                }}
              >
                Thử lại
              </button>
            </div>
          )}
        </>
      )}
      {appState === 'EXPORTING' && (
        <ExportProgress message={progressMessage} />
      )}
      {appState === 'SUCCESS' && exportResult && (
        <SuccessScreen
          result={exportResult}
          onNewFilm={handleNewFilm}
        />
      )}
    </>
  )
}

export default App
