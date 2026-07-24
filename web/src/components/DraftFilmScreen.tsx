import { useCallback, useEffect, useRef, useState } from 'react'
import { CapturedFrame, FpsLevel, Language, MIN_FRAMES_TO_EXPORT } from '../types'
import { ProjectKind } from '../lib/project/types'
import { fpsFor } from '../lib/project/fps'
import {
  capturedDaysCount as calcCapturedDaysCount, endOfMonthDurationSeconds, diaryTodayCount, diaryPhotoPositionLast,
} from '../lib/project/diary'
import { exportToMp4 } from '../hooks/useExport'
import { label } from '../i18n'
import styles from './DraftFilmScreen.module.css'

interface Props {
  language: Language
  projectTitle: string
  projectKind: ProjectKind
  frames: CapturedFrame[]
  fpsLevel: FpsLevel
  /** "Chụp tiếp" — đóng phim nháp, quay lại Capture (KHÔNG xoá dự án, T-XP13 quyết định #10). */
  onBack: () => void
  /** "Xuất phim hoàn chỉnh" — dùng lại luồng export chính (App.tsx `handleExport`). */
  onExportFull: () => void
}

/**
 * T-XW10 AC6 — S4 Phim nháp, mirror `DraftFilmScreeniOS`. Xem được BẤT KỲ LÚC NÀO (kể cả 2 frame),
 * CTA chính "Chụp tiếp" (giữ dự án mở — KHÔNG đóng), export hoàn chỉnh là hành động PHỤ.
 *
 * Khác iOS (`draftService.buildDraft` tự build lại MỖI LẦN đổi số frame qua `.task(id:)`): web build
 * phim nháp LAZY — chỉ ghép (ffmpeg.wasm, tái dùng `exportToMp4`) khi bé bấm ▶ xem, không tự động
 * chạy lại ffmpeg mỗi lần chụp thêm 1 ảnh (tốn CPU/pin không cần thiết khi bé đang mải chụp liên
 * tục) — quyết định phạm vi wave-3, không phải AC yêu cầu build tự động.
 */
export default function DraftFilmScreen({
  language, projectTitle, projectKind, frames, fpsLevel, onBack, onExportFull,
}: Props) {
  const [draftUrl, setDraftUrl] = useState<string | null>(null)
  const [isBuilding, setIsBuilding] = useState(false)
  const [buildError, setBuildError] = useState<string | null>(null)
  const draftUrlRef = useRef<string | null>(null)

  const isDiary = projectKind === 'diary'
  const fps = fpsFor(projectKind, fpsLevel)
  const capturedAtMs = frames.map(f => f.timestamp)
  const capturedDaysCount = isDiary ? calcCapturedDaysCount(capturedAtMs) : 0
  const durationSeconds = frames.length > 0 ? frames.length / fps : 0
  const projectedSeconds = isDiary ? endOfMonthDurationSeconds(capturedAtMs, fps) : null
  const canExportFull = frames.length >= MIN_FRAMES_TO_EXPORT
  const diaryPosition = diaryPhotoPositionLast(frames.length)

  // Thu hồi Object URL cũ khi tạo bản mới/unmount — tránh rò rỉ bộ nhớ.
  useEffect(() => {
    return () => {
      if (draftUrlRef.current) URL.revokeObjectURL(draftUrlRef.current)
    }
  }, [])

  const handlePlay = useCallback(async () => {
    if (frames.length === 0) return
    setIsBuilding(true)
    setBuildError(null)
    try {
      const blob = await exportToMp4(frames.map(f => f.dataUrl), fps)
      if (draftUrlRef.current) URL.revokeObjectURL(draftUrlRef.current)
      const url = URL.createObjectURL(blob)
      draftUrlRef.current = url
      setDraftUrl(url)
    } catch {
      setBuildError(label(language, 'draft.error').main)
    } finally {
      setIsBuilding(false)
    }
  }, [frames, fps, language])

  const ctaPrimaryText = !isDiary
    ? label(language, 'draft.captureNextAnimation').main
    : diaryTodayCount(capturedAtMs) > 0
      ? label(language, 'draft.captureNextTomorrowDiary').main
      : label(language, 'draft.captureNextTodayDiary').main

  const growTitle = language === 'en'
    ? `You've captured ${capturedDaysCount} days in a row!`
    : `Con đã chụp đều ${capturedDaysCount} ngày!`
  const growBody = projectedSeconds !== null
    ? (language === 'en'
      ? `Keep it up — by the end of the month your film could be about ${projectedSeconds.toFixed(1)}s long!`
      : `Cứ chụp đều thế này, cuối tháng phim sẽ dài khoảng ${projectedSeconds.toFixed(1).replace('.', ',')} giây!`)
    : ''

  return (
    <div data-landmark="draft-film-screen">
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label={label(language, 'draft.back').main} data-testid="draft-back-btn">
          ‹
        </button>
        <div className={styles.title}>{projectTitle}</div>
        {isDiary && diaryPosition !== null && (
          <div className={styles.chip}>🌱 Ảnh {diaryPosition}/{diaryPosition}</div>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.videoArea}>
          {frames.length === 0 ? (
            <div className={styles.emptyState}>
              <span aria-hidden="true">🎬</span>
              <p>{label(language, 'draft.empty').main}</p>
            </div>
          ) : draftUrl ? (
            <video src={draftUrl} controls autoPlay className={styles.video} data-testid="draft-video" />
          ) : buildError ? (
            <div className={styles.emptyState}>
              <p>{buildError}</p>
              <button type="button" className={styles.retryBtn} onClick={() => void handlePlay()}>
                {label(language, 'states.retry').main}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={styles.playBtn}
              onClick={() => void handlePlay()}
              disabled={isBuilding}
              aria-label={label(language, 'draft.viewDraft').main}
              data-testid="draft-play-btn"
            >
              {isBuilding ? '…' : '▶'}
            </button>
          )}
        </div>

        {frames.length > 0 && (
          <>
            <div className={styles.meta} data-testid="draft-meta">
              {frames.length} {label(language, isDiary ? 'diary.photoUnit' : 'hub.frameUnit').main}
              {isDiary && <> · {capturedDaysCount} {label(language, 'draft.days').main}</>}
              {' · '}~{durationSeconds.toFixed(1)}s
            </div>

            {isDiary && (
              capturedDaysCount >= 2 && projectedSeconds !== null ? (
                <div className={styles.growCard} data-testid="draft-grow-card">
                  <div className={styles.growTitle}>🌟 {growTitle}</div>
                  <div className={styles.growBody}>{growBody}</div>
                </div>
              ) : (
                <div className={styles.neutralCard} data-testid="draft-neutral-card">
                  {label(language, 'draft.neutral').main}
                </div>
              )
            )}

            <button type="button" className={styles.ctaPrimary} onClick={onBack} data-testid="draft-cta-primary">
              {ctaPrimaryText}
            </button>
            <button
              type="button"
              className={styles.ctaSecondary}
              onClick={onExportFull}
              disabled={!canExportFull}
              data-testid="draft-cta-export"
            >
              🎬 {label(language, 'draft.exportFull').main}
            </button>
            <div className={styles.note}>{label(language, 'draft.note').main}</div>
          </>
        )}
      </div>
    </div>
  )
}
