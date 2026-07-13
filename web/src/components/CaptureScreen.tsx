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
  /** F8 (T-BS35) — camera đã chọn ở Settings (`settings.cameraDeviceId`), áp dụng lúc mount. */
  preferredCameraDeviceId?: string | null
}

// SVG icon for camera-off state
function CameraOffIcon() {
  return <span className={styles.placeholderIcon} aria-hidden="true">📷🚫</span>
}

/** Ghost-button "Chọn camera khác ▾" (mockup 2d state 2, redline 2d-states.md) hiện khi camera
 *  denied/no-device VÀ còn thiết bị khác để chọn — bấm mở menu liệt kê thiết bị, chọn 1 cái gọi
 *  `switchCamera`. Thay cho `<select>` cũ (điểm hở #3 architect review — không đổi hành vi, chỉ
 *  đổi control cho khớp mockup). Tách component riêng để dùng chung cho state denied + no-device
 *  thay vì lặp JSX 2 lần. */
function CameraDeviceChooser({
  devices, activeDeviceId, onSwitch, language,
}: {
  devices: MediaDeviceInfo[]
  activeDeviceId: string | null
  onSwitch: (deviceId: string) => void
  language: Language
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onOutsideClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [open])

  if (devices.length === 0) return null

  return (
    <div className={styles.cameraChooseWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.cameraSelect}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid="camera-select"
      >
        {label(language, 'states.chooseCamera').main} ▾
      </button>
      {open && (
        <div className={styles.cameraMenu} role="listbox" data-testid="camera-menu">
          {devices.map((d, i) => (
            <button
              key={d.deviceId}
              type="button"
              role="option"
              aria-selected={activeDeviceId === d.deviceId}
              className={styles.cameraMenuItem}
              data-testid={`camera-option-${d.deviceId}`}
              onClick={() => { setOpen(false); onSwitch(d.deviceId) }}
            >
              {d.label || `Camera ${i + 1}`}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CaptureScreen({
  frames, setFrames, fpsLevel, setFpsLevel, onExport,
  language, onionOpacity, onionEnabled, setOnionEnabled,
  forcedCameraState, initialExportError = null, preferredCameraDeviceId,
}: Props) {
  const { videoRef, state: liveCameraState, stream, devices, activeDeviceId, requestCamera, switchCamera, error } = useCamera(preferredCameraDeviceId)
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
              <CameraDeviceChooser
                devices={devices}
                activeDeviceId={activeDeviceId}
                onSwitch={id => void switchCamera(id)}
                language={language}
              />
            </div>
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
              <CameraDeviceChooser
                devices={devices}
                activeDeviceId={activeDeviceId}
                onSwitch={id => void switchCamera(id)}
                language={language}
              />
            </div>
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

        {/* T-BS64 — nút lật camera trước/sau, mọi breakpoint (máy nhiều webcam cần cả desktop),
            cycle vòng tròn qua switchCamera đã có sẵn trong useCamera. */}
        {cameraLive && devices.length > 1 && (
          <button
            type="button"
            className={styles.flipCameraBtn}
            onClick={() => {
              const idx = devices.findIndex(d => d.deviceId === activeDeviceId)
              const next = devices[(idx + 1) % devices.length]
              if (next) void switchCamera(next.deviceId)
            }}
            aria-label={label(language, 'camera.flip').main}
            data-testid="flip-camera-btn"
          >
            🔄
          </button>
        )}

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
            <span className={styles.hintDesktop}>
              {frames.length === 0
                ? 'Bấm Space để chụp frame đầu tiên!'
                : <>{hintPrefix.main} <kbd>Space</kbd> {hintSuffix.main}</>
              }
            </span>
            <span className={styles.hintMobile}>
              {frames.length === 0
                ? label(language, 'hint.captureMobile').main
                : label(language, 'hint.captureMobileNext').main
              }
            </span>
          </div>
        )}
      </div>

      {/* Controls row */}
      <div className={styles.controlsRow}>
        {/* T-BS64 — wrapper riêng để gán CSS `order` trên mobile (order cần áp lên chính flex
            item của .controlsRow, không xuyên qua module CSS của FpsSelector được). */}
        <div className={styles.speedWrap}>
          <FpsSelector value={fpsLevel} onChange={setFpsLevel} />
        </div>

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
          {/* T-BS71 — redline §2.1: bỏ chữ "CHỤP · Snap" cạnh nút chụp trên mobile (chỉ ẩn qua
              CSS .captureLabelWrap; desktop giữ nguyên hiển thị). */}
          <div className={styles.captureLabelWrap}>
            <div className={styles.capLabel}>
              {captureBtnLabel.main} {captureBtnLabel.sub && <span className={styles.capLabelSub}>· {captureBtnLabel.sub}</span>}
            </div>
            <div className={styles.capKeys}><kbd>Space</kbd> hoặc nút xanh IO1 🟢</div>
          </div>
        </div>

        <div className={styles.actionCol}>
          {/* T-BS71 — redline §2.1: hàng 3 nút iOS [🗑|📷|▶]. Trên mobile, actionCol trở thành
              `display:contents` (CSS) để 2 nút này "thoát" ra ngang hàng với captureWrap trong 1
              CSS Grid ở .controlsRow — không đổi onClick/aria-label/hành vi, chỉ thêm class hook
              (actionPlay/actionUndo) + tách icon/text ra 2 span riêng để CSS ẩn phần chữ trên mobile
              (icon-only, giống iOS) mà KHÔNG mất accessible name (vẫn còn aria-label đầy đủ). */}
          <button
            className={`${styles.actionBtn} ${styles.actionPlay}`}
            onClick={handleTogglePreview}
            aria-label={isPreviewMode ? 'Dừng xem lại — phím P hoặc Esc' : 'Xem lại phim — phím P'}
            disabled={frames.length < 2}
            aria-disabled={frames.length < 2}
          >
            <span className={styles.actionIcon} aria-hidden="true">{isPreviewMode ? '⏸' : '▶'}</span>{' '}
            <span className={styles.actionLabelText}>{bilingualText(language, 'action.play')}</span>
            <span className={styles.actionRight}>P</span>
          </button>

          <button
            className={`${styles.actionBtn} ${styles.actionUndo}`}
            onClick={handleDeleteLast}
            aria-label="Xoá frame cuối — phím Del"
            disabled={frames.length === 0}
            aria-disabled={frames.length === 0}
            data-testid="delete-last-btn"
          >
            <span className={styles.actionIcon} aria-hidden="true">🗑</span>{' '}
            <span className={styles.actionLabelText}>{bilingualText(language, 'action.undo')}</span>
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
