import { useEffect, useState } from 'react'
import { Language } from '../types'
import { ProjectMeta } from '../lib/project/types'
import { fpsFor } from '../lib/project/fps'
import { getFrameBytes } from '../lib/project/db'
import { arrayBufferToObjectUrl, revokeIfObjectUrl } from '../lib/project/frameBytes'
import { label } from '../i18n'
import styles from './HubScreen.module.css'

interface Props {
  language: Language
  projects: ProjectMeta[]
  onOpenProject: (id: string) => void
  onNewProject: () => void
  onDeleteProject: (id: string) => void
}

/** T-XW05 §S1 — thumbnail cover frame, tra qua `getFrameBytes(id, coverFrameSeq)` → Object URL.
 *  Tách component riêng để mỗi card tự quản lý vòng đời Object URL của MÌNH (tạo lúc mount/đổi
 *  project, thu hồi lúc unmount) — tránh 1 effect lớn ở HubScreen phải track N URL thủ công. */
function ProjectThumb({ project }: { project: ProjectMeta }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let createdUrl: string | null = null
    if (project.coverFrameSeq !== undefined) {
      getFrameBytes(project.id, project.coverFrameSeq).then(bytes => {
        if (cancelled || !bytes) return
        createdUrl = arrayBufferToObjectUrl(bytes)
        setThumbUrl(createdUrl)
      }).catch(() => { /* dự án chưa có frame/lỗi đọc — fallback icon kind bên dưới */ })
    }
    return () => {
      cancelled = true
      if (createdUrl) revokeIfObjectUrl(createdUrl)
    }
  }, [project.id, project.coverFrameSeq])

  const kindClass = project.kind === 'diary' ? styles.thumbDiary : styles.thumbAnimation

  return (
    <div className={`${styles.thumb} ${kindClass}`} data-testid={`hub-thumb-${project.id}`}>
      {thumbUrl
        ? <img src={thumbUrl} alt="" className={styles.thumbImg} />
        : <span aria-hidden="true">{project.kind === 'diary' ? '🌱' : '🎭'}</span>
      }
    </div>
  )
}

function projectMetaLine(language: Language, project: ProjectMeta): string {
  const kindLabel = project.kind === 'diary'
    ? label(language, 'hub.kindDiary').main
    : label(language, 'hub.kindAnimation').main
  const unitLabel = project.kind === 'diary'
    ? label(language, 'hub.photoUnit').main
    : label(language, 'hub.frameUnit').main
  const fps = fpsFor(project.kind, project.fpsLevel)
  const seconds = fps > 0 ? (project.frameCount / fps).toFixed(1) : '0.0'
  const kindIcon = project.kind === 'diary' ? '🌱' : '🎭'
  return `${kindIcon} ${kindLabel} · ${project.frameCount} ${unitLabel} · ~${seconds.replace('.', ',')}s`
}

export default function HubScreen({ language, projects, onOpenProject, onNewProject, onDeleteProject }: Props) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (!menuOpenId) return
    const closeMenu = () => setMenuOpenId(null)
    document.addEventListener('click', closeMenu)
    return () => document.removeEventListener('click', closeMenu)
  }, [menuOpenId])

  const handleDeleteClick = (project: ProjectMeta) => {
    setMenuOpenId(null)
    const confirmMsg = `${label(language, 'hub.deleteConfirm').main}\n\n"${project.title}"`
    if (window.confirm(confirmMsg)) {
      onDeleteProject(project.id)
    }
  }

  return (
    <div className={styles.screen} data-landmark="hub-screen">
      <div className={styles.headRow}>
        <div className={styles.greet}>
          {label(language, 'hub.greeting').main}
          <span className={styles.greetSub}>Your film studio</span>
        </div>
        {projects.length > 0 && (
          <div className={styles.countPill} data-testid="hub-count-pill">
            {projects.length} dự án
          </div>
        )}
      </div>

      <div className={styles.list}>
        <button
          type="button"
          className={styles.newProject}
          onClick={onNewProject}
          data-testid="hub-new-project-card"
          aria-label={`${label(language, 'hub.newProjectTitle').main}, ${label(language, 'hub.newProjectSub').main}`}
        >
          <span className={styles.newProjectPlus} aria-hidden="true">＋</span>
          <span className={styles.newProjectTxt}>
            <b>{label(language, 'hub.newProjectTitle').main}</b>
            <span className={styles.newProjectSub}>{label(language, 'hub.newProjectSub').main}</span>
          </span>
        </button>

        {projects.length === 0 && (
          <div className={styles.emptyHint} data-testid="hub-empty-hint">
            {label(language, 'hub.empty').main}
          </div>
        )}

        {projects.map(project => {
          const exported = project.exportedAt !== undefined
          return (
            <div
              key={project.id}
              className={styles.card}
              data-testid={`hub-project-${project.id}`}
              onClick={() => onOpenProject(project.id)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onOpenProject(project.id) }}
            >
              <ProjectThumb project={project} />
              <div className={styles.info}>
                <div className={styles.name}>{project.title}</div>
                <div className={styles.meta}>{projectMetaLine(language, project)}</div>
                <span className={`${styles.chip} ${exported ? styles.chipDone : styles.chipTodo}`}>
                  {exported ? label(language, 'hub.chipExported').main : label(language, 'hub.chipInProgress').main}
                </span>
              </div>
              <div className={styles.actions} onClick={e => e.stopPropagation()}>
                <div className={styles.menuWrap}>
                  <button
                    type="button"
                    className={styles.menuBtn}
                    onClick={() => setMenuOpenId(cur => (cur === project.id ? null : project.id))}
                    aria-label={`${label(language, 'hub.menu').main} — ${project.title}`}
                    aria-haspopup="menu"
                    aria-expanded={menuOpenId === project.id}
                    data-testid={`hub-project-menu-${project.id}`}
                  >
                    ⋯
                  </button>
                  {menuOpenId === project.id && (
                    <div className={styles.menu} role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        className={styles.menuItemDanger}
                        onClick={() => handleDeleteClick(project)}
                        data-testid={`hub-project-delete-${project.id}`}
                      >
                        🗑 {label(language, 'hub.deleteProject').main}
                      </button>
                    </div>
                  )}
                </div>
                <span className={styles.go} aria-hidden="true">›</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
