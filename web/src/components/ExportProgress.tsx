import { Language } from '../types'
import { label } from '../i18n'
import { ExportProgressState, ExportStage } from '../hooks/useExport'
import StepIndicator from './StepIndicator'
import styles from './ExportProgress.module.css'

interface Props {
  language: Language
  frameCount: number
  progress: ExportProgressState
  /** F8/Q6b — auto-upload OFF bỏ 2 giai đoạn Tải lên cloud/Tạo QR (TS-BS-28). */
  autoUpload: boolean
}

const STAGE_ORDER: ExportStage[] = ['mp4', 'gif', 'upload', 'qr']

function stageStatus(stage: ExportStage, current: ExportStage): 'done' | 'active' | 'pending' {
  const curIdx = STAGE_ORDER.indexOf(current)
  const idx = STAGE_ORDER.indexOf(stage)
  if (idx < curIdx) return 'done'
  if (idx === curIdx) return 'active'
  return 'pending'
}

export default function ExportProgress({ language, frameCount, progress, autoUpload }: Props) {
  const visibleStages: ExportStage[] = autoUpload ? STAGE_ORDER : ['mp4', 'gif']
  const title = label(language, 'export.title')
  const stageLabels: Record<ExportStage, string> = {
    mp4: label(language, 'export.stageMp4').main,
    gif: label(language, 'export.stageGif').main,
    upload: label(language, 'export.stageUpload').main,
    qr: label(language, 'export.stageQr').main,
  }

  return (
    <>
      <StepIndicator
        language={language}
        steps={['done', 'active', 'pending']}
        captureDoneSuffix={`${frameCount} frame`}
      />
      <div className={styles.wrap}>
        <div className={styles.card} role="status" aria-live="polite" aria-label="Đang tạo phim" data-landmark="progress-card">
          <div className={styles.icon}>🎬</div>
          <h1 className={styles.title}>{title.main}</h1>
          <p className={styles.sub}>{frameCount} frame · MP4 + GIF</p>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${progress.percent}%` }} data-testid="export-progress-fill" />
          </div>
          <div className={styles.stages}>
            {visibleStages.map(stage => {
              const status = stageStatus(stage, progress.stage)
              const cls = status === 'done' ? styles.stageDone : status === 'active' ? styles.stageActive : ''
              const prefix = status === 'done' ? '✓ ' : status === 'active' ? '● ' : ''
              return (
                <span key={stage} className={cls}>{prefix}{stageLabels[stage]}{status === 'active' ? '...' : ''}</span>
              )
            })}
          </div>
          <div className={styles.banner}>⏳ {label(language, 'export.waitBanner').main}</div>
        </div>
      </div>
    </>
  )
}
