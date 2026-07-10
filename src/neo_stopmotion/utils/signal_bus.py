from __future__ import annotations

from PyQt6.QtCore import QObject, pyqtSignal


class SignalBus(QObject):
    """Centralized event hub. Modules emit/listen via this singleton."""

    # UART
    uart_command_received = pyqtSignal(str)
    uart_disconnected = pyqtSignal()
    uart_reconnected = pyqtSignal()

    # Capture
    webcam_ready = pyqtSignal()
    webcam_error = pyqtSignal(str)
    frame_captured = pyqtSignal(int, str)
    frame_undone = pyqtSignal(int)
    frame_deleted = pyqtSignal(int)  # int = new frame_count after deletion

    # Session
    session_reset = pyqtSignal()

    # Export
    export_started = pyqtSignal()
    export_progress = pyqtSignal(float)
    export_completed = pyqtSignal(dict)
    export_failed = pyqtSignal(str)

    # Share — T-BS30 (F7/F8): retry_upload() result (share_url, qr_path);
    # both "" on failure.
    share_url_ready = pyqtSignal(str, str)

    # T-007: save-video result (success, message/path or error)
    save_video_result = pyqtSignal(bool, str)

    # App
    status_message = pyqtSignal(str, str)  # level, message

    _instance: SignalBus | None = None

    @classmethod
    def instance(cls) -> SignalBus:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
