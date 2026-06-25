import React, { useCallback, useEffect, useRef, useState } from 'react'
import { CapturedFrame, FpsLevel, FPS_VALUES, MIN_FRAMES_TO_EXPORT, FPS_KEYS } from '../types'
import { useCamera } from '../hooks/useCamera'
import { useCapture } from '../hooks/useCapture'
import OnionSkin from './OnionSkin'
import Filmstrip from './Filmstrip'
import FpsSelector from './FpsSelector'
import styles from './CaptureScreen.module.css'

interface Props {
  frames: CapturedFrame[]
  setFrames: (frames: CapturedFrame[] | ((prev: CapturedFrame[]) => CapturedFrame[])) => void
  fpsLevel: FpsLevel
  setFpsLevel: (level: FpsLevel) => void
  onExport: (frames: CapturedFrame[], fps: FpsLevel) => void
}

export default function CaptureScreen({ frames, setFrames, fpsLevel, setFpsLevel, onExport }: Props) {
  const { videoRef, status, requestCamera, stream } = useCamera()
  const { captureFrame, deleteLastFrame, getOnionSkinFrame } = useCapture()

  const [isFlashing, setIsFlashing] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [exportError, setExportError] = useState<string | null>(null)
  const previewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start camera on mount
  useEffect(() => {
    void requestCamera()
  }, [requestCamera])

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream, videoRef])

  // Preview mode interval
  useEffect(() => {
    if (isPreviewMode && frames.length >= 2) {
      const interval = 1000 / FPS_VALUES[fpsLevel]
      previewIntervalRef.current = setInterval(() => {
        setPreviewIndex(prev => {
          const next = prev + 1
          if (next >= frames.length) {
            // Stop at end
            clearInterval(previewIntervalRef.current ?? undefined)
            setIsPreviewMode(false)
            return 0
          }
          return next
        })
      }, interval)
    } else {
      if (previewIntervalRef.current) clearInterval(previewIntervalRef.current)
    }
    return () => {
      if (previewIntervalRef.current) clearInterval(previewIntervalRef.current)
    }
  }, [isPreviewMode, frames.length, fpsLevel])

  const handleCapture = useCallback(() => {
    if (!videoRef.current || isPreviewMode) return
    const frame = captureFrame(videoRef.current)
    if (!frame) return

    // Flash effect
    setIsFlashing(true)
    setTimeout(() => setIsFlashing(false), 150)

    setFrames(prev => [...prev, frame])
    setExportError(null)
  }, [videoRef, isPreviewMode, captureFrame, setFrames])

  const handleDeleteLast = useCallback(() => {
    if (frames.length === 0) return
    setFrames(prev => deleteLastFrame(prev))
  }, [frames.length, deleteLastFrame, setFrames])

  const handleTogglePreview = useCallback(() => {
    if (frames.length < 2) return
    setIsPreviewMode(prev => {
      if (!prev) setPreviewIndex(0)
      return !prev
    })
  }, [frames.length])

  const handleExport = useCallback(() => {
    if (frames.length < MIN_FRAMES_TO_EXPORT) {
      setExportError(`Con cần ít nhất ${MIN_FRAMES_TO_EXPORT} frame để tạo phim nhé!`)
      return
    }
    setExportError(null)
    onExport(frames, fpsLevel)
  }, [frames, fpsLevel, onExport])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't capture keys when focus is in a button/input
      if (e.target instanceof HTMLButtonElement) return

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          handleCapture()
          break
        case 'Delete':
        case 'Backspace':
          e.preventDefault()
          handleDeleteLast()
          break
        case 'KeyP':
          e.preventDefault()
          handleTogglePreview()
          break
        case 'Enter':
          e.preventDefault()
          handleExport()
          break
        case 'Escape':
          if (isPreviewMode) {
            setIsPreviewMode(false)
            setPreviewIndex(0)
          }
          break
        case 'Digit1':
        case 'Digit2':
        case 'Digit3': {
          const key = e.key
          const level = FPS_KEYS[key]
          if (level) setFpsLevel(level)
          break
        }
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleCapture, handleDeleteLast, handleTogglePreview, handleExport, isPreviewMode, setFpsLevel])

  const onionSkinFrame = getOnionSkinFrame(frames)
  const fps = FPS_VALUES[fpsLevel]
  const estimatedSeconds = frames.length > 0 ? (frames.length / fps).toFixed(1) : '0.0'

  // Preview mode: show the frame at previewIndex
  const previewFrame = isPreviewMode && frames[previewIndex] ? frames[previewIndex] : null

  return (
    <div className={styles.app}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>🎬</div>
          <span className={styles.brandName}>Xưởng phim của bé</span>
        </div>
        <div className={styles.steps}>
          <span className={styles.stepDone}>Chọn camera</span>
          <span className={styles.stepSep}>›</span>
          <span className={styles.stepActive}>Chụp frame</span>
          <span className={styles.stepSep}>›</span>
          <span className={styles.stepPending}>Xuất phim</span>
        </div>
        <div className={styles.toolbarRight} />
      </div>

      {/* Main content */}
      <div className={styles.main}>
        {/* Preview column */}
        <div className={styles.previewCol}>
          <div className={styles.previewBox}>
            {/* Live video (hidden in preview mode) */}
            <video
              ref={videoRef as React.RefObject<HTMLVideoElement>}
              className={`${styles.video} ${isPreviewMode ? styles.hidden : ''}`}
              autoPlay
              playsInline
              muted
              aria-label="Live camera preview"
            />

            {/* Preview mode: show captured frame */}
            {isPreviewMode && previewFrame && (
              <img
                src={previewFrame.dataUrl}
                alt={`Xem lại frame ${previewIndex + 1}`}
                className={styles.previewFrameImg}
              />
            )}

            {/* Onion skin — hidden in preview mode */}
            <OnionSkin
              frame={onionSkinFrame}
              visible={!isPreviewMode && frames.length > 0}
            />

            {/* Flash overlay */}
            {isFlashing && <div className={styles.flash} aria-hidden="true" />}

            {/* Camera disconnected overlay */}
            {status === 'disconnected' && (
              <div className={styles.disconnectOverlay} role="alert">
                <p>Camera bị ngắt. Bấm Thử lại.</p>
                <button onClick={() => void requestCamera()} className={styles.retrySmall}>
                  Thử lại
                </button>
              </div>
            )}

            {/* Frame counter */}
            <div className={styles.frameCounter}>
              <div className={styles.frameNum}>{frames.length}</div>
              <div className={styles.frameLabel}>FRAME</div>
              <div className={styles.frameDur}>≈ {estimatedSeconds} giây</div>
            </div>

            {/* LIVE / XEMPHIM badge */}
            <div className={styles.liveBadge}>
              {isPreviewMode
                ? <span className={styles.previewBadge}>XEMPHIM</span>
                : <><div className={styles.liveDot} /><span>LIVE</span></>
              }
            </div>

            {/* Hint */}
            <div className={styles.previewHint}>
              {frames.length === 0
                ? 'Bấm Space để chụp frame đầu tiên!'
                : 'Bấm Space để chụp'
              }
            </div>
          </div>
        </div>

        {/* Controls column */}
        <div className={styles.controlsCol}>
          <FpsSelector value={fpsLevel} onChange={setFpsLevel} />

          {/* Capture button */}
          <div className={styles.captureWrap}>
            <button
              className={styles.captureBtn}
              onClick={handleCapture}
              aria-label="Chụp frame — phím Space"
              disabled={isPreviewMode}
            >
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
            <div className={styles.capLabel}>CHỤP</div>
            <div className={styles.capKeys}>
              <kbd>Space</kbd>
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.actionCol}>
            {/* Preview button */}
            <button
              className={`${styles.actionBtn} ${styles.actionPreview}`}
              onClick={handleTogglePreview}
              aria-label={isPreviewMode ? 'Dừng xem lại — phím P hoặc Esc' : 'Xem lại phim — phím P'}
              disabled={frames.length < 2}
              aria-disabled={frames.length < 2}
            >
              {isPreviewMode ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              )}
              {isPreviewMode ? 'Dừng xem lại' : 'Xem lại phim'}
              <span className={styles.actionRight}><kbd>P</kbd></span>
            </button>

            {/* Delete button */}
            <button
              className={`${styles.actionBtn} ${styles.actionDelete}`}
              onClick={handleDeleteLast}
              aria-label="Xoá frame cuối — phím Del"
              disabled={frames.length === 0}
              aria-disabled={frames.length === 0}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              </svg>
              Xoá frame cuối
              <span className={styles.actionRight}><kbd>Del</kbd></span>
            </button>

            {/* Export button */}
            <button
              className={`${styles.actionBtn} ${styles.actionExport}`}
              onClick={handleExport}
              aria-label="Xuất phim — phím Enter"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Xuất phim!
              <span className={styles.actionRight}><kbd>Enter</kbd></span>
            </button>

            {/* Export error message */}
            {exportError && (
              <div className={styles.exportError} role="alert" data-testid="export-error">
                {exportError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filmstrip */}
      <Filmstrip frames={frames} selectedIndex={frames.length - 1} />

      {/* Footer */}
      <div className={styles.footer}>
        <div className={styles.footerItem}><kbd>Space</kbd> <strong>Chụp</strong></div>
        <div className={styles.footerSep} />
        <div className={styles.footerItem}><kbd>Del</kbd> <strong>Xoá cuối</strong></div>
        <div className={styles.footerSep} />
        <div className={styles.footerItem}><kbd>P</kbd> <strong>Xem lại</strong></div>
        <div className={styles.footerSep} />
        <div className={styles.footerItem}><kbd>Enter</kbd> <strong>Xuất phim</strong></div>
        <div className={styles.footerSep} />
        <div className={styles.footerItem}><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> <strong>Tốc độ</strong></div>
      </div>
    </div>
  )
}
