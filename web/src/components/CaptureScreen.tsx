import React, { useCallback, useEffect, useRef, useState } from 'react'
import { CapturedFrame, FpsLevel, FPS_VALUES, MIN_FRAMES_TO_EXPORT, FPS_KEYS, Language } from '../types'
import { label, bilingualText } from '../i18n'
import { useCamera, CameraState } from '../hooks/useCamera'
import { useCapture } from '../hooks/useCapture'
import OnionSkin from './OnionSkin'
import Filmstrip from './Filmstrip'
import FpsSelector from './FpsSelector'
import StepIndicator from './StepIndicator'
import styles from './CaptureScreen.module.css'

interface Props {
  frames: CapturedFrame[]
  setFrames: (frames: CapturedFrame[] | ((prev: CapturedFrame[]) => CapturedFrame[])) => void
  fpsLevel: FpsLevel
  setFpsLevel: (level: FpsLevel) => void
  onExport: (frames: CapturedFrame[], fps: FpsLevel) => void
  language: Language
  onionOpacity: number
  onionEnabled: boolean
  setOnionEnabled: (enabled: boolean) => void
  /** Visual Diff Gate only (T-BS11) — ép hiển thị 1 camera state tĩnh (denied/no-device) để
   *  chụp mockup 2d state 2, bất kể hook useCamera() thật đang ở state nào. Không set thì
   *  chạy y hệt luồng thật. Xem `src/lib/gateFixture.ts`. */
  forcedCameraState?: CameraState
  /** Visual Diff Gate only (T-BS11) — giá trị exportError khởi tạo, để chụp mockup 2d state 1
   *  (nút Xuất disabled + toast cảnh báo cùng lúc) mà không cần bấm Enter thật. */
  initialExportError?: string | null
}

// SVG icon for camera-off state
function CameraOffIcon() {
  return <span className={styles.placeholderIcon} aria-hidden="true">📷🚫</span>
}

export default function CaptureScreen({
  frames, setFrames, fpsLevel, setFpsLevel, onExport,
  language, onionOpacity, onionEnabled, setOnionEnabled,
  forcedCameraState, initialExportError = null,
}: Props) {
  const { videoRef, state: liveCameraState, stream, devices, activeDeviceId, requestCamera, switchCamera, error } = useCamera()
  // Gate fixture override (xem Props.forcedCameraState) — mọi logic dưới đây dùng chung biến
  // `state` như cũ, không phân nhánh thêm, nên hành vi thật (không truyền prop) không đổi.
  const state = forcedCameraState ?? liveCameraState
  const { captureFrame, deleteFrameAt, getOnionSkinFrame } = useCapture()

  const [isFlashing, setIsFlashing] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [exportError, setExportError] = useState<string | null>(initialExportError)
  const previewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
    if (!videoRef.current || isPreviewMode || state !== 'live') return
    const frame = captureFrame(videoRef.current)
    if (!frame) return

    setIsFlashing(true)
    setTimeout(() => setIsFlashing(false), 150)

    setFrames(prev => [...prev, frame])
    setExportError(null)
  }, [videoRef, isPreviewMode, state, captureFrame, setFrames])

  const handleDeleteLast = useCallback(() => {
    if (frames.length === 0) return
    setFrames(prev => deleteFrameAt(prev, prev.length - 1))
  }, [frames.length, deleteFrameAt, setFrames])

  // F1 — xoá frame bất kỳ theo index (TS-BS-01/02/03)
  const handleDeleteFrame = useCallback((index: number) => {
    setFrames(prev => deleteFrameAt(prev, index))
  }, [deleteFrameAt, setFrames])

  const handleTogglePreview = useCallback(() => {
    if (frames.length < 2) return
    setIsPreviewMode(prev => {
      if (!prev) setPreviewIndex(0)
      return !prev
    })
  }, [frames.length])

  const handleExport = useCallback(() => {
    if (frames.length < MIN_FRAMES_TO_EXPORT) {
      setExportError(label(language, 'states.minFrames').main)
      return
    }
    setExportError(null)
    onExport(frames, fpsLevel)
  }, [frames, fpsLevel, onExport, language])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
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
  const previewFrame = isPreviewMode && frames[previewIndex] ? frames[previewIndex] : null

  // Camera is ready for capture
  const cameraLive = state === 'live'
  const captureBtnLabel = label(language, 'capture.btn')
  const hintPrefix = label(language, 'hint.capture')
  const hintSuffix = label(language, 'hint.captureSuffix')
  const canExport = frames.length >= MIN_FRAMES_TO_EXPORT

  return (
    <>
      {/* Step indicator + onion toggle */}
      <div className={styles.stepRow} data-landmark="step-indicator">
        <StepIndicator language={language} steps={['active', 'pending', 'pending']} landmarkOnSelf={false} />
        <div className={styles.stepRowSpacer} />
        <button
          type="button"
          className={styles.onionToggle}
          onClick={() => setOnionEnabled(!onionEnabled)}
          aria-pressed={onionEnabled}
          data-landmark="onion-toggle"
          data-testid="onion-toggle"
        >
          👻 {label(language, 'onion.toggle').main}
          <span className={`${styles.switch} ${onionEnabled ? styles.switchOn : ''}`}>
            <span className={styles.switchKnob} />
          </span>
        </button>
      </div>

      {/* Camera preview */}
      <div className={styles.previewBox} data-landmark="camera-preview">
        {state === 'requesting' && (
          <div className={styles.cameraPlaceholder} data-testid="camera-requesting">
            <div className={styles.spinner} aria-label="Đang tải" />
            <p className={styles.placeholderText}>Đang kết nối camera...</p>
          </div>
        )}

        {state === 'denied' && (
          <div className={styles.cameraPlaceholder} data-testid="camera-denied">
            <CameraOffIcon />
            <p className={styles.placeholderText}>
              {error ?? label(language, 'states.cameraDenied').main}
            </p>
            <div className={styles.placeholderActions}>
              <button
                className={styles.retrySmall}
                onClick={() => void requestCamera()}
                data-testid="retry-button"
              >
                {label(language, 'states.retry').main}
              </button>
            </div>
            {devices.length > 0 && (
              <select
                className={styles.cameraSelect}
                value={activeDeviceId ?? ''}
                onChange={e => void switchCamera(e.target.value)}
                aria-label={label(language, 'states.chooseCamera').main}
                data-testid="camera-select"
              >
                <option value="" disabled>{label(language, 'states.chooseCamera').main}</option>
                {devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {state === 'no-device' && (
          <div className={styles.cameraPlaceholder} data-testid="camera-no-device">
            <CameraOffIcon />
            <p className={styles.placeholderText}>
              Không tìm thấy camera. Con thử cắm camera vào rồi bấm Thử lại nhé!
            </p>
            <div className={styles.placeholderActions}>
              <button
                className={styles.retrySmall}
                onClick={() => void requestCamera()}
                data-testid="retry-button"
              >
                {label(language, 'states.retry').main}
              </button>
            </div>
            {devices.length > 0 && (
              <select
                className={styles.cameraSelect}
                value={activeDeviceId ?? ''}
                onChange={e => void switchCamera(e.target.value)}
                aria-label={label(language, 'states.chooseCamera').main}
                data-testid="camera-select"
              >
                <option value="" disabled>{label(language, 'states.chooseCamera').main}</option>
                {devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Video is always rendered (needed for capture); hidden unless live */}
        <video
          ref={videoRef as React.RefObject<HTMLVideoElement>}
          className={`${styles.video} ${!cameraLive || isPreviewMode ? styles.hidden : ''}`}
          autoPlay
          playsInline
          muted
          aria-label="Live camera preview"
          data-testid="camera-video"
        />

        {isPreviewMode && previewFrame && (
          <img
            src={previewFrame.dataUrl}
            alt={`Xem lại frame ${previewIndex + 1}`}
            className={styles.previewFrameImg}
          />
        )}

        <OnionSkin
          frame={onionSkinFrame}
          visible={cameraLive && !isPreviewMode && onionEnabled && frames.length > 0}
          opacity={onionOpacity}
        />

        {isFlashing && <div className={styles.flash} aria-hidden="true" data-testid="capture-flash" />}

        <div className={styles.frameCounter} data-landmark="frame-counter">
          <div className={styles.frameNum}>{frames.length}</div>
          <div className={styles.frameLabel}>{label(language, 'frame.counter').main} · ≈ {estimatedSeconds}s</div>
        </div>

        {cameraLive && (
          <div className={styles.liveBadge}>
            {isPreviewMode
              ? <span className={styles.previewBadge}>XEMPHIM</span>
              : <><div className={styles.liveDot} /><span>{label(language, 'live.badge').main}</span></>
            }
          </div>
        )}

        {cameraLive && !isPreviewMode && (
          <div className={styles.previewHint}>
            {frames.length === 0
              ? 'Bấm Space để chụp frame đầu tiên!'
              : <>{hintPrefix.main} <kbd>Space</kbd> {hintSuffix.main}</>
            }
          </div>
        )}
      </div>

      {/* Controls row */}
      <div className={styles.controlsRow}>
        <FpsSelector value={fpsLevel} onChange={setFpsLevel} />

        <div className={styles.captureWrap}>
          <button
            className={styles.captureBtn}
            onClick={handleCapture}
            aria-label="Chụp frame — phím Space"
            disabled={!cameraLive || isPreviewMode}
            style={{ opacity: cameraLive && !isPreviewMode ? 1 : 0.4 }}
            data-landmark="capture-btn"
          >
            📷
          </button>
          <div>
            <div className={styles.capLabel}>
              {captureBtnLabel.main} {captureBtnLabel.sub && <span className={styles.capLabelSub}>· {captureBtnLabel.sub}</span>}
            </div>
            <div className={styles.capKeys}><kbd>Space</kbd> hoặc nút xanh IO1 🟢</div>
          </div>
        </div>

        <div className={styles.actionCol}>
          <button
            className={styles.actionBtn}
            onClick={handleTogglePreview}
            aria-label={isPreviewMode ? 'Dừng xem lại — phím P hoặc Esc' : 'Xem lại phim — phím P'}
            disabled={frames.length < 2}
            aria-disabled={frames.length < 2}
          >
            {isPreviewMode ? '⏸' : '▶'} {bilingualText(language, 'action.play')}
            <span className={styles.actionRight}>P</span>
          </button>

          <button
            className={styles.actionBtn}
            onClick={handleDeleteLast}
            aria-label="Xoá frame cuối — phím Del"
            disabled={frames.length === 0}
            aria-disabled={frames.length === 0}
          >
            🗑 {bilingualText(language, 'action.undo')}
            <span className={styles.actionRight}>Del</span>
          </button>

          <button
            className={`${styles.actionBtn} ${canExport ? styles.actionExport : styles.actionExportDisabled}`}
            onClick={handleExport}
            aria-label="Xuất phim — phím Enter"
            data-landmark="export-btn"
          >
            🎬 {bilingualText(language, 'action.export')}
            <span className={styles.actionRight}>Enter</span>
          </button>

          {exportError && (
            <div className={styles.exportError} role="alert" data-testid="export-error">
              {exportError}
            </div>
          )}
        </div>
      </div>

      {/* Filmstrip */}
      <Filmstrip
        frames={frames}
        selectedIndex={frames.length - 1}
        language={language}
        onDeleteFrame={handleDeleteFrame}
        disabled={isPreviewMode}
      />
    </>
  )
}
