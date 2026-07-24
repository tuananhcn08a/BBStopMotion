import { useState } from 'react'
import { Language } from '../types'
import { ProjectKind } from '../lib/project/types'
import { label } from '../i18n'
import styles from './NewProjectSheet.module.css'

interface Props {
  language: Language
  onCreate: (kind: ProjectKind, title: string) => void
  onClose: () => void
}

// T-XW05 §S2 — pool tên gợi ý, NGUYÊN VĂN từ `NewProjectSheetiOS.swift` dòng 29-36 (Q1 — BA/PO
// chưa chốt danh sách chính thức, apple-dev chọn tạm 6 tên/thể loại; web-dev copy nguyên, KHÔNG
// bịa tên mới, để 2 nền nhất quán cho tới khi BA/PO chốt bản chính thức).
const ANIMATION_NAMES = [
  'Khủng long phiêu lưu', 'Chú mèo học bay', 'Rô-bốt nhảy múa',
  'Công chúa và rồng', 'Siêu xe bay', 'Bữa tiệc đồ chơi',
]
const DIARY_NAMES = [
  'Cây đậu của em', 'Nhật ký lớn lên', 'Chậu hoa nhỏ',
  'Chú cún lớn nhanh', 'Vườn rau của em', 'Hạt mầm kỳ diệu',
]

function randomName(kind: ProjectKind): string {
  const pool = kind === 'diary' ? DIARY_NAMES : ANIMATION_NAMES
  return pool[Math.floor(Math.random() * pool.length)] ?? pool[0]
}

export default function NewProjectSheet({ language, onCreate, onClose }: Props) {
  // Mặc định 🎭 Hoạt hình được chọn sẵn (mockup §S2 + iOS `selectedKind: ProjectKind = .animation`).
  const [kind, setKind] = useState<ProjectKind>('animation')
  const [name, setName] = useState<string>(() => randomName('animation'))

  const selectKind = (next: ProjectKind) => {
    setKind(next)
    setName(randomName(next))
  }

  const handleCreate = () => {
    onCreate(kind, name)
  }

  return (
    <div className={styles.backdrop} data-testid="new-project-backdrop" onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={label(language, 'sheet.title').main}
        data-testid="new-project-sheet"
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.grabber} aria-hidden="true" />
        <div className={styles.title}>
          {label(language, 'sheet.title').main}
          <small>New project</small>
        </div>

        <div className={styles.typeGrid} role="group" aria-label={label(language, 'sheet.title').main}>
          <button
            type="button"
            className={`${styles.typeCard} ${kind === 'animation' ? styles.selected : ''}`}
            onClick={() => selectKind('animation')}
            aria-pressed={kind === 'animation'}
            data-testid="new-project-type-animation"
          >
            <span className={styles.typeIcon} aria-hidden="true">🎭</span>
            <b>{label(language, 'sheet.typeAnimationTitle').main}</b>
            <span>{label(language, 'sheet.typeAnimationDesc').main}</span>
          </button>
          <button
            type="button"
            className={`${styles.typeCard} ${kind === 'diary' ? styles.selected : ''}`}
            onClick={() => selectKind('diary')}
            aria-pressed={kind === 'diary'}
            data-testid="new-project-type-diary"
          >
            <span className={styles.typeIcon} aria-hidden="true">🌱</span>
            <b>{label(language, 'sheet.typeDiaryTitle').main}</b>
            <span>{label(language, 'sheet.typeDiaryDesc').main}</span>
          </button>
        </div>

        {kind === 'diary' && (
          <div className={styles.diaryHint}>{label(language, 'sheet.diaryHint').main}</div>
        )}

        <div>
          <div className={styles.fieldLabel}>{label(language, 'sheet.nameLabel').main}</div>
          <div className={styles.nameInputWrap}>
            <input
              type="text"
              className={styles.nameInput}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={label(language, 'sheet.namePlaceholder').main}
              aria-label={label(language, 'sheet.nameLabel').main}
              data-testid="new-project-name-input"
            />
            {name.length > 0 && (
              <button
                type="button"
                className={styles.nameClear}
                onClick={() => setName('')}
                aria-label={label(language, 'sheet.nameClear').main}
                data-testid="new-project-name-clear"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          className={styles.cta}
          onClick={handleCreate}
          data-testid="new-project-cta"
        >
          {label(language, 'sheet.cta').main}
        </button>

        {/* Wave-6 — `.bbsproj` import chưa làm ở task này; hiện nút disabled + hint để không hứa
            hẹn tính năng chưa có (mockup §S2, nút hiện nhưng vô hiệu). */}
        <div className={styles.openFileHint} aria-disabled="true" data-testid="new-project-open-file">
          📂 {label(language, 'sheet.openFile').main}
        </div>
      </div>
    </div>
  )
}
