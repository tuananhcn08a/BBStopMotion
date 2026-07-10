from __future__ import annotations

from pathlib import Path

from loguru import logger
from PyQt6.QtCore import QObject, pyqtProperty, pyqtSignal, pyqtSlot

from neo_stopmotion.config.settings import AppSettings, save_settings
from neo_stopmotion.core.capture_engine import CaptureEngine, CaptureError
from neo_stopmotion.services.camera_selector import CameraSelector
from neo_stopmotion.services.export_service import ExportService
from neo_stopmotion.services.library_service import LibraryService
from neo_stopmotion.services.session_service import SessionService
from neo_stopmotion.services.speed_selector import SpeedSelector
from neo_stopmotion.services.video_saver import VideoSaver
from neo_stopmotion.utils.signal_bus import SignalBus


class AppController(QObject):
    """Root QObject exposed to QML — facade over capture+session+export."""

    frameCountChanged = pyqtSignal(int)
    # T-005: camera picker signals
    cameraProbeResult = pyqtSignal(int, bool)  # (index, is_available)
    cameraChanged = pyqtSignal(int)  # new webcam_index
    pickerCounterChanged = pyqtSignal(int)  # bump to force image reload in picker
    # T-BS30: Settings (F2/F3/F4/F8) — persisted via config.settings.save_settings
    goalFramesChanged = pyqtSignal(int)
    onionSkinOpacityChanged = pyqtSignal(float)
    languageChanged = pyqtSignal(str)
    soundEnabledChanged = pyqtSignal(bool)
    autoUploadChanged = pyqtSignal(bool)
    defaultFpsLevelChanged = pyqtSignal(str)

    def __init__(
        self,
        capture: CaptureEngine,
        session: SessionService,
        export_service: ExportService | None = None,
        min_frames: int = 5,
        camera_selector: CameraSelector | None = None,
        library_service: LibraryService | None = None,
        settings: AppSettings | None = None,
        settings_path: Path | None = None,
    ) -> None:
        super().__init__()
        self._capture = capture
        self._session = session
        self._export_service = export_service
        self._min_frames = min_frames
        self._bus = SignalBus.instance()
        self._frame_count = 0
        self._post_export = False  # True when on SuccessPage
        # T-005: camera selector (lazy init if not provided)
        self._camera_selector: CameraSelector | None = camera_selector
        # T-005: picker preview counter — bumped each time a probe succeeds so QML
        # refreshes image://picker/<counter> immediately.
        self._picker_counter: int = 0
        # T-012: library service (injected from app.py)
        self._library_service: LibraryService | None = library_service

        # T-BS30: Settings screen state (F2/F3/F4/F8) — sourced from AppSettings
        # (loaded config.toml) so values persist across app restarts (spec §5).
        self._settings: AppSettings = settings or AppSettings()
        self._settings_path: Path | None = settings_path
        self._goal_frames: int = self._settings.export.goal_frames
        self._onion_opacity: float = self._settings.capture.onion_opacity
        self._language: str = self._settings.app.language
        self._sound_enabled: bool = self._settings.ui.sound_enabled
        self._auto_upload: bool = self._settings.upload.auto_upload
        self._default_fps_level: str = self._settings.capture.default_fps_level
        # Apply persisted onion opacity to the active capture engine right away.
        self._capture.onion_opacity = self._onion_opacity

        # T-006: speed selector (default from Settings F8, else Vua / 8 fps)
        self.speed_selector = SpeedSelector(default_label=self._default_fps_level)

        self._bus.uart_command_received.connect(self.handle_uart_command)
        self._bus.export_completed.connect(self._on_export_completed)

    def _on_export_completed(self, _payload: dict) -> None:
        self._post_export = True

    @pyqtProperty(int, notify=frameCountChanged)
    def frameCount(self) -> int:
        return self._frame_count

    @pyqtProperty(int, notify=pickerCounterChanged)
    def pickerCounter(self) -> int:
        """Monotonically increasing counter; QML uses it as image URL suffix."""
        return self._picker_counter

    # ------------------------------------------------------------------
    # T-BS30: Settings (F2 goalFrames / F3 onionSkinOpacity / F4 language /
    # F8 soundEnabled+autoUpload+defaultFpsLevel) — read/write properties
    # backed by config.toml (persist qua session, spec §5).
    # ------------------------------------------------------------------

    def _persist_settings(self) -> None:
        if self._settings_path is None:
            return
        try:
            save_settings(self._settings, self._settings_path)
        except OSError as exc:  # pragma: no cover — disk/permission edge case
            logger.warning(f"Could not persist settings: {exc}")

    @pyqtProperty(int, notify=goalFramesChanged)
    def goalFrames(self) -> int:
        return self._goal_frames

    @pyqtSlot(int)
    def set_goal_frames(self, value: int) -> None:
        """F2: đổi mục tiêu số frame — áp dụng NGAY cho phiên đang chụp dở."""
        if value == self._goal_frames:
            return
        self._goal_frames = value
        self._settings.export.goal_frames = value
        self._persist_settings()
        self.goalFramesChanged.emit(value)

    @pyqtSlot(float)
    def set_live_onion_opacity(self, value: float) -> None:
        """F1/F3: áp dụng opacity NGAY cho preview đang chạy, KHÔNG persist.

        Dùng cho toggle "Onion skin" ở 2a (bật/tắt hiển thị mà không đổi giá
        trị đã lưu trong Settings — xem CapturePage.qml _applyOnionLive()).
        Settings slider dùng set_onion_skin_opacity() (persist) thay vì slot này.
        """
        self._capture.onion_opacity = max(0.0, min(1.0, value))

    @pyqtProperty(float, notify=onionSkinOpacityChanged)
    def onionSkinOpacity(self) -> float:
        return self._onion_opacity

    @pyqtSlot(float)
    def set_onion_skin_opacity(self, value: float) -> None:
        """F3: đổi độ mờ onion skin — áp dụng NGAY cho preview đang chạy."""
        value = max(0.0, min(1.0, value))
        if value == self._onion_opacity:
            return
        self._onion_opacity = value
        self._capture.onion_opacity = value
        self._settings.capture.onion_opacity = value
        self._persist_settings()
        self.onionSkinOpacityChanged.emit(value)

    @pyqtProperty(str, notify=languageChanged)
    def language(self) -> str:
        return self._language

    @pyqtSlot(str)
    def set_language(self, value: str) -> None:
        """F4: đổi ngôn ngữ — 'vi+en' | 'vi' | 'en'."""
        if value not in ("vi+en", "vi", "en") or value == self._language:
            return
        self._language = value
        self._settings.app.language = value
        self._persist_settings()
        self.languageChanged.emit(value)

    @pyqtProperty(bool, notify=soundEnabledChanged)
    def soundEnabled(self) -> bool:
        return self._sound_enabled

    @pyqtSlot(bool)
    def set_sound_enabled(self, value: bool) -> None:
        """F8: bật/tắt âm 'tách' khi chụp."""
        if value == self._sound_enabled:
            return
        self._sound_enabled = value
        self._settings.ui.sound_enabled = value
        self._persist_settings()
        self.soundEnabledChanged.emit(value)

    @pyqtProperty(bool, notify=autoUploadChanged)
    def autoUpload(self) -> bool:
        return self._auto_upload

    @pyqtSlot(bool)
    def set_auto_upload(self, value: bool) -> None:
        """F8: bật/tắt tải lên cloud tự động (Q6b: ảnh hưởng luồng 2b/2c)."""
        if value == self._auto_upload:
            return
        self._auto_upload = value
        self._settings.upload.auto_upload = value
        self._persist_settings()
        self.autoUploadChanged.emit(value)

    @pyqtProperty(str, notify=defaultFpsLevelChanged)
    def defaultFpsLevel(self) -> str:
        return self._default_fps_level

    @pyqtSlot(str)
    def set_default_fps_level(self, label: str) -> None:
        """F8: tốc độ mặc định khi bắt đầu phiên mới — 'Cham'|'Vua'|'Nhanh'."""
        if label == self._default_fps_level:
            return
        try:
            self.speed_selector.set_default_label(label)
        except ValueError as exc:
            logger.warning(f"set_default_fps_level: {exc}")
            return
        self._default_fps_level = label
        self._settings.capture.default_fps_level = label
        self._persist_settings()
        self.defaultFpsLevelChanged.emit(label)

    @pyqtSlot(result=int)
    def get_current_webcam_display_index(self) -> int:
        """Convenience for SettingsPage's Camera row label (no device names available)."""
        return self.get_current_webcam_index()

    @pyqtSlot(str)
    def retry_upload(self, mp4_path: str) -> None:
        """F7/F8: tải lên lại file MP4 đã ghép sẵn (KHÔNG ghép lại từ frame).

        Dùng cho: 2c banner "Thử tải lên lại" khi auto-upload lỗi/tắt, và
        1g Library nút "↻ Tải lên". Kết quả trả qua SignalBus.share_url_ready
        (share_url, qr_path) — cả hai rỗng nếu upload thất bại.
        """
        import threading

        from neo_stopmotion.core.cloud_uploader import CloudUploader, UploadError, generate_qr

        path = Path(mp4_path)
        if not path.exists():
            logger.warning(f"retry_upload: file not found: {path}")
            self._bus.share_url_ready.emit("", "")
            return

        def _run() -> None:
            try:
                uploader = CloudUploader()
                url = uploader.upload(path)
                qr_path = path.parent / "qr.png"
                generate_qr(url, qr_path)
                self._bus.share_url_ready.emit(url, str(qr_path))
            except UploadError as exc:
                logger.warning(f"retry_upload failed for {path}: {exc}")
                self._bus.share_url_ready.emit("", "")

        threading.Thread(target=_run, daemon=True).start()

    @pyqtSlot(str)
    def handle_uart_command(self, cmd: str) -> None:
        cmd = cmd.strip().upper()
        logger.debug(f"UART cmd: {cmd}")
        if cmd == "SHOOT":
            self._do_shoot()
        elif cmd == "UNDO":
            self._do_undo()
        elif cmd == "EXPORT":
            self._do_export()
        elif cmd == "READY":
            logger.info("ThingBot READY")
        elif cmd == "BAT_LOW":
            self._bus.status_message.emit("warning", "Pin ThingBot yếu")
        else:
            logger.warning(f"Unknown UART cmd: {cmd}")

    def _do_shoot(self) -> None:
        # On SuccessPage: SHOOT means "I want to make another film".
        # Auto-reset and capture the first frame of a new session.
        if self._post_export:
            logger.info("SHOOT after export — auto-resetting session for new film")
            self.reset_session()
        try:
            frame = self._capture.capture_frame()
        except CaptureError as e:
            logger.error(f"Capture failed: {e}")
            self._bus.webcam_error.emit(str(e))
            return
        path = self._session.frame_manager.add_frame(frame)
        self._frame_count = self._session.frame_manager.frame_count
        self.frameCountChanged.emit(self._frame_count)
        self._bus.frame_captured.emit(self._frame_count, str(path))

    def _do_undo(self) -> None:
        ok = self._session.frame_manager.undo_last_frame()
        if not ok:
            return
        new_count = self._session.frame_manager.frame_count
        prev = self._session.frame_manager.load_frame(new_count) if new_count > 0 else None
        self._capture.set_last_frame(prev)
        self._frame_count = new_count
        self.frameCountChanged.emit(self._frame_count)
        self._bus.frame_undone.emit(new_count)

    def _do_export(self) -> None:
        fm = self._session.frame_manager
        if fm.frame_count < self._min_frames:
            self._bus.status_message.emit(
                "warning",
                f"Cần ít nhất {self._min_frames} frame — con chụp thêm vài tấm nữa nha!",
            )
            return
        if self._export_service is None:
            logger.warning("Export requested but ExportService not configured")
            return
        # T-006: pass selected fps to export service
        fps = self.speed_selector.selected_fps
        logger.info(f"Export started with fps={fps} ({self.speed_selector.selected_label})")
        self._export_service.start_export(fm, fps=fps)

    # ------------------------------------------------------------------
    # T-006: Speed selector slots
    # ------------------------------------------------------------------

    @pyqtSlot(str)
    def select_speed(self, label: str) -> None:
        """QML slot: select playback speed by label ("Cham" / "Vua" / "Nhanh")."""
        try:
            self.speed_selector.select(label)
            logger.debug(f"Speed selected: {label} ({self.speed_selector.selected_fps} fps)")
        except ValueError as e:
            logger.warning(f"Invalid speed label: {e}")

    @pyqtSlot(result=str)
    def get_selected_speed_label(self) -> str:
        """Return the currently selected speed label."""
        return self.speed_selector.selected_label

    @pyqtSlot(result=int)
    def get_selected_fps(self) -> int:
        """Return the currently selected fps value."""
        return self.speed_selector.selected_fps

    @pyqtSlot(int, result=str)
    def get_suggested_speed(self, frame_count: int) -> str:
        """Return the auto-suggested speed label for *frame_count* (or '' if none)."""
        suggestion = self.speed_selector.get_suggested_label(frame_count)
        return suggestion or ""

    @pyqtSlot(result="QVariantList")
    def get_frame_paths(self) -> list[str]:
        """Return sorted list of absolute file:// paths for all current frames.

        Called by QML FilmStrip to refresh thumbnail sources after capture/delete.
        Uses a timestamp query-string suffix for cache-busting so QML Image
        does not show stale content after re-sequencing.
        """
        import time
        ts = int(time.time() * 1000)
        return [
            f"file://{p}?t={ts}"
            for p in self._session.frame_manager.get_all_frames()
        ]

    @pyqtSlot(int)
    def handle_delete_frame(self, n: int) -> None:
        """Public slot called from UI to delete frame at 1-based index n.

        Delegates to _do_delete_frame; errors are caught and surfaced via
        status_message so the UI can show a friendly alert without crashing.
        """
        self._do_delete_frame(n)

    @pyqtSlot(int)
    def delete_frame_smart(self, selected_index: int) -> None:
        """Delete logic: if selected_index > 0, delete that frame; otherwise delete last.

        selected_index is 1-based (0 means nothing selected).
        Called by keyboard Delete key handler in QML (T-011 AC1/AC7).
        """
        frame_count = self._session.frame_manager.frame_count
        if frame_count == 0:
            return
        if selected_index > 0 and selected_index <= frame_count:
            self._do_delete_frame(selected_index)
        else:
            # No selection → delete last frame
            self._do_delete_frame(frame_count)

    def _do_delete_frame(self, n: int) -> None:
        """Delete frame n (1-based), emit frame_deleted(new_count), log."""
        try:
            self._session.frame_manager.delete_frame(n)
        except ValueError as exc:
            logger.warning(f"delete_frame({n}) invalid: {exc}")
            self._bus.status_message.emit(
                "warning", f"Không thể xoá tấm {n}: {exc}"
            )
            return
        except OSError as exc:
            logger.error(f"delete_frame({n}) OS error: {exc}")
            self._bus.status_message.emit(
                "error", "Oi, xoá ảnh bị lỗi. Con thử lại nhé!"
            )
            return

        new_count = self._session.frame_manager.frame_count
        self._frame_count = new_count
        self.frameCountChanged.emit(new_count)
        self._bus.frame_deleted.emit(new_count)
        logger.info(f"handle_delete_frame({n}) — new count: {new_count}")

    @pyqtSlot()
    def reset_session(self) -> None:
        """Start a fresh session.

        Called from SuccessPage 'Quay lại' button OR auto-triggered when SHOOT
        arrives while we're on SuccessPage (post_export=True).
        """
        self._session.reset()
        self._capture.reset()
        self._frame_count = 0
        self._post_export = False
        # T-006: reset speed selector to default (Vua / 8fps) for new session
        self.speed_selector.reset()
        self.frameCountChanged.emit(0)
        self._bus.session_reset.emit()

    # ------------------------------------------------------------------
    # T-005: Camera picker slots
    # ------------------------------------------------------------------

    def _get_camera_selector(self) -> CameraSelector:
        """Lazy-create CameraSelector if not injected."""
        if self._camera_selector is None:
            self._camera_selector = CameraSelector(current_capture=self._capture)
        return self._camera_selector

    @pyqtSlot(int)
    def picker_probe_index(self, index: int) -> None:
        """QML slot: probe camera at *index*; emits cameraProbeResult(index, is_available).

        When probe succeeds, also bumps pickerCounter so QML refreshes the
        live-preview image from image://picker/<counter>.
        """
        sel = self._get_camera_selector()
        available = sel.probe_index(index)
        if available:
            self._picker_counter += 1
            self.pickerCounterChanged.emit(self._picker_counter)
        self.cameraProbeResult.emit(index, available)

    @pyqtSlot(int)
    def picker_confirm(self, new_index: int) -> None:
        """QML slot: confirm camera selection — switches engine, writes config."""
        sel = self._get_camera_selector()
        sel.confirm_selection(new_index)
        # Update internal reference so capture/preview keeps working
        self._capture = sel.get_current_capture()
        # Notify image provider update happens via webcam_ready signal in selector
        self.cameraChanged.emit(new_index)
        logger.info(f"Camera switched to index {new_index}")

    @pyqtSlot()
    def picker_cancel(self) -> None:
        """QML slot: cancel picker — restore old camera, release probed."""
        sel = self._get_camera_selector()
        sel.cancel_selection()

    @pyqtSlot(result="QVariantList")
    def get_available_camera_indices(self) -> list[int]:
        """Return a list of working camera indices for QML to use as a dynamic model.

        Performs a fast enumerate scan (retry_delay_seconds=0) via
        CameraSelector.list_available_indices().  Returns [0] as fallback
        when no CameraSelector is available (e.g. synthetic/sim mode) so
        the picker always shows at least one slot rather than crashing.

        Called by CameraPickerPopup.qml on open to populate the dot indicators
        and navigation model instead of the old hardcoded model:6.
        """
        if self._camera_selector is None:
            # Synthetic / sim mode — no real cameras; return [0] as safe default
            logger.debug("get_available_camera_indices: no selector (sim mode) → [0]")
            return [0]
        result = self._camera_selector.list_available_indices()
        logger.debug(f"get_available_camera_indices → {result}")
        return result

    @pyqtSlot(result=int)
    def get_current_webcam_index(self) -> int:
        """Return the currently active webcam index (for QML).

        Falls back to 0 when the active engine has no webcam index (e.g.
        SyntheticCaptureEngine when no usable webcam was found) — avoids a
        crash when the user opens the camera picker.
        """
        return getattr(self._capture, "webcam_index", 0)

    # ------------------------------------------------------------------
    # T-007: Save video / copy link slots
    # ------------------------------------------------------------------

    @pyqtSlot(str, str)
    def save_video(self, mp4_path: str, dest_dir: str) -> None:
        """QML slot: copy MP4 file to dest_dir.

        In production this runs on a Qt worker thread so the UI stays
        responsive.  Emits save_video_result(True, dest_path) on success,
        save_video_result(False, error_msg) on failure.
        """
        import threading
        saver = VideoSaver()

        def _run() -> None:
            saver.save(mp4_path, dest_dir)

        t = threading.Thread(target=_run, daemon=True)
        t.start()

    @pyqtSlot(str)
    def copy_link(self, url: str) -> None:
        """QML slot: copy share URL to clipboard."""
        VideoSaver().copy_link(url)

    @pyqtSlot(str)
    def open_save_dialog(self, mp4_path: str) -> None:
        """QML slot: open native folder picker dialog then copy MP4 to chosen dir.

        Runs QFileDialog on the main thread (required by Qt), then hands off
        the actual file copy to a background thread via save_video().
        If the user cancels the dialog, emits save_video_result(False, "")
        so the UI can reset the loading state.
        """
        from PyQt6.QtWidgets import QFileDialog
        dest_dir = QFileDialog.getExistingDirectory(
            None,
            "Chọn thư mục lưu phim",
            "",
        )
        if not dest_dir:
            # User cancelled — signal empty cancel so UI resets
            self._bus.save_video_result.emit(False, "__cancelled__")
            return
        self.save_video(mp4_path, dest_dir)

    # ------------------------------------------------------------------
    # T-012: Library service slots
    # ------------------------------------------------------------------

    @pyqtSlot(result="QVariantList")
    def library_list_sessions(self) -> list[object]:
        """QML slot: scan projects_dir and return session list as QVariantList.

        Returns list of dicts (QVariantMap) — each dict is a LibraryEntry.to_qml_dict().
        Returns empty list + logs error if projects_dir unreadable.
        """
        if self._library_service is None:
            logger.warning("library_list_sessions called but LibraryService not configured")
            return []
        try:
            entries = self._library_service.list_sessions()
            return [e.to_qml_dict() for e in entries]
        except OSError as e:
            logger.error(f"library_list_sessions failed: {e}")
            self._bus.status_message.emit("error", str(e))
            return []

    @pyqtSlot(str, result="bool")
    def library_delete_session(self, session_id: str) -> bool:
        """QML slot: delete session by id. Returns True on success, False on failure."""
        if self._library_service is None:
            logger.warning("library_delete_session called but LibraryService not configured")
            return False
        try:
            self._library_service.delete_session(session_id)
            logger.info(f"library_delete_session: deleted {session_id}")
            return True
        except (OSError, ValueError) as e:
            logger.error(f"library_delete_session failed for {session_id}: {e}")
            self._bus.status_message.emit("error", str(e))
            return False

    @pyqtSlot(str, str, str)
    def library_save_session(self, mp4_path: str, gif_path: str, qr_path: str) -> None:
        """QML slot: open save dialog and copy session files to chosen directory.

        Copies mp4 + gif (if exists) + qr (if exists) to user-chosen dir.
        Emits save_video_result on SignalBus.
        """
        from PyQt6.QtWidgets import QFileDialog
        dest_dir = QFileDialog.getExistingDirectory(
            None,
            "Chọn thư mục lưu phim",
            "",
        )
        if not dest_dir:
            self._bus.save_video_result.emit(False, "__cancelled__")
            return

        import shutil as _shutil
        import threading as _threading
        dest = Path(dest_dir)

        def _run() -> None:
            try:
                copied: list[str] = []
                for p in (mp4_path, gif_path, qr_path):
                    if p:
                        src = Path(p)
                        if src.exists():
                            _shutil.copy2(str(src), str(dest / src.name))
                            copied.append(src.name)
                msg = f"Đã lưu phim ra {dest}!"
                self._bus.save_video_result.emit(True, msg)
                logger.info(f"library_save_session: copied {copied} to {dest}")
            except PermissionError:
                self._bus.save_video_result.emit(
                    False, "Không đủ quyền lưu tại thư mục đó. Chọn thư mục khác nhé!"
                )
            except OSError as exc:
                self._bus.save_video_result.emit(False, f"Lưu không thành công: {exc}")

        _threading.Thread(target=_run, daemon=True).start()
