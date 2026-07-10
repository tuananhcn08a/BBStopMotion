import { Language } from './types'

/** Bilingual string entry — VN chính · EN phụ. Nguồn: spec.md §6. */
interface Bi {
  vi: string
  en: string
}

/**
 * Toàn bộ copy song ngữ dùng trong app — key đặt theo khu vực UI để dễ tra cứu.
 * Nguồn: docs/01-specs/features/neo-stopmotion/bright-studio-redesign/spec.md §6.
 */
export const STRINGS = {
  'nav.capture': { vi: 'Chụp phim', en: 'Capture' },
  'nav.library': { vi: 'Thư viện phim', en: 'Library' },
  'nav.settings': { vi: 'Cài đặt', en: 'Settings' },
  'nav.help': { vi: 'Trợ giúp', en: 'Help' },
  'wordmark.studio': { vi: 'studio', en: 'studio' },
  'progress.label': { vi: 'TIẾN ĐỘ', en: 'PROGRESS' },
  'progress.frameUnit': { vi: 'frame', en: 'frames' },
  'progress.goalReached': {
    vi: 'Đã đạt mục tiêu, con vẫn có thể chụp thêm nếu muốn!',
    en: 'Goal reached — keep going if you like!',
  },
  'progress.remaining': { vi: 'Chụp thêm', en: '' },
  'progress.remainingSuffix': { vi: 'nữa là phim đủ mượt!', en: '' },
  'thingbot.title': { vi: 'ThingBot', en: 'ThingBot' },
  'thingbot.connected': { vi: 'Đã kết nối', en: 'Connected' },
  'thingbot.disconnected': { vi: 'Chưa kết nối', en: 'Not connected' },
  'step.capture': { vi: 'Chụp', en: 'Capture' },
  'step.export': { vi: 'Xuất', en: 'Export' },
  'step.share': { vi: 'Chia sẻ', en: 'Share' },
  'onion.toggle': { vi: 'Onion skin', en: 'Onion skin' },
  'live.badge': { vi: 'LIVE', en: 'LIVE' },
  'frame.counter': { vi: 'FRAME', en: 'FRAME' },
  'hint.capture': { vi: 'Bấm', en: 'Press' },
  'hint.captureSuffix': { vi: 'hoặc nút xanh IO1 🟢 để chụp', en: 'or the green IO1 button 🟢 to capture' },
  'speed.label': { vi: 'TỐC ĐỘ', en: 'SPEED' },
  'speed.slow': { vi: 'Chậm', en: 'Slow' },
  'speed.normal': { vi: 'Thường', en: 'Normal' },
  'speed.fast': { vi: 'Nhanh', en: 'Fast' },
  'capture.btn': { vi: 'CHỤP', en: 'Snap' },
  'action.play': { vi: 'Xem lại phim', en: 'Play' },
  'action.undo': { vi: 'Xoá frame cuối', en: 'Undo' },
  'action.export': { vi: 'Xuất phim!', en: 'Export!' },
  'filmstrip.title': { vi: 'CÁC FRAME ĐÃ CHỤP', en: 'CAPTURED FRAMES' },
  'filmstrip.hint': {
    vi: 'Rê chuột lên frame để xem lại hoặc xoá frame bất kỳ',
    en: 'Hover a frame to preview or delete it',
  },
  'export.title': { vi: 'Đang ghép phim của con...', en: 'Creating your movie...' },
  'export.stageMp4': { vi: 'Ghép MP4', en: 'Compose MP4' },
  'export.stageGif': { vi: 'Tạo GIF', en: 'Create GIF' },
  'export.stageUpload': { vi: 'Tải lên cloud', en: 'Upload to cloud' },
  'export.stageQr': { vi: 'Tạo QR', en: 'Generate QR' },
  'export.waitBanner': {
    vi: 'Chờ chút xíu nha, con đừng tắt màn hình nhé!',
    en: "Just a moment — please don't close this screen!",
  },
  'success.title': { vi: 'Phim của con xong rồi! 🌟', en: 'Your movie is ready! 🌟' },
  'success.scan': { vi: 'Bố mẹ quét để tải phim 📱', en: 'Ask a parent to scan & download 📱' },
  'success.download': { vi: 'Tải về máy', en: 'Download' },
  'success.newFilm': { vi: 'Làm phim mới', en: 'New film' },
  'success.uploadFailed': {
    vi: 'Tải lên chưa được — con vẫn có thể tải phim về máy nhé!',
    en: 'Upload failed — you can still download the movie to your device!',
  },
  'success.retryUpload': { vi: 'Thử tải lên lại', en: 'Retry upload' },
  'success.notUploadedYet': {
    vi: 'Chưa tải lên — bấm nút bên dưới nếu con muốn có mã QR để chia sẻ',
    en: 'Not uploaded yet — tap below if you’d like a QR code to share',
  },
  'success.uploadNow': { vi: 'Tải lên ngay', en: 'Upload now' },
  'states.minFrames': {
    vi: 'Cần ít nhất 5 frame — con chụp thêm vài tấm nữa nha!',
    en: 'You need at least 5 frames — capture a few more!',
  },
  'states.cameraDenied': { vi: 'Con chưa cho app dùng camera', en: "You haven't allowed camera access" },
  'states.retry': { vi: 'Thử lại', en: 'Try again' },
  'states.chooseCamera': { vi: 'Chọn camera khác', en: 'Choose another camera' },
  'states.exportError': {
    vi: 'Ôi, ghép phim bị lỗi rồi. Con thử lại nhé!',
    en: 'Oops, something went wrong creating the movie. Try again!',
  },
  'welcome.title': { vi: 'Chào mừng đến xưởng phim!', en: 'Welcome to the movie studio!' },
  'welcome.cta': { vi: 'Bắt đầu làm phim! 🚀', en: 'Start making a movie! 🚀' },
  'library.search': { vi: 'Tìm phim theo tên...', en: 'Search movies by name...' },
  'library.filterAll': { vi: 'Tất cả', en: 'All' },
  'library.filterToday': { vi: 'Hôm nay', en: 'Today' },
  'library.filterWeek': { vi: 'Tuần này', en: 'This week' },
  'library.uploaded': { vi: 'Đã tải lên', en: 'Uploaded' },
  'library.notUploaded': { vi: 'Chưa tải lên', en: 'Not uploaded' },
  'library.play': { vi: 'Xem', en: 'Play' },
  'library.upload': { vi: 'Tải lên', en: 'Upload' },
  'library.delete': { vi: 'Xoá phim', en: 'Delete' },
  'library.deleteConfirm': { vi: 'Xoá phim này?', en: 'Delete this film?' },
  'library.empty': { vi: 'Chưa có phim nào trong thư viện', en: 'No films in your library yet' },
  'settings.title': { vi: 'Cài đặt', en: 'Settings' },
  'settings.subtitle': { vi: '(dành cho Thợ Cả)', en: '(for the Studio Lead)' },
  'settings.camera': { vi: 'Camera', en: 'Camera' },
  'settings.onion': { vi: 'Onion skin', en: 'Onion skin' },
  'settings.defaultSpeed': { vi: 'Tốc độ mặc định', en: 'Default speed' },
  'settings.language': { vi: 'Ngôn ngữ', en: 'Language' },
  'settings.langBoth': { vi: 'Việt+EN', en: 'Vietnamese+EN' },
  'settings.langVi': { vi: 'Tiếng Việt', en: 'Vietnamese' },
  'settings.langEn': { vi: 'English', en: 'English' },
  'settings.sound': { vi: 'Âm "tách"', en: 'Shutter sound' },
  'settings.goalFrames': { vi: 'Mục tiêu frame', en: 'Frame goal' },
  'settings.autoUpload': { vi: 'Tải lên cloud tự động', en: 'Auto-upload to cloud' },
  'settings.thingbot': { vi: 'Nút ThingBot', en: 'ThingBot button' },
} satisfies Record<string, Bi>

export type StringKey = keyof typeof STRINGS

export interface LabelParts {
  main: string
  sub: string | null
}

/**
 * Áp `language` (F4) lên 1 cặp VN/EN → { main, sub }.
 * - 'vi+en': main=VN, sub=EN (nhỏ hơn, phụ)
 * - 'vi': main=VN, sub=null
 * - 'en': main=EN, sub=null
 */
export function label(language: Language, key: StringKey): LabelParts {
  const entry = STRINGS[key]
  if (language === 'en') return { main: entry.en, sub: null }
  if (language === 'vi') return { main: entry.vi, sub: null }
  return { main: entry.vi, sub: entry.en || null }
}

/** Tiện ích lấy riêng main text (dùng khi không cần hậu tố EN, vd aria-label). */
export function mainText(language: Language, key: StringKey): string {
  return label(language, key).main
}
