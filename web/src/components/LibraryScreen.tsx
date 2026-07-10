import { useMemo, useState } from 'react'
import { Language, LibraryEntry } from '../types'
import { label, bilingualText } from '../i18n'
import { matchesSearch } from '../lib/text'
import styles from './LibraryScreen.module.css'

interface Props {
  language: Language
  entries: LibraryEntry[]
  onDelete: (id: string) => void
  onPlay: (entry: LibraryEntry) => void
  onUpload: (entry: LibraryEntry) => void
  uploadingId: string | null
}

type Filter = 'all' | 'today' | 'week'

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function groupLabel(ts: number, language: Language): string {
  const today = startOfDay(Date.now())
  const day = startOfDay(ts)
  const diffDays = Math.round((today - day) / 86400000)
  const dateStr = new Date(ts).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' })
  if (diffDays === 0) return language === 'en' ? `TODAY · ${dateStr}` : `HÔM NAY · ${dateStr.toUpperCase()}`
  if (diffDays === 1) return language === 'en' ? `YESTERDAY · ${dateStr}` : `HÔM QUA · ${dateStr.toUpperCase()}`
  return dateStr.toUpperCase()
}

export default function LibraryScreen({ language, entries, onDelete, onPlay, onUpload, uploadingId }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const today = startOfDay(Date.now())
    const weekAgo = today - 6 * 86400000
    return entries
      .filter(e => matchesSearch(e.title, query))
      .filter(e => {
        if (filter === 'all') return true
        if (filter === 'today') return startOfDay(e.createdAt) === today
        return startOfDay(e.createdAt) >= weekAgo
      })
  }, [entries, query, filter])

  const groups = useMemo(() => {
    const map = new Map<string, LibraryEntry[]>()
    for (const entry of filtered) {
      const key = groupLabel(entry.createdAt, language)
      const arr = map.get(key) ?? []
      arr.push(entry)
      map.set(key, arr)
    }
    return Array.from(map.entries())
  }, [filtered, language])

  const handleDeleteClick = (id: string) => {
    if (confirmDeleteId === id) {
      onDelete(id)
      setConfirmDeleteId(null)
      setOpenMenuId(null)
    } else {
      setConfirmDeleteId(id)
    }
  }

  return (
    <div data-landmark="library-screen">
      <div className={styles.topRow}>
        <div className={styles.search}>
          🔍
          <input
            type="text"
            placeholder={bilingualText(language, 'library.search')}
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label={bilingualText(language, 'library.search')}
            data-testid="library-search"
          />
        </div>
        <div className={styles.filters}>
          {(['all', 'today', 'week'] as Filter[]).map(f => (
            <button
              key={f}
              className={`${styles.filterChip} ${filter === f ? styles.filterChipActive : ''}`}
              onClick={() => setFilter(f)}
              data-testid={`filter-${f}`}
            >
              {f === 'all' && label(language, 'library.filterAll').main}
              {f === 'today' && label(language, 'library.filterToday').main}
              {f === 'week' && label(language, 'library.filterWeek').main}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 && (
        <div className={styles.empty}>{label(language, 'library.empty').main}</div>
      )}

      {groups.map(([groupName, groupEntries]) => (
        <div key={groupName}>
          <div className={styles.groupHeader}>{groupName}</div>
          <div className={styles.rows}>
            {groupEntries.map(entry => {
              const hasUpload = Boolean(entry.uploadUrl)
              const isUploading = uploadingId === entry.id
              // Index toàn cục (không phải index trong nhóm) — khớp thứ tự hiển thị top-to-bottom
              // để đặt tên landmark `library-row-{i}-*` nhất quán với mockup khi so bằng Visual Diff Gate.
              const rowIndex = filtered.indexOf(entry)
              const metaPrefix = entry.childName ? `${entry.childName} · ` : ''
              return (
                <div
                  className={styles.row}
                  key={entry.id}
                  data-testid={`library-row-${entry.id}`}
                  data-landmark={`library-row-${rowIndex}`}
                >
                  <img
                    src={entry.thumbnailDataUrl}
                    alt={entry.title}
                    className={styles.thumb}
                    data-landmark={`library-row-${rowIndex}-thumb`}
                  />
                  <div className={styles.info}>
                    <div className={styles.filmTitle} data-landmark={`library-row-${rowIndex}-title`}>{entry.title}</div>
                    <div className={styles.meta} data-landmark={`library-row-${rowIndex}-meta`}>
                      {metaPrefix}{entry.frameCount} frame · {entry.durationSeconds.toFixed(1)}s ·{' '}
                      {new Date(entry.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <span
                    className={`${styles.badge} ${hasUpload ? styles.badgeUploaded : styles.badgeNotUploaded}`}
                    data-landmark={`library-row-${rowIndex}-badge`}
                  >
                    {hasUpload ? `✓ ${label(language, 'library.uploaded').main}` : `⚠ ${label(language, 'library.notUploaded').main}`}
                  </span>
                  {hasUpload ? (
                    <button className={styles.btnSecondary} data-testid={`qr-${entry.id}`}>QR</button>
                  ) : (
                    <button
                      className={styles.btnSecondary}
                      onClick={() => onUpload(entry)}
                      disabled={isUploading}
                      data-testid={`upload-${entry.id}`}
                    >
                      {isUploading ? '...' : `↻ ${label(language, 'library.upload').main}`}
                    </button>
                  )}
                  <button
                    className={styles.btnPrimary}
                    onClick={() => onPlay(entry)}
                    data-testid={`play-${entry.id}`}
                    data-landmark={`library-row-${rowIndex}-btn`}
                  >
                    ▶ {label(language, 'library.play').main}
                  </button>
                  <div className={styles.menuWrap}>
                    <button
                      className={styles.menuBtn}
                      onClick={() => setOpenMenuId(openMenuId === entry.id ? null : entry.id)}
                      aria-label="Thêm tuỳ chọn"
                      data-testid={`menu-${entry.id}`}
                    >
                      ⋯
                    </button>
                    {openMenuId === entry.id && (
                      <div className={styles.menuPopover}>
                        <button className={styles.menuItem} onClick={() => handleDeleteClick(entry.id)} data-testid={`delete-${entry.id}`}>
                          {confirmDeleteId === entry.id
                            ? label(language, 'library.deleteConfirm').main
                            : `🗑 ${label(language, 'library.delete').main}`}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
