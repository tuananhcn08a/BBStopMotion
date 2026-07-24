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
  // T-XW05 — nav item 1 đổi từ "Chụp phim" (thẳng vào Capture) sang "Xưởng phim" (Hub đa dự án).
  // Giữ nguyên key 'nav.capture' cũ (không xoá — bilingual-audit.test.tsx còn tham chiếu).
  'nav.hub': { vi: 'Xưởng phim', en: 'Film studio' },
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
  // Redline: "không có bản EN riêng" cho câu động viên VN gốc — BA suy diễn thêm bản EN để
  // language='en' không hiện chuỗi rỗng (tránh câu bị cụt khi chuyển hẳn sang tiếng Anh).
  'progress.remaining': { vi: 'Chụp thêm', en: 'Capture' },
  'progress.remainingSuffix': { vi: 'nữa là phim đủ mượt!', en: 'more for a smooth movie!' },
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
  // T-BS64 — bản mobile của hint chụp: ngôn ngữ chạm, không kbd chip (bấm phím vô nghĩa trên cảm ứng).
  'hint.captureMobile': { vi: 'Chạm 📷 để chụp frame đầu tiên!', en: 'Tap 📷 to capture your first frame!' },
  'hint.captureMobileNext': { vi: 'Chạm 📷 để chụp tiếp', en: 'Tap 📷 to keep capturing' },
  'camera.flip': { vi: 'Đổi camera trước/sau', en: 'Switch camera' },
  'speed.label': { vi: 'TỐC ĐỘ', en: 'SPEED' },
  'speed.slow': { vi: 'Chậm', en: 'Slow' },
  'speed.normal': { vi: 'Thường', en: 'Normal' },
  'speed.fast': { vi: 'Nhanh', en: 'Fast' },
  'capture.btn': { vi: 'CHỤP', en: 'Snap' },
  'action.play': { vi: 'Xem lại phim', en: 'Play' },
  'action.undo': { vi: 'Xoá frame cuối', en: 'Undo' },
  // Redline 2a literal mockup text: "🎬 Xuất phim! · Export" (KHÔNG có "!" sau Export — khác
  // spec.md §6 copy table ghi "Export!"). Giữ đúng mockup vì cột hành động cố định 250px —
  // thêm "!" khiến "Xuất phim! · Export!" tràn dòng (bug T-BS11, phát hiện khi tự re-gate 2a).
  'action.export': { vi: 'Xuất phim!', en: 'Export' },
  'filmstrip.title': { vi: 'CÁC FRAME ĐÃ CHỤP', en: 'CAPTURED FRAMES' },
  'filmstrip.hint': {
    vi: 'Rê chuột lên frame để xem lại hoặc xoá frame bất kỳ',
    en: 'Hover a frame to preview or delete it',
  },
  // T-BS64 — copy mobile đúng sự thật (chỉ xoá được, KHÔNG có tính năng "xem lại" khi chạm/hover
  // 1 frame — Coordinator đã chốt không hứa hẹn tính năng chưa tồn tại).
  // T-BS71 (wave-8 iOS parity) — × trên từng thumbnail đã BỎ trên mobile (redline §2.4, đối chiếu
  // iOS không có × trên frame); câu cũ "Chạm × để xoá frame" không còn đúng sự thật nữa nên sửa
  // lại theo đúng affordance mới (nút 🗑 ở hàng 3 nút, xoá frame CUỐI). Đây là sửa copy hiển thị đi
  // kèm bắt buộc theo thay đổi thị giác/layout của T-BS71, KHÔNG đổi logic i18n hay hành vi xoá.
  'filmstrip.hintMobile': { vi: 'Chạm 🗑 để xoá frame cuối', en: 'Tap 🗑 to delete the last frame' },
  // ---------- T-XW14 — chế độ "🔀 Sắp xếp" transactional (thay nút "×" xoá-ngay cũ) ----------
  'filmstrip.sortEnter': { vi: 'Sắp xếp', en: 'Reorder' },
  'filmstrip.sortHint': { vi: 'Chạm để chọn · giữ để kéo', en: 'Tap to select · hold to drag' },
  'filmstrip.sortUndo': { vi: 'Huỷ', en: 'Undo' },
  'filmstrip.sortDone': { vi: 'Xong', en: 'Done' },
  'filmstrip.sortDeleteChip': { vi: 'Xoá', en: 'Delete' },
  'filmstrip.sortDeleteConfirm': {
    vi: 'Xoá các ảnh đã chọn? Không lấy lại được sau khi bấm "✕ Xong" đâu nhé.',
    en: 'Delete the selected photos? This can\'t be undone after you tap "✕ Done".',
  },
  // ---------- T-XW17 AC2 — slot "🖼️ Thêm" import ảnh từ máy vào dự án ----------
  'filmstrip.importLabel': { vi: 'Thêm', en: 'Add' },
  'filmstrip.importAria': { vi: 'Thêm ảnh từ máy', en: 'Add photos from device' },
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
  // Redline 1d literal: "Bắt đầu làm phim! · Start 🚀" — emoji render riêng ở component (WelcomeScreen.tsx).
  'welcome.cta': { vi: 'Bắt đầu làm phim!', en: 'Start' },
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
  'library.qrTitle': { vi: 'Mã QR chia sẻ phim', en: 'Share QR code' },
  'library.qrClose': { vi: 'Đóng', en: 'Close' },
  'library.qrNotUploaded': {
    vi: 'Phim chưa tải lên — bấm ↻ Tải lên trước nhé.',
    en: 'This film has not been uploaded yet — tap ↻ Upload first.',
  },
  'library.blobExpired': {
    vi: 'File phim này đã hết trên máy (đóng tab hoặc tải lại trang) — con làm phim mới để tải lên nhé!',
    en: 'This film file is no longer on this device (tab closed or page reloaded) — make a new film to upload!',
  },
  'settings.title': { vi: 'Cài đặt', en: 'Settings' },
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

  // ---------- T-XW05 — S1 Hub Xưởng phim + S2 Sheet tạo dự án ----------
  'hub.greeting': { vi: 'Chào con! Hôm nay làm phim gì?', en: 'Hi! What are we filming today?' },
  'hub.newProjectTitle': { vi: 'Dự án mới', en: 'New project' },
  'hub.newProjectSub': { vi: 'Hoạt hình hoặc nhật ký', en: 'Animation or diary' },
  'hub.empty': {
    vi: 'Chưa có dự án nào — bấm "＋ Dự án mới" để bắt đầu làm phim đầu tiên nhé! 🎬',
    en: 'No projects yet — tap "+ New project" to start your first film! 🎬',
  },
  'hub.menu': { vi: 'Tuỳ chọn khác', en: 'More options' },
  'hub.deleteProject': { vi: 'Xoá dự án', en: 'Delete project' },
  'hub.deleteConfirm': {
    vi: 'Xoá dự án này? Tất cả ảnh và phim nháp sẽ mất luôn, không lấy lại được đâu nhé.',
    en: "Delete this project? All photos and drafts will be gone for good — this can't be undone.",
  },
  'hub.chipExported': { vi: '✓ Đã xuất phim', en: '✓ Exported' },
  'hub.chipInProgress': { vi: '🎬 Đang làm', en: '🎬 In progress' },
  'hub.kindAnimation': { vi: 'Hoạt hình', en: 'Animation' },
  'hub.kindDiary': { vi: 'Nhật ký', en: 'Diary' },
  'hub.frameUnit': { vi: 'frame', en: 'frames' },
  'hub.photoUnit': { vi: 'ảnh', en: 'photos' },
  'hub.openProject': { vi: 'Mở dự án', en: 'Open project' },
  'sheet.title': { vi: 'Dự án mới', en: 'New project' },
  'sheet.typeAnimationTitle': { vi: 'Hoạt hình', en: 'Animation' },
  'sheet.typeAnimationDesc': { vi: 'Kể chuyện bằng đồ vật, đất nặn', en: 'Tell a story with objects, clay' },
  'sheet.typeDiaryTitle': { vi: 'Nhật ký', en: 'Diary' },
  'sheet.typeDiaryDesc': { vi: 'Chụp mỗi ngày, xem lớn dần', en: 'A little each day, watch it grow' },
  'sheet.diaryHint': {
    vi: '💡 Mỗi ngày chụp 1-3 ảnh, phim sẽ dài dần theo thời gian nhé!',
    en: '💡 Capture 1-3 photos a day, your film grows over time!',
  },
  'sheet.nameLabel': { vi: 'Tên dự án', en: 'Project name' },
  'sheet.namePlaceholder': { vi: 'Đặt tên cho dự án của con', en: 'Name your project' },
  'sheet.nameClear': { vi: 'Xoá tên đã nhập', en: 'Clear entered name' },
  'sheet.cta': { vi: 'Bắt đầu chụp 📷', en: 'Start capturing 📷' },
  'sheet.openFile': { vi: 'Mở dự án từ file .bbsproj', en: 'Open project from file' },

  // ---------- T-XW10 — HUD diary + onion inline + phim nháp S4 + chip Hub ----------
  'hub.chipTodo': { vi: '📸 Hôm nay chưa chụp', en: '📸 Not captured today' },
  'diary.hintYesterday': { vi: '🧅 Căn cho khớp với ảnh hôm qua', en: "🧅 Line up to match yesterday's photo" },
  'diary.hintFirstDay': { vi: '📍 Đây là ảnh đầu tiên!', en: '📍 This is the first photo!' },
  'diary.today': { vi: 'Hôm nay:', en: 'Today:' },
  'diary.photoUnit': { vi: 'ảnh', en: 'photos' },
  'diary.film': { vi: 'Phim:', en: 'Film:' },
  'diary.flipCamera': { vi: 'Đổi camera trước/sau', en: 'Switch camera' },
  'onion.off': { vi: 'Bật onion, ảnh mờ giúp căn khung', en: 'Turn on onion skin to help line up your shot' },
  'onion.onCompact': { vi: 'Onion đang bật, chạm để chỉnh độ mờ', en: 'Onion skin is on, tap to adjust opacity' },
  'onion.collapse': { vi: 'Thu gọn control onion', en: 'Collapse onion skin control' },
  'onion.opacityLabel': { vi: 'Độ mờ onion', en: 'Onion skin opacity' },
  'draft.title': { vi: 'Phim nháp', en: 'Draft film' },
  'draft.empty': { vi: 'Chụp thêm vài ảnh để xem phim nháp nhé!', en: "Capture a few more photos to see your draft!" },
  'draft.error': { vi: 'Ghép phim nháp chưa được, thử lại nhé!', en: "Couldn't build the draft — try again!" },
  'draft.days': { vi: 'ngày', en: 'days' },
  'draft.captureNextAnimation': { vi: 'Chụp tiếp 📷', en: 'Keep shooting 📷' },
  'draft.captureNextTodayDiary': { vi: 'Chụp tiếp hôm nay 📷', en: 'Shoot today 📷' },
  'draft.captureNextTomorrowDiary': { vi: 'Chụp tiếp ngày mai 📷', en: 'Shoot again tomorrow 📷' },
  'draft.exportFull': { vi: 'Xuất phim hoàn chỉnh', en: 'Export full film' },
  'draft.note': {
    vi: 'Xuất phim xong dự án vẫn còn — con chụp tiếp và xuất lại bao nhiêu lần cũng được!',
    en: 'Even after exporting, the project stays open — keep shooting and export again anytime!',
  },
  'draft.neutral': { vi: 'Chụp thêm để xem phim lớn dần nhé! 🌱', en: 'Keep capturing to watch your film grow! 🌱' },
  'draft.viewDraft': { vi: 'Xem phim nháp', en: 'View draft' },
  'draft.back': { vi: 'Quay lại', en: 'Back' },

  // ---------- T-XW21 — S5 Giới thiệu app iOS ----------
  'appIntro.title': { vi: 'Đừng bỏ lỡ app iPhone nhé! ⏰', en: 'Also on iPhone' },
  'appIntro.body1': {
    vi: 'Trên web, con tự nhớ giờ chụp thôi — app iPhone thì nhắc đúng giờ mỗi ngày, kể cả khi đã tắt máy tính.',
    en: "On the web you have to remember to shoot yourself — the iPhone app reminds you every day, even with your computer off.",
  },
  'appIntro.body2': {
    vi: 'Chụp mượt hơn, dùng được cả khi không có mạng, và làm tiếp đúng dự án đang có trên web.',
    en: 'Smoother capture, works offline, and picks up the same project you have on the web.',
  },
  'appIntro.body3': {
    vi: 'Miễn phí trên App Store — tải về khi nào tiện nhé!',
    en: 'Free on the App Store — download whenever you like!',
  },
  'appIntro.appName': { vi: 'BBStopMotion', en: 'BBStopMotion' },
  'appIntro.appMeta': { vi: 'App Store · Miễn phí', en: 'App Store · Free' },
  'appIntro.storeCta': { vi: 'Tải trên App Store', en: 'Get it on the App Store' },
  'appIntro.later': { vi: 'Để sau', en: 'Later' },
  'appIntro.qrTitle': { vi: 'Đang xem trên máy tính?', en: 'Viewing on a computer?' },
  'appIntro.qrHint': {
    vi: 'Mở Camera iPhone, quét mã này là tới thẳng App Store.',
    en: 'Open your iPhone Camera and scan this code to go straight to the App Store.',
  },
  'appIntro.settingsRow': { vi: 'Giới thiệu app iPhone', en: 'About the iPhone app' },
  'appIntro.settingsRowDesc': { vi: 'Xem lại bất cứ lúc nào', en: 'Revisit anytime' },

  // ---------- T-XW21 — S6 Chuyển máy & sao lưu ----------
  'transfer.title': { vi: 'Mang dự án đi mọi nơi', en: 'Move & back up' },
  'transfer.exportOption': { vi: 'Xuất file dự án', en: 'Export project file' },
  'transfer.importOption': { vi: 'Nhập dự án từ file', en: 'Import project from file' },
  'transfer.importOptionDesc': {
    vi: 'Từ máy khác hoặc từ app iOS — làm tiếp, không mất gì',
    en: 'From another device or the iOS app — pick up right where you left off',
  },
  'transfer.backupNote': {
    vi: '💾 File này cũng là bản sao lưu của con — cất vào Tệp/Drive là yên tâm, kể cả lỡ xoá dữ liệu web.',
    en: "💾 This file is also your backup — keep it in Files/Drive for peace of mind, even if the web data gets erased.",
  },
  'transfer.close': { vi: 'Đóng', en: 'Close' },
  'transfer.exporting': { vi: 'Đang chuẩn bị file...', en: 'Preparing file...' },
  'transfer.exportError': { vi: 'Xuất file chưa được, thử lại nhé!', en: "Couldn't export the file — try again!" },
  'transfer.importing': { vi: 'Đang nhập dự án...', en: 'Importing project...' },
  'transfer.importSuccess': { vi: 'Đã nhập dự án thành công! 🎉', en: 'Project imported successfully! 🎉' },
  'transfer.duplicateTitle': { vi: 'Dự án này đã có trên máy', en: 'This project is already here' },
  'transfer.duplicateBody': {
    vi: 'Con muốn ghi đè bản cũ hay giữ cả 2 bản?',
    en: 'Do you want to overwrite the old one, or keep both?',
  },
  'transfer.duplicateOverwrite': { vi: 'Ghi đè bản cũ', en: 'Overwrite old one' },
  'transfer.duplicateDuplicate': { vi: 'Giữ cả 2 (nhân bản)', en: 'Keep both (duplicate)' },
  'transfer.duplicateCancel': { vi: 'Huỷ', en: 'Cancel' },

  // ---------- T-XW21 — thông báo lỗi importer .bbsproj (mirror BbsprojArchive.ImportError iOS) ----------
  'bbsproj.error.fileTooLarge': { vi: 'File quá lớn hoặc không hợp lệ.', en: 'File is too large or invalid.' },
  'bbsproj.error.invalidZip': { vi: 'File không đọc được — có thể đã hỏng.', en: 'Could not read the file — it may be corrupted.' },
  'bbsproj.error.unsupportedCompression': {
    vi: 'File không đọc được — có thể đã hỏng.', en: 'Could not read the file — it may be corrupted.',
  },
  'bbsproj.error.schemaVersionTooNew': { vi: 'Hãy cập nhật app để mở file này.', en: 'Please update the app to open this file.' },
  'bbsproj.error.invalidProjectData': {
    vi: 'File dự án bị thiếu dữ liệu hoặc không hợp lệ.', en: 'The project file is missing data or invalid.',
  },
  'bbsproj.error.tooManyFrames': { vi: 'File quá lớn hoặc không hợp lệ.', en: 'File is too large or invalid.' },
  'bbsproj.error.frameFileTooLarge': { vi: 'File quá lớn hoặc không hợp lệ.', en: 'File is too large or invalid.' },
  'bbsproj.error.totalTooLarge': { vi: 'File quá lớn hoặc không hợp lệ.', en: 'File is too large or invalid.' },

  // ---------- T-XW21 — Storage 3 lớp (Cài đặt) ----------
  'settings.storageTitle': { vi: 'Bộ nhớ & lưu trữ', en: 'Storage & backup' },
  'settings.storagePersistLabel': { vi: 'Lưu trữ bền vững (persist)', en: 'Persistent storage' },
  'settings.storagePersistGranted': {
    vi: 'Đã bật — trình duyệt sẽ không tự xoá', en: 'Enabled — the browser won\'t auto-clear this data',
  },
  'settings.storagePersistDenied': {
    vi: 'Chưa bật — trình duyệt có thể tự xoá nếu thiếu chỗ, nhớ xuất file sao lưu thường xuyên nhé',
    en: 'Not enabled — the browser may clear this if space is low; remember to export a backup file often',
  },
  'settings.storagePersistDesc': {
    vi: 'Xin trình duyệt KHÔNG tự dọn dữ liệu khi máy thiếu chỗ. Nếu trình duyệt từ chối, hiện badge cảnh báo thay vì badge xanh này.',
    en: "Asks the browser NOT to auto-clear data when the device is low on space. If refused, a warning badge shows instead.",
  },
  'settings.storageGaugeLabel': { vi: 'Đồng hồ dung lượng', en: 'Storage gauge' },
  'settings.storageGaugeDesc': {
    vi: 'Đọc navigator.storage.estimate(), cập nhật mỗi lần vào Cài đặt.',
    en: 'Reads navigator.storage.estimate(), refreshed each time you open Settings.',
  },
  'settings.storageHomeScreenLabel': { vi: 'Thêm vào Màn hình chính', en: 'Add to Home Screen' },
  'settings.storageHomeScreenTip': {
    vi: '📲 Thêm BBStopMotion vào Màn hình chính (Safari: nút Chia sẻ ⬆️ → "Thêm vào MH chính") — iOS sẽ KHÔNG tự xoá dữ liệu sau 7 ngày không dùng như tab trình duyệt thường.',
    en: '📲 Add BBStopMotion to your Home Screen (Safari: Share ⬆️ → "Add to Home Screen") — iOS won\'t auto-clear data after 7 idle days like a regular browser tab.',
  },
  'settings.storageFinalLabel': { vi: 'Lớp bảo hiểm cuối cùng', en: 'Final safety net' },
  'settings.storageFinalDesc': {
    vi: 'Vẫn nên tải file .bbsproj về máy định kỳ (mục "Chuyển máy & sao lưu" ở trên) — 3 lớp trên giảm rủi ro, KHÔNG loại bỏ hoàn toàn; file là chỗ dựa cuối tuyệt đối chắc chắn.',
    en: 'Still export a .bbsproj file regularly ("Move & back up" above) — the 3 layers above reduce risk but don\'t eliminate it; the file is the one truly certain safety net.',
  },
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

/**
 * Chuỗi phẳng "VN · EN" (hoặc chỉ main nếu không có sub) — dùng cho chỗ không thể chèn
 * `<span>` con (vd `placeholder`, `aria-label`, `alt`) nhưng vẫn cần đủ 2 ngôn ngữ ở mode
 * 'vi+en' theo đúng redline (nguồn gốc bug T-BS11: nơi dùng `.main` một mình sẽ NUỐT phần EN).
 */
export function bilingualText(language: Language, key: StringKey, sep = ' · '): string {
  const { main, sub } = label(language, key)
  return sub ? `${main}${sep}${sub}` : main
}
