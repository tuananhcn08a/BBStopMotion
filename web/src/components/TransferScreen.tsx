/**
 * T-XW21 (S6) — Chuyển máy & sao lưu (mirror mockup T-XW18 §2, quyết định #13). Cầu nối
 * iOS↔web qua `.bbsproj` (ZIP STORE, xem `bbsprojArchive.ts`) — giải 2 bài toán cùng lúc: đổi
 * máy/nền tảng làm tiếp, VÀ bản sao lưu. Điểm vào: nút "⋯" trên thẻ dự án (Hub).
 *
 * Cấu trúc GIỐNG HỆT desktop/mobile (mockup ghi rõ, khác S5) — chỉ khác input chọn file.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Language } from '../types'
import { ProjectMeta } from '../lib/project/types'
import {
  DuplicateResolution, ImportErrorCode, ParsedImport,
  commitParsedImport, exportProjectToBbsproj, parseBbsprojFile,
} from '../lib/project/bbsprojArchive'
import { BBSPROJ_ERROR_LABEL_KEY } from '../lib/project/bbsprojErrorLabel'
import { listProjects } from '../lib/project/db'
import { label } from '../i18n'
import styles from './TransferScreen.module.css'

interface Props {
  language: Language
  /** Dự án đang mở từ Hub card menu — mặc định mục tiêu của "Xuất file dự án". */
  project: ProjectMeta
  onClose: () => void
  /** Gọi sau khi nhập (commit) thành công — App.tsx refresh danh sách Hub. */
  onImported: () => void
}

type ExportState =
  | { kind: 'idle' }
  | { kind: 'ready'; fileName: string; sizeLabel: string; objectUrl: string }
  | { kind: 'error' }

type ImportState =
  | { kind: 'idle' }
  | { kind: 'importing' }
  | { kind: 'duplicate'; parsed: ParsedImport }
  | { kind: 'success' }
  | { kind: 'error'; code: ImportErrorCode }

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function TransferScreen({ language, project, onClose, onImported }: Props) {
  const [exportState, setExportState] = useState<ExportState>({ kind: 'idle' })
  const [importState, setImportState] = useState<ImportState>({ kind: 'idle' })
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  // AC1/mockup — "LUÔN hiện tên file + dung lượng THẬT (không phải ước lượng)" TRƯỚC khi bấm →
  // build blob NGAY lúc mở màn, không chờ tới lúc bấm mới xuất.
  useEffect(() => {
    let cancelled = false
    exportProjectToBbsproj(project.id).then(result => {
      if (cancelled) return
      if (!result) {
        setExportState({ kind: 'error' })
        return
      }
      const objectUrl = URL.createObjectURL(result.blob)
      objectUrlRef.current = objectUrl
      setExportState({ kind: 'ready', fileName: result.fileName, sizeLabel: formatBytes(result.blob.size), objectUrl })
    }).catch(() => { if (!cancelled) setExportState({ kind: 'error' }) })
    return () => {
      cancelled = true
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [project.id])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setImportState({ kind: 'importing' })
    const existing = await listProjects().catch(() => [])
    const existingIds = new Set(existing.map(p => p.id))
    const result = await parseBbsprojFile(file, existingIds)

    if (!result.ok) {
      setImportState({ kind: 'error', code: result.error })
      return
    }
    if (result.value.isDuplicateId) {
      setImportState({ kind: 'duplicate', parsed: result.value })
      return
    }
    await commitParsedImport(result.value, 'notDuplicate')
    setImportState({ kind: 'success' })
    onImported()
  }, [onImported])

  const resolveDuplicate = useCallback(async (resolution: DuplicateResolution) => {
    if (importState.kind !== 'duplicate') return
    if (resolution === 'notDuplicate') {
      // "Huỷ" — bỏ qua hoàn toàn, không ghi gì.
      setImportState({ kind: 'idle' })
      return
    }
    setImportState({ kind: 'importing' })
    await commitParsedImport(importState.parsed, resolution)
    setImportState({ kind: 'success' })
    onImported()
  }, [importState, onImported])

  return (
    <div className={styles.backdrop} data-testid="transfer-backdrop" onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={label(language, 'transfer.title').main}
        data-testid="transfer-screen"
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.grabber} aria-hidden="true" />
        <div className={styles.title}>
          {label(language, 'transfer.title').main}
          <small>{label(language, 'transfer.title').sub ?? 'Move & back up'}</small>
        </div>

        <div className={styles.syncDiagram} aria-hidden="true">
          <div className={styles.syncNode}><span className={styles.ico}>💻</span><span>Web</span></div>
          <span className={styles.syncArrow}>⇄</span>
          <div className={styles.syncNode}><span className={styles.ico}>📄</span><span>.bbsproj</span></div>
          <span className={styles.syncArrow}>⇄</span>
          <div className={styles.syncNode}><span className={styles.ico}>📱</span><span>App iOS</span></div>
        </div>

        {exportState.kind === 'ready' ? (
          <a
            className={styles.optCard}
            href={exportState.objectUrl}
            download={exportState.fileName}
            data-testid="transfer-export-link"
          >
            <span className={styles.ico} aria-hidden="true">📦</span>
            <div>
              <b>{label(language, 'transfer.exportOption').main}</b>
              <span>
                <span className={styles.file}>{exportState.fileName}</span> · {exportState.sizeLabel}
              </span>
            </div>
          </a>
        ) : exportState.kind === 'error' ? (
          <div className={styles.optCard} data-testid="transfer-export-error">
            <span className={styles.ico} aria-hidden="true">⚠️</span>
            <div><b>{label(language, 'transfer.exportError').main}</b></div>
          </div>
        ) : (
          <div className={styles.optCard} data-testid="transfer-export-loading">
            <span className={styles.ico} aria-hidden="true">📦</span>
            <div><b>{label(language, 'transfer.exporting').main}</b></div>
          </div>
        )}

        {importState.kind === 'duplicate' ? (
          <div className={styles.duplicateBox} data-testid="transfer-duplicate-box">
            <b>{label(language, 'transfer.duplicateTitle').main}</b>
            <p>{label(language, 'transfer.duplicateBody').main}</p>
            <div className={styles.duplicateActions}>
              <button type="button" className={styles.optCard} onClick={() => resolveDuplicate('overwrite')} data-testid="transfer-duplicate-overwrite">
                {label(language, 'transfer.duplicateOverwrite').main}
              </button>
              <button type="button" className={styles.optCard} onClick={() => resolveDuplicate('duplicate')} data-testid="transfer-duplicate-duplicate">
                {label(language, 'transfer.duplicateDuplicate').main}
              </button>
              <button type="button" className={styles.ctaGhost} onClick={() => resolveDuplicate('notDuplicate')} data-testid="transfer-duplicate-cancel">
                {label(language, 'transfer.duplicateCancel').main}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={styles.optCard}
            onClick={handleImportClick}
            disabled={importState.kind === 'importing'}
            data-testid="transfer-import-btn"
          >
            <span className={styles.ico} aria-hidden="true">📂</span>
            <div>
              <b>{label(language, 'transfer.importOption').main}</b>
              <span>{label(language, 'transfer.importOptionDesc').main}</span>
            </div>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".bbsproj,.zip"
          className={styles.hiddenInput}
          onChange={e => void handleFileChange(e)}
          data-testid="transfer-import-file-input"
          tabIndex={-1}
          aria-hidden="true"
        />

        {importState.kind === 'importing' && (
          <div className={styles.statusNote} data-testid="transfer-importing">{label(language, 'transfer.importing').main}</div>
        )}
        {importState.kind === 'success' && (
          <div className={styles.growCard} data-testid="transfer-import-success">{label(language, 'transfer.importSuccess').main}</div>
        )}
        {importState.kind === 'error' && (
          <div className={styles.errorNote} data-testid="transfer-import-error">
            {label(language, BBSPROJ_ERROR_LABEL_KEY[importState.code]).main}
          </div>
        )}

        <div className={styles.growCard}>{label(language, 'transfer.backupNote').main}</div>

        <button type="button" className={styles.ctaGhost} onClick={onClose} data-testid="transfer-close-btn">
          {label(language, 'transfer.close').main}
        </button>
      </div>
    </div>
  )
}
