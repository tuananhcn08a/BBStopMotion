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

  const { exportVideo, progressMessage } = useExport()

  const handleExport = useCallback(async (currentFrames: CapturedFrame[], currentFps: FpsLevel) => {
    setAppState('EXPORTING')
    try {
      const result = await exportVideo(currentFrames, currentFps)
      setExportResult(result)
      setAppState('SUCCESS')
    } catch {
      // Export failed — go back to CAPTURING with toast handled by ExportProgress
      setAppState('CAPTURING')
    }
  }, [exportVideo])

  const handleNewFilm = useCallback(() => {
    setFrames([])
    setExportResult(null)
    setAppState('CAPTURING')
  }, [])

  return (
    <>
      {appState === 'CAPTURING' && (
        <CaptureScreen
          frames={frames}
          setFrames={setFrames}
          fpsLevel={fpsLevel}
          setFpsLevel={setFpsLevel}
          onExport={handleExport}
        />
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
